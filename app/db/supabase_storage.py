from .interface import AnalyticsStorage
from supabase import create_client
from app.core.config import settings
from app.core.logging import get_logger
from datetime import datetime
from typing import List, Optional, Dict, Any
from app.events.schemas.events import EventType

logger = get_logger(__name__)

class SupabaseAnalytics(AnalyticsStorage):
    def __init__(self):
        self.supabase = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_KEY
        )
    
    async def store_event(self, event_data: dict) -> bool:
        """Store a single event in the appropriate tables"""
        try:
            async with self.supabase.transaction() as txn:
                # Prepare base event data
                base_event = {
                    'globe_id': event_data['globe_id'],
                    'event_id': event_data['event_id'],
                    'timestamp': event_data['timestamp'],
                    'session_id': event_data['session_id'],
                    'client_timestamp': event_data['client_timestamp'],
                    'event_type': event_data['event_type']
                }
                
                base_event = self._prepare_event_data(base_event)
                
                # Insert into base events table
                result = self.supabase.table('analytics_events').insert(base_event).execute()
                if not result.data:
                    return False
                    
                # Get event-specific data and flatten it
                event_type = event_data['event_type']
                specific_data = event_data.get('data', {}).copy()  # Make a copy to avoid modifying original
                specific_data['event_id'] = event_data['event_id']
                
                # Handle special case for media events
                if event_type == 'media' and 'current_time' in specific_data:
                    specific_data['playback_time'] = specific_data.pop('current_time')
                
                specific_data = self._prepare_event_data(specific_data)
                
                # Insert into specific event table
                table_name = f"{event_type}_events"
                result = self.supabase.table(table_name).insert(specific_data).execute()
                return bool(result.data)
                
        except Exception as e:
            logger.error(f"Failed to store single event: {e}")
            return False
    
    async def store_events(self, event_data: list[dict]) -> bool:
        """Store multiple events in their appropriate tables"""
        try:
            # First, filter out any events with IDs that already exist
            existing_event_ids = set()
            for event in event_data:
                result = self.supabase.table('analytics_events')\
                    .select('event_id')\
                    .eq('event_id', event['event_id'])\
                    .execute()
                if result.data:
                    existing_event_ids.add(event['event_id'])
                    logger.warning(f"Skipping duplicate event ID: {event['event_id']}")

            # Filter out events with existing IDs
            filtered_events = [
                event for event in event_data 
                if event['event_id'] not in existing_event_ids
            ]

            if not filtered_events:
                logger.warning("All events were duplicates, nothing to insert")
                return True

            # Insert base events first
            base_events = [{
                'globe_id': event.get('globe_id', '03c04930-0c1b-4a2a-96cd-933dd8d7914c'),
                'event_id': event['event_id'],
                'timestamp': event['timestamp'], 
                'session_id': event['session_id'],
                'client_timestamp': event['client_timestamp'],
                'event_type': event['event_type'],
            } for event in filtered_events]

            base_events = [self._prepare_event_data(event) for event in base_events]
            
            # Insert all base events
            result = self.supabase.table('analytics_events').insert(base_events).execute()
            if not result.data:
                logger.error("Failed to insert base events")
                return False

            # Group and prepare event-specific data
            event_type_groups = {}
            for event in filtered_events:
                event_type = event['event_type']
                if event_type not in event_type_groups:
                    event_type_groups[event_type] = []
                
                specific_data = {'event_id': event['event_id'], **event['data']}
                
                if event_type == 'pageview':
                    viewport = specific_data.pop('viewport', {})
                    specific_data.update({
                        'viewport_width': viewport.get('width'),
                        'viewport_height': viewport.get('height')
                    })
                elif event_type == 'media' and 'current_time' in specific_data:
                    specific_data['playback_time'] = specific_data.pop('current_time')
                elif event_type == 'scroll':
                    specific_data = self._validate_scroll_event(specific_data)
                
                event_type_groups[event_type].append(self._prepare_event_data(specific_data))

            # Insert event-specific data
            for event_type, events in event_type_groups.items():
                table_name = f"{event_type}_events"
                if isinstance(event_type, EventType):
                    table_name = f"{event_type.value}_events"
                    
                result = self.supabase.table(table_name).insert(events).execute()
                if not result.data:
                    logger.error(f"Failed to insert {event_type} events")
                    return False

            return True
            
        except Exception as e:
            event_types = list(event_type_groups.keys()) if 'event_type_groups' in locals() else []
            logger.error(f"Failed to store events batch in Supabase. Event types being processed: {event_types}. Error: {str(e)}")
            return False
    
    def _prepare_event_data(self, event: dict) -> dict:
        """Convert datetime objects to ISO format strings in event data"""
        prepared_event = {}
        for key, value in event.items():
            if isinstance(value, datetime):
                prepared_event[key] = value.isoformat()
            else:
                prepared_event[key] = value
        return prepared_event
    
    async def get_events(
        self,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
        event_type: str | None = None,
    ) -> List[dict]:
        """Retrieve events within a time range"""
        if start_time and end_time:
            query = self.supabase.table('analytics_events')\
                .select('*')\
                .gte('timestamp', start_time.isoformat())\
                .lte('timestamp', end_time.isoformat())
        else:
            query = self.supabase.table('analytics_events').select('*')
            
        if event_type:
            query = query.eq('event_type', event_type)
            
        result = query.execute()
        return result.data
    
    async def get_aggregates(
        self,
        metric: str,
        interval: str,
        start_time: datetime,
        end_time: datetime,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[dict]:
        # Basic implementation for now
        # Could be expanded based on specific aggregation needs
        query = self.supabase.rpc(
            'get_analytics_aggregates',
            {
                'metric_name': metric,
                'time_interval': interval,
                'start_ts': start_time.isoformat(),
                'end_ts': end_time.isoformat(),
                'filter_params': filters or {}
            }
        )
        result = query.execute()
        return result.data
    
    async def healthcheck(self) -> bool:
        try:
            # Simple query to check if we can access the database
            self.supabase.table('analytics_events').select('event_id').limit(1).execute()
            return True
        except Exception as e:
            logger.error(f"Healthcheck failed: {e}")
            return False
    
    def _validate_scroll_event(self, event: dict) -> dict:
        """Validate and format scroll event data"""
        try:
            return {
                'event_id': str(event['event_id']),  # Ensure UUID string format
                'depth': int(event['depth']),
                'direction': str(event['direction']),
                'max_depth': int(event['max_depth']),
                'relative_depth': float(event['relative_depth'])
            }
        except (KeyError, ValueError) as e:
            logger.error(f"Invalid scroll event data: {e}")
            raise
    
    def validate_media_event(self, data: dict) -> dict:
        """Validate and transform media event data"""
        if data['media_type'] not in ['video', 'audio']:
            raise ValueError(f"Invalid media_type: {data['media_type']}")
        if data['action'] not in ['play', 'pause', 'complete']:
            raise ValueError(f"Invalid action: {data['action']}")
        return data