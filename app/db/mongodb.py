from motor.motor_asyncio import AsyncIOMotorClient
from bson.codec_options import CodecOptions
from bson.binary import UuidRepresentation
from app.config.settings import settings
import asyncio
from typing import Optional

from logging import getLogger

logger = getLogger(__name__)


class MongoDB:
    client: Optional[AsyncIOMotorClient] = None

    async def connect_to_database(self, max_retries: int = 5, retry_delay: int = 5):
        """Connect to MongoDB with retries."""
        for attempt in range(max_retries):
            try:
                # Configure UUID representation
                codec_options = CodecOptions(
                    uuid_representation=UuidRepresentation.STANDARD
                )

                # Connect with codec options
                self.client = AsyncIOMotorClient(
                    settings.MONGO_URI,
                    uuidRepresentation="standard",
                    serverSelectionTimeoutMS=5000,  # 5 second timeout
                )

                # Test the connection
                await self.client.admin.command("ping")

                self.db = self.client[settings.MONGO_DB_NAME]
                self.db.events = self.db.get_collection(
                    "events", codec_options=codec_options
                )

                logger.info("Successfully connected to MongoDB")

                # Create indexes
                await self.create_indexes()
                return

            except Exception as e:
                if attempt == max_retries - 1:  # Last attempt
                    logger.error(
                        f"Failed to connect to MongoDB after {max_retries} attempts: {str(e)}"
                    )
                    raise
                else:
                    logger.warning(
                        f"Failed to connect to MongoDB (attempt {attempt + 1}/{max_retries}). Retrying in {retry_delay} seconds..."
                    )
                    await asyncio.sleep(retry_delay)

    async def close_database_connection(self):
        """Close the database connection."""
        if self.client:
            self.client.close()
            logger.info("Closed MongoDB connection")

    async def create_indexes(self):
        """Create necessary indexes."""
        try:
            # Create time-series collection for events if it doesn't exist
            collections = await self.db.list_collection_names()
            if "events" not in collections:
                await self.db.create_collection(
                    "events",
                    timeseries={
                        "timeField": "timestamp",
                        "metaField": "globe_id",
                        "granularity": "seconds",
                    },
                )
                logger.info("Created events time-series collection")

            # Create indexes
            await self.db.events.create_index("globe_id")
            await self.db.events.create_index("event_type")
            await self.db.events.create_index("timestamp")
            logger.info("Created MongoDB indexes")
        except Exception as e:
            logger.error(f"Failed to create MongoDB indexes: {str(e)}")
            raise


db = MongoDB()
