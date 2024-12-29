from fastapi import APIRouter, Depends, HTTPException, status, Request
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.models import Session, SessionData
from app.api import deps
from logging import getLogger, StreamHandler, Formatter
from datetime import datetime
import sys
from pydantic import ValidationError

logger = getLogger(__name__)
if not logger.handlers:
    handler = StreamHandler(sys.stdout)
    handler.setFormatter(
        Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
    )
    logger.addHandler(handler)
    logger.setLevel("INFO")

sessions_router = APIRouter(
    tags=["sessions"],
    responses={
        404: {"description": "Not found"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
    },
)


@sessions_router.post("", response_model=Session, status_code=status.HTTP_201_CREATED)
async def create_session(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(deps.get_database)
):
    try:
        body = await request.json()
        logger.info("Raw request body:")
        logger.info(body)
        
        # Now manually validate the session data
        session = Session(**body)
        logger.info("Validated session data:")
        logger.info(session.model_dump())
        
        ip_address = request.client.host
        session.session_data.network_data.ip_address = ip_address

        try:
            result = await db[Session.__collection__].insert_one(session.model_dump())
            if result.inserted_id:
                logger.info(f"Successfully created session with ID: {session.session_id}")
                return session

        except ValidationError as e:
            logger.error(f"Validation error: {e.errors()}")
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=e.errors()
            )
        except Exception as e:
            logger.error(f"Error creating session: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create session",
            )

    except ValidationError as e:
        logger.error("Validation error details:")
        for error in e.errors():
            logger.error(f"Field: {error['loc']}, Error: {error['msg']}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=e.errors()
        )


@sessions_router.patch(
    "/{session_id}", response_model=dict, status_code=status.HTTP_200_OK
)
async def update_session(
    session_id: str, db: AsyncIOMotorDatabase = Depends(deps.get_database)
):
    logger.info(f"Updating session: {session_id}")
    try:
        result = await db[Session.__collection__].update_one(
            {"session_id": session_id}, {"$set": {"end_time": datetime.utcnow()}}
        )

        if result.modified_count == 0:
            logger.warning(f"Session {session_id} not found")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Session {session_id} not found",
            )

        logger.info(f"Successfully ended session: {session_id}")
        return {"status": "success", "message": "Session ended"}

    except HTTPException:
        # Re-raise HTTP exceptions directly
        raise
    except Exception as e:
        logger.error(f"Error updating session: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update session",
        )
