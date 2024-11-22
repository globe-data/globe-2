from fastapi import APIRouter
from app.api.v1.endpoints import analytics, privacy

api_router = APIRouter()

api_router.include_router(
    analytics.router,
    prefix="/analytics",
    tags=["analytics"]
) 

api_router.include_router(
    privacy.router,
    prefix="/privacy",
    tags=["privacy"]
) 