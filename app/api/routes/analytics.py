# Standard library imports
from uuid import UUID
from pydantic import ValidationError
from logging import getLogger, StreamHandler, Formatter
import sys
from typing import List, Annotated
from base64 import b64decode
import gzip
# FastAPI imports
from fastapi import (
    APIRouter,
    Body,
    Depends,
    HTTPException,
    Response,
    status,
    Query,
    Request,
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

analytics_router = APIRouter(
    tags=["analytics"],
    responses={
        404: {"description": "Not found"},
        500: {"description": "Internal server error"}
    }
)

# Create a custom dependency for handling compressed analytics data
async def decompress_analytics(request: Request):
    """
    Dependency that handles decompression of analytics payloads.
    Supports both compressed (gzip + base64) and uncompressed JSON.
    """
    content_encoding = request.headers.get("Content-Encoding")
    body = await request.body()

    if content_encoding == "gzip":
        try:
            decoded_data = b64decode(body)
            decompressed_data = gzip.decompress(decoded_data)
            return AnalyticsBatch.model_validate_json(decompressed_data)
        except Exception as e:
            logger.error(f"Error decompressing analytics data: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid compressed data format"
            )
    
    # Handle uncompressed data
    return AnalyticsBatch.model_validate_json(body)

@analytics_router.post(
    "/batch",
    summary="Process analytics batch",
    description="""
    Process a batch of analytics events.
    
    The batch should contain one or more analytics events with associated metadata.
    Each event will be validated and stored in the database.
    """,
    response_description="Returns confirmation of batch processing with stored event IDs",
    response_model=AnalyticsBatchResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        201: {
            "description": "Analytics batch processed successfully",
            "model": AnalyticsBatchResponse
        },
        400: {
            "description": "Invalid batch data or empty batch"
        },
        422: {
            "description": "Validation error in event data"
        },
        500: {
            "description": "Internal server error while processing batch"
        }
    },

)
async def process_batch(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(deps.get_database),
    response: Response = Response,
) -> AnalyticsBatchResponse:
    """
    Process a batch of analytics events.
    
    Args:
        batch: Collection of analytics events to be processed (already decompressed by dependency)
        db: Database connection
        response: FastAPI response object
        
    Returns:
        AnalyticsBatchResponse containing success status and list of stored event IDs
    """

    try:
        # Get batch data (either compressed or uncompressed)
        batch = (
            await decompress_analytics(request)
            if dict(request.headers).get("content-encoding") == "gzip"
            else AnalyticsBatch.model_validate_json(await request.body())
        )

        # Validate batch is not empty
        if not batch.events:
            logger.warning("Received empty batch")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Batch must contain events",
            )

        # Convert events to dictionaries for database storage
        events = [event.model_dump() for event in batch.events]
        await db.events.insert_many(events)

        # Extract event_ids from the original batch
        event_ids = [event.event_id for event in batch.events]

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

@analytics_router.get(
    "/events",
    summary="Get analytics events",
    description="Retrieve analytics events with optional filtering by globe ID and event type",
    response_model=List[AnalyticsEvent],
    responses={
        200: {
            "description": "Successfully retrieved events",
            "model": List[AnalyticsEvent]
        },
        400: {
            "description": "Invalid globe ID format"
        },
        500: {
            "description": "Internal server error while retrieving events"
        }
    }
)
async def get_events(
    globe_id: UUID | None = Query(None, description="Filter events by globe ID"),
    event_type: str | None = Query(None, description="Filter events by event type"),
    db: AsyncIOMotorDatabase = Depends(deps.get_database),
) -> List[AnalyticsEvent]:
    """
    Retrieve analytics events with optional filtering.
    
    Args:
        globe_id: Optional UUID to filter events by globe instance
        event_type: Optional string to filter events by type
        db: Database connection
        
    Returns:
        List of matching analytics events
        
    Raises:
        HTTPException: If globe_id is invalid or retrieval fails
    """
    try:
        # Build query filters
        query_filter = {}
        if globe_id:
            query_filter["globe_id"] = globe_id
        if event_type:
            query_filter["event_type"] = event_type

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
