from typing import Generic, TypeVar, Type
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel

ModelType = TypeVar("ModelType", bound=BaseModel)

class BaseRepository(Generic[ModelType]):
    """Base class for MongoDB repositories."""
    
    def __init__(self, db: AsyncIOMotorDatabase, model: Type[ModelType]):
        self.db = db
        self.model = model
        self.collection_name = model.__collection__  # Define this in your models

    async def find_one(self, query: dict) -> ModelType:
        result = await self.db[self.collection_name].find_one(query)
        return self.model(**result) if result else None

    async def find_many(self, query: dict, skip: int = 0, limit: int = 100):
        cursor = self.db[self.collection_name].find(query).skip(skip).limit(limit)
        return [self.model(**doc) async for doc in cursor]

    async def create(self, data: ModelType):
        result = await self.db[self.collection_name].insert_one(data.model_dump())
        return result.inserted_id

    async def update(self, query: dict, data: dict):
        result = await self.db[self.collection_name].update_one(
            query, {"$set": data}
        )
        return result.modified_count 

    async def delete(self, query: dict):
        result = await self.db[self.collection_name].delete_one(query)
        return result.deleted_count