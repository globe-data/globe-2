from fastapi import APIRouter, HTTPException, Path, Query, Depends
from app.db.repositories.sessions import SessionsRepository
from app.models.sessions import Session
from typing import List
from uuid import UUID
from app.api.deps import get_sessions_repository

sessions_router = APIRouter(
    tags=["sessions"],
    responses={
        404: {"description": "Not found"},
        500: {"description": "Internal server error"}
    }
)

@sessions_router.post(
    "/",
    response_model=Session,
    status_code=201,
    summary="Create a new session",
    description="Creates a new analytics session with the provided session data"
)
async def create_session(
    session: Session,
    sessions_repository: SessionsRepository = Depends(get_sessions_repository)
) -> Session:
    """Create a new analytics session"""
    if not session.globe_id or not session.session_id:
        raise HTTPException(
            status_code=400, 
            detail="Globe ID and session ID are required"
        )
    
    if not session.session_data:
        raise HTTPException(
            status_code=400,
            detail="Session data is required"
        )
    
    if not session.timestamp:
        raise HTTPException(
            status_code=400,
            detail="Timestamp is required"
        )

    try:
        return await sessions_repository.create_session(session)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create session: {str(e)}"
        )

@sessions_router.get(
    "/",
    response_model=List[Session],
    summary="Get all sessions for a globe"
)
async def get_sessions(
    globe_id: UUID = Query(..., description="Unique identifier of the globe instance"),
    sessions_repository: SessionsRepository = Depends(get_sessions_repository)
) -> List[Session]:
    """Retrieve all sessions for a specific globe ID"""
    try:
        sessions = await sessions_repository.get_sessions(str(globe_id))
        if not sessions:
            raise HTTPException(
                status_code=404,
                detail=f"No sessions found for globe ID: {globe_id}"
            )
        return sessions
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to retrieve sessions: {str(e)}"
        )