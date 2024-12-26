from typing import List, Optional
from app.models.sessions import Session
from motor.motor_asyncio import AsyncIOMotorDatabase
from logging import getLogger
from app.utils.mongo_utils import convert_uuids_to_binary, convert_binary_to_uuids, to_mongo_uuid

logger = getLogger(__name__)

class SessionsRepository:
    """Repository for managing session data in MongoDB."""
    
    COLLECTION = "sessions"  # Define collection name as a class constant

    def __init__(self, db: AsyncIOMotorDatabase):
        """Initialize the repository with a database connection.
        
        Args:
            db: AsyncIOMotorDatabase instance
        """
        self.db = db
        self.collection = self.db[self.COLLECTION]

    async def get_sessions(self, globe_id: str) -> List[Session]:
        """Get all sessions for a globe ID."""
        try:
            cursor = self.collection.find({"globe_id": globe_id})
            sessions = await cursor.to_list(length=None)
            return [Session(**session) for session in sessions]
        except Exception as e:
            logger.error(f"Error fetching sessions for globe {globe_id}: {str(e)}")
            raise

    async def get_session(self, session_id: str) -> Optional[Session]:
        """Get a single session by session ID."""
        try:
            mongo_id = to_mongo_uuid(session_id)
            result = await self.collection.find_one(
                {"session_id": mongo_id}
            )
            if not result:
                return None
            converted_result = convert_binary_to_uuids(result)
            return Session(**converted_result)
        except Exception as e:
            logger.error(f"Error fetching session {session_id}: {str(e)}")
            raise

    async def create_session(self, session: Session) -> Session:
        """Create a new session."""
        try:
            logger.debug(f"Creating session with data: {session.model_dump()}")
            session_dict = convert_uuids_to_binary(session.model_dump())
            await self.collection.insert_one(session_dict)
            return session
        except Exception as e:
            logger.error(f"Error creating session: {str(e)}")
            raise

    async def update_session(self, session_id: str, update_data: dict) -> Session:
        """Update a session with partial data."""
        try:
            logger.debug(f"Updating session {session_id} with data: {update_data}")
            result = await self.collection.find_one_and_update(
                {"session_id": session_id},
                {"$set": update_data},
                return_document=True
            )
            
            if not result:
                raise ValueError(f"Session {session_id} not found")
                
            return Session(**result)
            
        except Exception as e:
            logger.error(f"Failed to update session {session_id}: {str(e)}")
            raise

    async def delete_session(self, session_id: str):
        return await self.delete({"session_id": session_id})