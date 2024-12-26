from fastapi import APIRouter, HTTPException, Path, Query
from app.db.repositories.sessions import SessionsRepository
from app.models.sessions import Session
from typing import List
from uuid import UUID

sessions_router = APIRouter(
    # prefix="/sessions",
    tags=["sessions"],
    responses={
        404: {"description": "Not found"},
        500: {"description": "Internal server error"}
    }
)

sessions_repository = SessionsRepository()

@sessions_router.post(
    "/",
    response_model=Session,
    status_code=201,
    summary="Create a new session",
    description="Creates a new analytics session with the provided session data",
    responses={
        201: {
            "description": "Session created successfully",
            "model": Session
        },
        400: {
            "description": "Invalid request data"
        }
    }
)
async def create_session(
    session: Session
) -> Session:
    """
    Create a new analytics session with the following data:
    
    - **globe_id**: Unique identifier for the globe instance
    - **session_id**: Unique identifier for this session
    - **timestamp**: When the session was created
    - **session_data**: Additional session metadata
    """
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
    summary="Get all sessions for a globe",
    description="Retrieves all analytics sessions associated with the specified globe ID",
    responses={
        200: {
            "description": "List of sessions retrieved successfully",
            "model": List[Session]
        },
        404: {
            "description": "No sessions found for the specified globe ID"
        }
    }
)
async def get_sessions(
    globe_id: UUID = Query(..., description="Unique identifier of the globe instance")
) -> List[Session]:
    """
    Retrieve all sessions for a specific globe ID
    
    - **globe_id**: UUID of the globe instance to get sessions for
    """
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