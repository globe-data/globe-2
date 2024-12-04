from fastapi import APIRouter, Request, HTTPException
from app.models.api_models import BatchAnalyticsRequest, AnalyticsResponse
import json
import logging
import sys
from typing import Dict, Any
from datetime import datetime
from app.db.factory import get_storage

router = APIRouter()
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

if not logger.handlers:
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(logging.DEBUG)
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    handler.setFormatter(formatter)
    logger.addHandler(handler)

def datetime_handler(obj):
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")

@router.post("/batch", response_model=AnalyticsResponse)
async def receive_analytics(request: Request) -> AnalyticsResponse:
    """
    Receive a batch of analytics events.
    Handles both raw and gzip compressed JSON data.
    """
    
    try:
        # Get the raw body
        body = await request.body()

        # Check if content is gzip compressed
        if request.headers.get("content-encoding") == "gzip":
            import gzip
            try:
                body_str = gzip.decompress(body).decode()
                logger.debug(f"Decompressed gzip request body")
            except Exception as e:
                logger.error(f"Gzip decompression error: {e}")
                raise HTTPException(status_code=400, detail="Invalid gzip compression")
        else:
            body_str = body.decode()
        
        # Parse the body
        try:
            data = json.loads(body_str)

        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error: {e}")
            raise HTTPException(status_code=400, detail="Invalid JSON format")

        # Validate the data as a BatchAnalyticsRequest
        try:
            request_data = BatchAnalyticsRequest(**data)
            
        except Exception as e:
            logger.error(f"Validation error: {e}")
            logger.error(f"Received data structure: {data}")
            raise HTTPException(status_code=400, detail=str(e))

        # Process the events
        events_processed = len(request_data.events)

        # TODO: Implement processing / data washing
        # For now, we'll just return the number of events processed
        # success = True
        # moved storage to within privacy processing
        # MAYBE: temp

        # Get valid event types from database (or hardcode if needed)
        VALID_EVENT_TYPES = {
            'pageview', 'click', 'scroll', 'media', 
            'form', 'conversion', 'error', 'performance'
        }
        
        # Filter events before storage
        filtered_events = [
            event.model_dump() for event in request_data.events 
            if event.event_type in VALID_EVENT_TYPES
        ]
        
        if not filtered_events:
            return AnalyticsResponse(
                status="success",
                events_processed=0
            )
        
        return AnalyticsResponse(
            status="success",
            events_processed=len(filtered_events)
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Unexpected error: {str(e)}")
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/realtime")
async def receive_realtime_event(request: Request) -> Dict[str, Any]:
    # todo: implement
    pass

@router.options("/batch")
async def batch_options():
    return {"status": "ok"}