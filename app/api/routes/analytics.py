from fastapi import APIRouter, Request
from config import logger
import json
analytics_router = APIRouter(
    tags=["analytics"]
)

@analytics_router.post("/batch", 
    summary="Process analytics batch",
    description="Endpoint to process a batch of analytics data",
    response_description="Returns confirmation of batch processing"
)
async def process_batch(request: Request):
    data = await request.json()
    
    # Create summary of the analytics batch
    summary = {
        "total_events": len(data.get("events", [])),
        "event_types": {},
        "session_summary": {},
        "browser_info": {
            "platform": data.get("browser", {}).get("platform"),
            "language": data.get("browser", {}).get("language"),
        },
        "device_info": {
            "screen_resolution": data.get("device", {}).get("screen_resolution"),
            "device_memory": f"{data.get('device', {}).get('device_memory')}GB",
            "connection_type": data.get("network", {}).get("connection_type")
        }
    }
    
    # Analyze events
    for event in data.get("events", []):
        # Count event types
        event_type = event.get("event_type")
        summary["event_types"][event_type] = summary["event_types"].get(event_type, 0) + 1
        
        # Track session activity
        session_id = event.get("session_id")
        if session_id not in summary["session_summary"]:
            summary["session_summary"][session_id] = {
                "globe_id": event.get("globe_id"),
                "event_count": 0,
                "first_event": event.get("timestamp"),
                "last_event": event.get("timestamp")
            }
        
        session = summary["session_summary"][session_id]
        session["event_count"] += 1
        session["last_event"] = max(session["last_event"], event.get("timestamp"))

    logger.info(f"Processed batch with {summary['total_events']} events")
    return summary

# Make sure to export the router
__all__ = ["analytics_router"]