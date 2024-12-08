from datetime import datetime, timedelta
import uuid
import random
import json
from enum import StrEnum
from typing import List, Dict, Any

class EventTypes(StrEnum):
    PAGEVIEW = "pageview"
    CLICK = "click"
    SCROLL = "scroll"
    MEDIA = "media"
    FORM = "form"
    CONVERSION = "conversion"
    ERROR = "error"
    PERFORMANCE = "performance"
    VISIBILITY = "visibility"
    LOCATION = "location"
    TAB = "tab"
    STORAGE = "storage"
    RESOURCE = "resource"
    IDLE = "idle"

class VisibilityState(StrEnum):
    HIDDEN = "hidden"
    VISIBLE = "visible"
    PRERENDER = "prerender"
    UNLOADED = "unloaded"

def generate_events(n_events=10, start_time=None):
    if start_time is None:
        start_time = datetime.utcnow()
    
    # Base templates
    base_event = {
        "globe_id": str(uuid.uuid4()),
        "session_id": str(uuid.uuid4()),
        "event_id": None,
        "timestamp": None,
        "client_timestamp": None,
        "event_type": None
    }
    
    browser_info = {
        "user_agent": random.choice([
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        ]),
        "language": random.choice(["en-US", "en-GB", "es-ES", "fr-FR"]),
        "platform": random.choice(["MacIntel", "Win32", "iPhone", "Android"]),
        "vendor": "Google Inc.",
        "cookies_enabled": True,
        "do_not_track": random.choice([True, False]),
        "time_zone": "America/New_York",
        "time_zone_offset": -240
    }
    
    device_info = {
        "screen_resolution": {
            "width": 1920,
            "height": 1080
        },
        "color_depth": 24,
        "pixel_ratio": 2.0,
        "max_touch_points": 0,
        "memory": 16,
        "hardware_concurrency": 8,
        "device_memory": 8
    }
    
    network_info = {
        "connection_type": "wifi",
        "downlink": 10.0,
        "effective_type": "4g",
        "rtt": 50.0,
        "save_data": False,
        "anonymize_ip": True
    }

    def generate_event_data(event_type: EventTypes) -> Dict[str, Any]:
        if event_type == EventTypes.PAGEVIEW:
            return {
                "url": "https://example.com/products",
                "referrer": "https://google.com",
                "title": "Products Page",
                "path": "/products",
                "viewport": {
                    "width": 1920,
                    "height": 1080
                },
                "load_time": 1.45
            }
        elif event_type == EventTypes.CLICK:
            return {
                "element_path": "div#product-list > button.buy-now",
                "element_text": "Buy Now",
                "target": {
                    "id": "buy-button-1",
                    "class": "buy-now primary-button"
                },
                "page": {
                    "title": "Products Page",
                    "url": "https://example.com/products"
                },
                "x_pos": 567.5,
                "y_pos": 234.0,
                "href": "/checkout"
            }
        elif event_type == EventTypes.SCROLL:
            return {
                "depth": 1250.0,
                "direction": "down",
                "max_depth": 2500.0,
                "relative_depth": 50.0
            }
        elif event_type == EventTypes.MEDIA:
            return {
                "media_type": "video",
                "action": "play",
                "media_url": "https://example.com/video.mp4",
                "playback_time": 45.5,
                "duration": 180.0,
                "title": "Product Demo"
            }
        elif event_type == EventTypes.FORM:
            return {
                "form_id": "checkout-form",
                "action": "submit",
                "fields": ["email", "name", "address"],
                "success": True,
                "error_message": None
            }
        elif event_type == EventTypes.CONVERSION:
            return {
                "conversion_type": "purchase",
                "value": 99.99,
                "currency": "USD",
                "products": ["prod-123", "prod-456"]
            }
        elif event_type == EventTypes.ERROR:
            return {
                "error_type": "api_error",
                "message": "Failed to load resource",
                "stack_trace": "Error: Failed to load\n    at fetch (/app.js:123)",
                "component": "ProductList"
            }
        elif event_type == EventTypes.PERFORMANCE:
            return {
                "metric_name": "FCP",
                "value": 0.85,
                "navigation_type": "navigate",
                "effective_connection_type": "4g"
            }
        elif event_type == EventTypes.VISIBILITY:
            return {
                "visibility_state": VisibilityState.VISIBLE
            }
        elif event_type == EventTypes.LOCATION:
            return {
                "latitude": 40.7128,
                "longitude": -74.0060,
                "accuracy": 20.0,
                "country": "United States",
                "region": "New York",
                "city": "New York City",
                "timezone": "America/New_York"
            }
        elif event_type == EventTypes.TAB:
            return {
                "tab_id": str(uuid.uuid4()),
                "tab_title": "Products Page",
                "tab_url": "https://example.com/products"
            }
        elif event_type == EventTypes.STORAGE:
            return {
                "storage_type": "localStorage",
                "key": "user_preferences",
                "value": '{"theme":"dark"}'
            }
        elif event_type == EventTypes.RESOURCE:
            return {
                "resource_type": "script",
                "url": "https://example.com/app.js",
                "duration": 125.5,
                "transfer_size": 45.6,
                "compression_ratio": 0.65,
                "cache_hit": False,
                "priority": "high"
            }
        elif event_type == EventTypes.IDLE:
            return {
                "idle_time": 300.0,
                "last_interaction": "click",
                "is_idle": True
            }
    
    events = []
    current_time = start_time
    
    for i in range(n_events):
        event = base_event.copy()
        event["event_id"] = str(uuid.uuid4())
        
        # Add some random time between events
        time_increment = random.uniform(0.5, 30.0)
        current_time += timedelta(seconds=time_increment)
        
        # Server timestamp slightly after client timestamp
        client_time = current_time - timedelta(seconds=random.uniform(0.1, 0.5))
        event["timestamp"] = current_time.isoformat() + "Z"
        event["client_timestamp"] = client_time.isoformat() + "Z"
        
        # Select random event type and generate appropriate data
        event_type = random.choice(list(EventTypes))
        event["event_type"] = event_type
        event["data"] = generate_event_data(event_type)
        
        events.append(event)
    
    return {
        "events": events,
        "browser": browser_info,
        "device": device_info,
        "network": network_info
    }

# Example usage:
if __name__ == "__main__":
    # Generate 20 events starting from a specific time
    start_time = datetime.strptime("2024-03-19T10:30:00", "%Y-%m-%dT%H:%M:%S")
    data = generate_events(120, start_time)
    
    with open('generated_events.json', 'w') as f:
        json.dump(data, f, indent=2)
