from motor.motor_asyncio import AsyncIOMotorDatabase
from app.db.mongodb import db

async def get_database() -> AsyncIOMotorDatabase:
    return db.db 