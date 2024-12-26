from fastapi import APIRouter, HTTPException, Path, Query, Depends, Body
from app.db.repositories.sessions import SessionsRepository
from app.models.sessions import Session
from typing import List
from uuid import UUID
from app.api.deps import get_sessions_repository
from logging import getLogger, StreamHandler, Formatter
import sys
from datetime import datetime, timezone
from pydantic import BaseModel
from bson import Binary

# Configure logger
logger = getLogger(__name__)
if not logger.handlers:
    handler = StreamHandler(sys.stdout)
    handler.setFormatter(Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
    logger.addHandler(handler)
    logger.setLevel("DEBUG")  # 

sessions_router = APIRouter(
    tags=["sessions"],
    responses={
        404: {"description": "Not found"},
        500: {"description": "Internal server error"}
    }
)

# Add a request model for end_session
class EndSessionRequest(BaseModel):
    end_time: datetime

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
    try:
        logger.debug(f"Attempting to create session with data: {session.model_dump(exclude_none=True)}")
        
        # Convert string UUID to MongoDB UUID format
        try:
            session_uuid = UUID(session.session_id)
            session.session_id = str(session_uuid)  # Store as string instead of Binary
        except ValueError:
            logger.error(f"Invalid session_id format: {session.session_id}")
            raise HTTPException(
                status_code=400,
                detail="Invalid session_id format - must be a valid UUID"
            )
        
        if not session.globe_id or not session.session_id:
            logger.error("Missing required fields: globe_id or session_id")
            raise HTTPException(
                status_code=400, 
                detail="Globe ID and session ID are required"
            )
        
        if not session.session_data:
            logger.error("Missing required session_data")
            raise HTTPException(
                status_code=400,
                detail="Session data is required"
            )
        
        # Validate session data components
        if not all([
            session.session_data.browser_data,
            session.session_data.device_data,
            session.session_data.network_data
        ]):
            logger.error("Incomplete session data: missing required components")
            raise HTTPException(
                status_code=400,
                detail="Session data must include browser, device, and network information"
            )

        created_session = await sessions_repository.create_session(session)
        logger.info(f"Successfully created session {session.session_id} for globe {session.globe_id}")
        
        # Ensure session_id is returned as string
        if isinstance(created_session.session_id, Binary):
            created_session.session_id = str(UUID(bytes=created_session.session_id.bytes))
            
        return created_session

    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except ValueError as e:
        logger.error(f"Validation error creating session: {str(e)}")
        raise HTTPException(
            status_code=422,
            detail=f"Invalid session data: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Failed to create session: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create session: {str(e)}"
        )

@sessions_router.patch(
    "/{session_id}",
    response_model=Session,
    status_code=200,
    summary="Update an existing session - usually to end the session",
    description="Updates an existing session with the provided session data, typically used to mark session end time",
    responses={
        200: {"description": "Session updated successfully"},
        404: {"description": "Session not found"},
        400: {"description": "Invalid update data"},
        422: {"description": "Invalid datetime format"},
        500: {"description": "Internal server error"}
    }
)
async def update_session(
    session_id: str = Path(..., description="The ID of the session to update"),
    request: EndSessionRequest = Body(..., description="The end time of the session"),
    sessions_repository: SessionsRepository = Depends(get_sessions_repository)
) -> Session:
    """Update a session, typically to mark its end time."""
    try:
        logger.debug(f"Attempting to end session {session_id} at {request.end_time}")

        # Ensure end_time is in UTC
        end_time = request.end_time.astimezone(timezone.utc)

        # Get existing session to verify it exists and isn't already ended
        existing_session = await sessions_repository.get_session(session_id)
        if not existing_session:
            logger.error(f"Session {session_id} not found")
            raise HTTPException(
                status_code=404,
                detail=f"Session {session_id} not found"
            )

        if existing_session.end_time:
            logger.warning(f"Session {session_id} was already ended at {existing_session.end_time}")
            raise HTTPException(
                status_code=400,
                detail=f"Session {session_id} was already ended"
            )

        # Update session with end time
        updated_session = await sessions_repository.update_session(
            session_id,
            {"end_time": end_time}
        )
        
        logger.info(f"Successfully ended session {session_id} at {end_time}")
        return updated_session

    except ValueError as e:
        logger.error(f"Validation error ending session: {str(e)}")
        raise HTTPException(
            status_code=422,
            detail=f"Invalid datetime format: {str(e)}"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to end session {session_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to end session: {str(e)}"
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