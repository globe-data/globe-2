from fastapi import APIRouter, HTTPException, Body, Response, status, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.api.models import AnalyticsBatch, AnalyticsBatchResponse
from app.api.deps import get_database
from app.config import logger

analytics_router = APIRouter(
    tags=["analytics"]
)

@analytics_router.post("/batch",
    summary="Process analytics batch", 
    description="Endpoint to process a batch of analytics data",
    response_description="Returns confirmation of batch model validation",
    # response_model=AnalyticsBatchResponse,
    responses={
        201: {"description": "Analytics batch processed successfully"},
        400: {"description": "Invalid batch data"},
        422: {"description": "Validation error"}
    }
)
async def process_batch(
    batch: AnalyticsBatch = Body(...),
    db: AsyncIOMotorDatabase = Depends(get_database),
    response: Response = Response
) -> AnalyticsBatchResponse:
    try:
        if not batch.events:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Batch must contain events"
            )

        # Convert events to dict and store in MongoDB
        events = [event.model_dump() for event in batch.events]
        result = await db.events.insert_many(events)

        logger.info(f"Stored {len(result.inserted_ids)} events")
        
        response.status_code = status.HTTP_201_CREATED
        return AnalyticsBatchResponse(success=True)

    except Exception as e:
        logger.error(f"Unexpected error occurred: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred processing the analytics batch"
        )
    
@analytics_router.get("/collections",
    response_model=list[str],
    summary="Get available collections",
    description="Returns a list of available collections in the database"
)
async def get_collections(
    db: AsyncIOMotorDatabase = Depends(get_database)
) -> list[str]:
    try:
        # Return collections as a simple list instead of a dict
        collections = await db.list_collection_names()
        logger.info(f"\nCollections: {collections}")
        return collections

    except Exception as e:
        logger.error(f"Error getting collections: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve collections"
        )

__all__ = ["analytics_router"]