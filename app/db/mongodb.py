from motor.motor_asyncio import AsyncIOMotorClient
from bson.codec_options import CodecOptions
from bson.binary import UuidRepresentation
from app.config import settings

class MongoDB:
    client: AsyncIOMotorClient = None

    async def connect_to_database(self):
        # Configure UUID representation
        codec_options = CodecOptions(
            uuid_representation=UuidRepresentation.STANDARD  # Use the correct enum
        )
        
        # Connect with codec options
        self.client = AsyncIOMotorClient(
            settings.MONGO_URI,
            uuidRepresentation="standard"  # This is crucial for UUID handling
        )
        self.db = self.client[settings.MONGO_DB_NAME]
        
        # Apply codec options to the events collection specifically
        self.db.events = self.db.get_collection('events', codec_options=codec_options)
        
        # Create indexes for better query performance
        await self.create_indexes()
        
    async def close_database_connection(self):
        if self.client:
            self.client.close()
            
    async def create_indexes(self):
        # Create time-series collection for events
        try:
            await self.db.create_collection(
                "events",
                timeseries={
                    "timeField": "timestamp",
                    "metaField": "globe_id",
                    "granularity": "seconds"
                }
            )
        except Exception:
            pass
            
        # Create indexes
        await self.db.events.create_index("globe_id")
        await self.db.events.create_index("event_type")
        await self.db.events.create_index("timestamp")

# Global instance
db = MongoDB() 