# Standard library imports
from uuid import UUID
from pydantic import ValidationError
from logging import getLogger, StreamHandler, Formatter
import sys

# FastAPI imports
from fastapi import (
    APIRouter,
    Body,
    Depends,
    HTTPException,
    Response,
    status,
)

# Third-party imports
from motor.motor_asyncio import AsyncIOMotorDatabase

# Local imports
from app.models import AnalyticsBatch, AnalyticsBatchResponse, AnalyticsEvent
from app.api import deps

# Configure logger
logger = getLogger(__name__)
if not logger.handlers:
    handler = StreamHandler(sys.stdout)
    handler.setFormatter(Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
    logger.addHandler(handler)
    logger.setLevel("DEBUG")  # Set appropriate level

analytics_router = APIRouter(tags=["analytics"])

# Main batch endpoint
@analytics_router.post(
    "/batch",
    summary="Process analytics batch",
    description="Endpoint to process a batch of analytics data",
    response_description="Returns confirmation of batch model validation",
    response_model=AnalyticsBatchResponse,
    responses={
        201: {"description": "Analytics batch processed successfully"},
        400: {"description": "Invalid batch data"},
        422: {"description": "Validation error"},
    },
)
async def process_batch(
    batch: AnalyticsBatch = Body(...),
    db: AsyncIOMotorDatabase = Depends(deps.get_database),
    response: Response = Response,
) -> AnalyticsBatchResponse:
    try:
        if not batch.events:
            logger.warning("Received empty batch")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Batch must contain events",
            )

        # Convert events to dict and store in MongoDB
        events = [event.model_dump() for event in batch.events]
        result = await db.events.insert_many(events)

        # Extract event_ids from the original events since MongoDB ObjectIds can't be converted to UUIDs
        event_ids = [event.event_id for event in batch.events]
        logger.debug(f"Stored {len(event_ids)} events")

        response.status_code = status.HTTP_201_CREATED
        return AnalyticsBatchResponse(
            success=True, events_stored=event_ids
        )

    except ValidationError as e:
        logger.error(f"Validation error: {e.errors()}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=e.errors()
        )
    except Exception as e:
        logger.error(f"Error saving batch: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred processing the analytics batch",
        )


@analytics_router.get("/events")
async def get_events(
    globe_id: UUID | None = None,
    event_type: str | None = None,
    db: AsyncIOMotorDatabase = Depends(deps.get_database),
) -> list[AnalyticsEvent]:
    try:
        # Build query filters
        query_filter = {}
        if globe_id:
            query_filter["globe_id"] = globe_id
        if event_type:
            query_filter["event_type"] = event_type

        # Rest of the code stays the same...

        # Execute query with combined filter and projection
        events = await db.events.find(
            filter=query_filter, projection={"_id": 0}
        ).to_list(length=None)

        return events

    except ValueError as e:
        logger.error(f"Invalid UUID format: {str(e)}")
        raise HTTPException(
            status_code=400, detail="Invalid globe_id format - must be a valid UUID"
        )
    except Exception as e:
        logger.error(f"Error getting events: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to retrieve events")


__all__ = ["analytics_router"]
