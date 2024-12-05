from fastapi import APIRouter, HTTPException, Body, Response, status
from app.api.models import AnalyticsBatch, AnalyticsBatchResponse
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
    response: Response = Response
) -> AnalyticsBatchResponse:
    try:
        if not batch.events:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Batch must contain events"
            )

        logger.info({
            "message": "Batch events:",
            "events": batch.events
        })

        # Return success even if some events were dropped
        response.status_code = status.HTTP_201_CREATED
        return AnalyticsBatchResponse(success=True)

    except Exception as e:
        logger.error(f"Unexpected error occurred: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred processing the analytics batch"
        )

# Make sure to export the router
__all__ = ["analytics_router"]