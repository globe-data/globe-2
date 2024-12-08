from motor.motor_asyncio import AsyncIOMotorDatabase
from db.mongodb import db

async def get_database() -> AsyncIOMotorDatabase:
    return db.db 