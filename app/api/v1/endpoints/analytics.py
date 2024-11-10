from fastapi import APIRouter, Request, HTTPException
from typing import Dict, Any
import gzip
import json
from app.core.logging import get_logger
from app.events.processor import EventProcessor
from app.events.schemas.events import EVENT_TYPE_MAPPING

router = APIRouter()
logger = get_logger(__name__)

@router.post("")
async def receive_analytics(request: Request) -> Dict[str, Any]:
    try:
        # Read the raw body
        body = await request.body()
        
        # Decompress gzipped data
        try:
            decompressed = gzip.decompress(body)
            # Parse JSON
            data = json.loads(decompressed.decode('utf-8'))
        except Exception as e:
            logger.error(f"Failed to decompress/parse data: {str(e)}")
            raise HTTPException(status_code=400, detail="Invalid data format")

        logger.info("Received analytics batch", extra={"batch_size": len(data)})
        return {"status": "success", "events_processed": len(data)}
        
    except Exception as e:
        logger.error(f"Error processing analytics data: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/realtime")
async def receive_realtime_event(request: Request) -> Dict[str, Any]:
    try:
        data = await request.json()
        logger.info("Received realtime event", extra={"event_type": data.get("event_type")})
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Error processing realtime event: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error") 