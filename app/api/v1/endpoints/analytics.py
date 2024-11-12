from fastapi import APIRouter, Request, HTTPException
from app.models.api_models import BatchAnalyticsRequest, BatchAnalyticsResponse
import json
import logging
import sys
from typing import Dict, Any

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

@router.post("/batch", response_model=BatchAnalyticsResponse)
async def receive_analytics(request: Request) -> BatchAnalyticsResponse:
    """
    Receive a batch of analytics events.
    """
    # Force print for debugging
    print("\n=== NEW ANALYTICS REQUEST ===")
    
    try:
        body = await request.body()
        body_str = body.decode()
        
        # Force print the raw body
        print(f"Raw body: {body_str}")
        logger.debug(f"Raw body received: {body_str}")
        
        try:
            data = json.loads(body_str)
            # Force print the parsed data
            print(f"Parsed data: {json.dumps(data, indent=2)}")
            logger.info(f"Parsed JSON data: {json.dumps(data, indent=2)}")
        except json.JSONDecodeError as e:
            print(f"JSON decode error: {e}")
            logger.error(f"JSON decode error: {e}")
            raise HTTPException(status_code=400, detail="Invalid JSON format")

        try:
            request_data = BatchAnalyticsRequest(**data)
            event_count = len(request_data.events)
            print(f"Validated {event_count} events")
            logger.info(f"Validated {event_count} events")
            
            # Print each event for debugging
            for idx, event in enumerate(request_data.events):
                print(f"Event {idx + 1}: {event.dict()}")
                logger.debug(f"Event {idx + 1}: {event.dict()}")
                
        except Exception as e:
            print(f"Validation error: {e}")
            logger.error(f"Validation error: {e}")
            logger.error(f"Received data structure: {data}")
            raise HTTPException(status_code=400, detail=str(e))

        # Process the events
        events_processed = len(request_data.events)
        print(f"Successfully processed {events_processed} events")
        logger.info(f"Successfully processed {events_processed} events")
        
        return BatchAnalyticsResponse(
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