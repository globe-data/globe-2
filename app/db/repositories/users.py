from typing import Optional
from bson import ObjectId
from app.api.models import UserInDB
from app.db.repositories.base import BaseRepository

class UserRepository(BaseRepository[UserInDB]):
    async def get_by_email(self, email: str) -> Optional[UserInDB]:
        return await self.find_one({"email": email})

    async def get_by_id(self, user_id: str) -> Optional[UserInDB]:
        return await self.find_one({"_id": ObjectId(user_id)})

    async def create_user(self, user: UserInDB) -> str:
        user_id = await self.create(user)
        return str(user_id) 