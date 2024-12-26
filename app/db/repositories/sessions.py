from app.db.repositories.base import BaseRepository
from app.models.sessions import Session
from motor.motor_asyncio import AsyncIOMotorDatabase

class SessionsRepository(BaseRepository[Session]):
    def __init__(self, db: AsyncIOMotorDatabase = None):
        super().__init__(db, Session)

    async def get_sessions(self, globe_id: str):
        return await self.find_many({"globe_id": globe_id})
    
    async def create_session(self, session: Session):
        return await self.create(session)
    
    async def update_session(self, session_id: str, data: dict):
        return await self.update({"session_id": session_id}, data)
    
    async def delete_session(self, session_id: str):
        return await self.delete({"session_id": session_id})