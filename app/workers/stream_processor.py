import faust
from events.schemas.events import EVENT_TYPE_MAPPING

app = faust.App(
    'analytics-processor',
    broker='kafka://localhost:9092'
)
