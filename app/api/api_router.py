from fastapi import APIRouter
from app.api.v1.router import api_router as v1_router
from app.core.config import Settings

settings = Settings()

# Main API router
api_router = APIRouter()

# Include versioned routers
api_router.include_router(
    v1_router,
    prefix=settings.API_V1_STR
) 