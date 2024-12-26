from typing import Generic, TypeVar, Type, Optional, List
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, ValidationError
from pymongo.errors import PyMongoError

ModelType = TypeVar("ModelType", bound=BaseModel)

class RepositoryError(Exception):
    """Base exception for repository errors"""
    pass

class BaseRepository(Generic[ModelType]):
    """Base class for MongoDB repositories."""
    
    def __init__(self, db: AsyncIOMotorDatabase, model: Type[ModelType]):
        if db is None:
            raise ValueError("Database connection is required")
        if model is None:
            raise ValueError("Model class is required")
            
        self.db = db
        self.model = model
        try:
            self.collection_name = model.__collection__  # Define this in your models
        except AttributeError:
            raise ValueError(f"Model {model.__name__} must define __collection__ attribute")

    async def find_one(self, query: dict) -> Optional[ModelType]:
        if not query:
            raise ValueError("Query cannot be empty")
        try:
            result = await self.db[self.collection_name].find_one(query)
            if result is None:
                return None
            return self.model(**result)
        except PyMongoError as e:
            raise RepositoryError(f"Database error: {str(e)}")

    async def find_many(self, query: dict, skip: int = 0, limit: int = 100) -> List[ModelType]:
        if not query:
            raise ValueError("Query cannot be empty")
        if skip < 0:
            raise ValueError("Skip value must be non-negative")
        if limit < 1:
            raise ValueError("Limit must be positive")
            
        try:
            cursor = self.db[self.collection_name].find(query).skip(skip).limit(limit)
            return [self.model(**doc) async for doc in cursor]
        except ValidationError as e:
            raise RepositoryError(f"Data validation error: {str(e)}")
        except PyMongoError as e:
            raise RepositoryError(f"Database error: {str(e)}")

    async def create(self, data: ModelType) -> ModelType:
        if not data:
            raise ValueError("Data cannot be empty")
        try:
            # Insert the document and get the inserted ID
            result = await self.db[self.collection_name].insert_one(data.model_dump())
            
            # Fetch the complete document we just inserted
            created_doc = await self.db[self.collection_name].find_one({"_id": result.inserted_id})
            if created_doc is None:
                raise RepositoryError("Failed to retrieve created document")
            
            # Convert MongoDB document to model instance
            # Remove the _id field as it's not part of our model
            created_doc.pop('_id', None)
            return self.model(**created_doc)
        
        except ValidationError as e:
            raise RepositoryError(f"Data validation error: {str(e)}")
        except PyMongoError as e:
            raise RepositoryError(f"Database error: {str(e)}")

    async def update(self, query: dict, data: dict):
        if not query:
            raise ValueError("Query cannot be empty")
        if not data:
            raise ValueError("Update data cannot be empty")
            
        try:
            result = await self.db[self.collection_name].update_one(
                query, {"$set": data}
            )
            return result.modified_count
        except PyMongoError as e:
            raise RepositoryError(f"Database error: {str(e)}")

    async def delete(self, query: dict):
        if not query:
            raise ValueError("Query cannot be empty")
            
        try:
            result = await self.db[self.collection_name].delete_one(query)
            return result.deleted_count
        except PyMongoError as e:
            raise RepositoryError(f"Database error: {str(e)}")