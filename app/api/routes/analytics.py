from fastapi import APIRouter, HTTPException, Body, Response, status, Request
from app.api.models import AnalyticsBatch, AnalyticsBatchResponse
from app.config import logger
import json

analytics_router = APIRouter(
    tags=["analytics"]
)

@analytics_router.post("/batch",
    summary="Process analytics batch", 
    description="Endpoint to process a batch of analytics data",
    response_description="Returns confirmation of batch model validation",
    response_model=AnalyticsBatchResponse,
    responses={
        201: {"description": "Analytics batch processed successfully"},
        400: {"description": "Invalid batch data"},
        422: {"description": "Validation error"}
    }
)
async def process_batch(
    batch: AnalyticsBatch = Body(...),
    request: Request = Request,
    response: Response = Response
):
    logger.info(f"Request IP: {request.client.host}")

    try:
        if not batch.events:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Batch must contain events"
            )

        batch_dict = batch.model_dump()
        # Convert the dict to be JSON serializable
        batch_dict = json.loads(json.dumps(batch_dict, default=str))
        logger.info(f"Received analytics batch: {json.dumps(batch_dict, indent=2)}")

        # Set status code and return response
        response.status_code = status.HTTP_201_CREATED
        return AnalyticsBatchResponse(success=True)
        
    except ValueError as e:
        logger.error(f"ValueError occurred: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Unexpected error occurred: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred processing the analytics batch"
        )

# Make sure to export the router
__all__ = ["analytics_router"]