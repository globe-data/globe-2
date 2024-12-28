from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.models import Session, SessionData
from app.api import deps
from logging import getLogger
from datetime import datetime

logger = getLogger(__name__)

sessions_router = APIRouter(
    tags=["sessions"],
    responses={
        404: {"description": "Not found"},
        500: {"description": "Internal server error"}
    }
)

@sessions_router.post(
    "",
    response_model=Session,
    status_code=status.HTTP_201_CREATED
)
async def create_session(
    session_data: SessionData,
    db: AsyncIOMotorDatabase = Depends(deps.get_database)
):
    logger.debug(f"Received session creation request: {session_data.model_dump()}")
    try:
        session = Session(
            session_data=session_data,
            globe_id=session_data.device_data.globe_id,
            session_id=session_data.device_data.session_id
        )
        
        result = await db[Session.__collection__].insert_one(session.model_dump())
        if result.inserted_id:
            return session
            
    except Exception as e:
        logger.error(f"Error creating session: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create session"
        )

@sessions_router.patch(
    "/{session_id}",
    response_model=dict,
    status_code=status.HTTP_200_OK
)
async def update_session(
    session_id: str,
    db: AsyncIOMotorDatabase = Depends(deps.get_database)
):
    logger.debug(f"Updating session: {session_id}")
    try:
        result = await db[Session.__collection__].update_one(
            {"session_id": session_id},
            {"$set": {"end_time": datetime.utcnow()}}
        )
        
        if result.modified_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Session {session_id} not found"
            )
            
        return {"status": "success", "message": "Session ended"}
            
    except Exception as e:
        logger.error(f"Error updating session: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update session"
        )