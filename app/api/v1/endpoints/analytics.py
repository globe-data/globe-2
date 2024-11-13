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

# Add a stream handler if none exists
if not logger.handlers:
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(logging.DEBUG)
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    handler.setFormatter(formatter)
    logger.addHandler(handler)

# Add this function at the top of your file
def datetime_handler(obj):
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")

@router.post("/batch", response_model=AnalyticsResponse)
async def receive_analytics(request: Request) -> AnalyticsResponse:
    """
    Receive a batch of analytics events.
    """
    # Force print for debugging
    print(f"\n=== NEW ANALYTICS REQUEST ===")
    
    try:

        # Get the raw body
        body = await request.body()
        body_str = body.decode()
        
        # Parse the body
        try:
            data = json.loads(body_str)
        except json.JSONDecodeError as e:
            print(f"JSON decode error: {e}")
            logger.error(f"JSON decode error: {e}")
            raise HTTPException(status_code=400, detail="Invalid JSON format")

        # Validate the data as a BatchAnalyticsRequest
        try:
            request_data = BatchAnalyticsRequest(**data)
        
                
        except Exception as e:
            print(f"Validation error: {e}")
            logger.error(f"Validation error: {e}")
            logger.error(f"Received data structure: {data}")
            raise HTTPException(status_code=400, detail=str(e))

        # Process the events
        events_processed = len(request_data.events)

        # Store the events
        storage = get_storage()
        events_as_dicts = [event.model_dump() for event in request_data.events]
        success = await storage.store_events(events_as_dicts)

        if not success:
            raise HTTPException(status_code=500, detail="Failed to store events")
        
        return AnalyticsResponse(
            status="success",
            events_processed=events_processed
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