# Cross-Site Analytics Implementation Todolist

## ✅ Completed Components

### Core Identity System

- ✅ Basic fingerprinting implementation (see `static/js/analytics.js` lines 44-89)
- ✅ Privacy controls and GDPR/CCPA handling (see `static/ts/analytics.ts` lines 43-49)
- ✅ User context management (see `static/ts/analytics.ts` lines 5-12)

### Event Collection

- ✅ Client-side collection system (see `static/js/analytics.js` lines 96-162)
- ✅ Batch processing implementation (see `static/ts/analytics.ts` lines 617-642)
- ✅ Basic event validation (see `app/db/supabase_storage.py` lines 178-198)

### Storage Layer

- ✅ Supabase integration (see `app/db/supabase_storage.py` lines 18-54)
- ✅ Base event schema (see `app/models/events.py` lines 7-22)

## 🚧 Pending Implementation

### 1. Enhanced Identity System (Priority: High)

#### Directory: app/identity/

- [ ] `device_graph.py`: Cross-device tracking

  ```python
  class DeviceGraph:
      async def link_devices(self, identifiers: List[str], confidence: float)
      async def get_device_cluster(self, identifier: str) -> List[str]
      async def merge_profiles(self, source_id: str, target_id: str)
  ```

- [ ] `consent_manager.py`: Enhanced privacy controls
  ```python
  class ConsentManager:
      async def update_consent(self, user_id: str, consent_settings: Dict[str, bool])
      async def get_allowed_tracking(self, user_id: str) -> Set[str]
      async def validate_processing(self, event_type: str, user_context: Dict)
  ```

### 2. Data Processing Pipeline (Priority: High)

#### Directory: app/pipeline/

- [ ] `enrichment/`

  - [ ] `geo.py`: IP-based location enrichment
  - [ ] `device.py`: User agent parsing
  - [ ] `referrer.py`: Traffic source analysis

- [ ] `aggregation/`
  - [ ] `time_windows.py`: Real-time aggregations
  - [ ] `user_metrics.py`: Per-user statistics
  - [ ] `cohort_analysis.py`: Behavioral cohorts

### 3. Schema Updates (Priority: Medium)

#### Directory: app/db/migrations/

- [ ] Add device correlation tables
- [ ] Add consent tracking tables
- [ ] Add aggregation tables
- [ ] Add user profile tables

### 4. API Enhancements (Priority: Medium)

#### Directory: app/api/v1/

- [ ] Add real-time event streaming
- [ ] Add profile merging endpoints
- [ ] Add consent management endpoints
- [ ] Add aggregation query endpoints

### 5. Performance Optimizations (Priority: Low)

- [ ] Implement connection pooling
- [ ] Add query optimization
- [ ] Set up proper indexing
- [ ] Implement caching layer

## Required External Services

- ✅ Supabase
- [ ] Redis (for caching)
- [ ] TimescaleDB (for time-series)
- [ ] MaxMind GeoIP (for location data)

## Next Steps (In Order)

1. **Identity System Enhancement**

   ```python:app/identity/fingerprint.py
   class EnhancedFingerprint:
       def __init__(self):
           self.device_graph = DeviceGraph()
           self.consent_manager = ConsentManager()
   ```

2. **Data Pipeline Setup**

   ```python:app/pipeline/processor.py
   class EventProcessor:
       async def process_event(self, event: dict):
           enriched = await self.enrich_event(event)
           validated = await self.validate_consent(enriched)
           return await self.store_event(validated)
   ```

3. **Schema Migration**
   ```sql:app/db/migrations/0003_identity_enhancement.sql
   CREATE TABLE analytics.device_graph (
       device_id UUID PRIMARY KEY,
       global_user_id UUID REFERENCES analytics.identities(global_user_id),
       fingerprint_data JSONB,
       confidence_score FLOAT
   );
   ```
   User Journey & ID Relationship

---

+---------------+ +----------------+ +----------------+
| Device A | | Device B | | Device C |
| anonymous_id_1 | | anonymous_id_2 | | anonymous_id_3 |
+-------+-------+ +--------+-------+ +--------+-------+
| | |
| | |
v v v
+-------+----------------------+----------------------+-------+
| device_correlation_id |
+----------------------------------------------------------+

+----------------------------------------------------------+
| global_user_id |
+----------------------------------------------------------+
↑ ↑ ↑
| | |
+-------+-------+ +-------+-------+ +--------+-------+
| Site A | | Site B | | Site C |
| domain_user_1 | | domain_user_2 | | domain_user_3 |
+-------+-------+ +-------+-------+ +--------+-------+
| | |
+----------------------+----------------------+
|
session_chain_id_123

-- Core identity table
CREATE TABLE analytics.identities (
global_user_id UUID PRIMARY KEY,
created_at TIMESTAMPTZ DEFAULT NOW(),
last_seen_at TIMESTAMPTZ DEFAULT NOW(),
identity_status VARCHAR(50),
privacy_settings JSONB,
metadata JSONB
);

-- Device fingerprints
CREATE TABLE analytics.device_fingerprints (
anonymous_id TEXT PRIMARY KEY,
global_user_id UUID REFERENCES analytics.identities(global_user_id),
device_correlation_id UUID,
fingerprint_data JSONB,
first_seen_at TIMESTAMPTZ DEFAULT NOW(),
last_seen_at TIMESTAMPTZ DEFAULT NOW(),
confidence_score FLOAT,
is_active BOOLEAN DEFAULT TRUE
);

-- Domain-specific identities
CREATE TABLE analytics.domain_identities (
domain_user_id TEXT,
domain VARCHAR(255),
global_user_id UUID REFERENCES analytics.identities(global_user_id),
anonymous_id TEXT REFERENCES analytics.device_fingerprints(anonymous_id),
first_seen_at TIMESTAMPTZ DEFAULT NOW(),
last_seen_at TIMESTAMPTZ DEFAULT NOW(),
PRIMARY KEY (domain, domain_user_id)
);

-- Session chains
CREATE TABLE analytics.session_chains (
session_chain_id UUID PRIMARY KEY,
global_user_id UUID REFERENCES analytics.identities(global_user_id),
start_time TIMESTAMPTZ,
end_time TIMESTAMPTZ,
duration INTEGER,
site_sequence TEXT[],
device_correlation_id UUID,
metadata JSONB
);

-- Identity resolution history
CREATE TABLE analytics.identity_merges (
merge_id UUID PRIMARY KEY,
from_global_user_id UUID,
to_global_user_id UUID,
merge_reason VARCHAR(50),
confidence_score FLOAT,
merged_at TIMESTAMPTZ DEFAULT NOW(),
metadata JSONB
);

-- Create indexes
CREATE INDEX idx_device_fingerprints_global_user_id
ON analytics.device_fingerprints(global_user_id);

CREATE INDEX idx_domain_identities_global_user_id
ON analytics.domain_identities(global_user_id);

CREATE INDEX idx_session_chains_global_user_id
ON analytics.session_chains(global_user_id);

-- Create hypertable for events
SELECT create_hypertable('analytics.events', 'timestamp');

## Identity and Tracking Relationships

class BaseEvent(BaseModel): # Core Identity & Session
anonymous_id: str # Fingerprint-based identifier
global_user_id: Optional[str] # Cross-site identifier
domain_user_id: Optional[str] # Site-specific user ID
session_chain_id: str # Tracks multi-site session flows

    # Cross-Site Context
    origin_domain: str
    site_category: str  # e.g., "e-commerce", "social", "news"
    site_industry: str
    site_keywords: List[str]
    site_language: str

    # Privacy & Consent
    consent_level: str  # "full", "partial", "minimal"
    data_sharing_allowed: bool
    gdpr_region: bool
    anonymization_level: str

    # Browser State
    tab_id: str
    window_id: str
    active_tab_time: int
    background_tab_time: int
    total_tabs_open: int

    # Navigation Context
    previous_domains: List[str]  # Recent domain history
    navigation_type: str  # "direct", "link", "back_forward", "reload"
    dwell_time_previous: int
    site_exit_to: Optional[str]

    # Technical
    timestamp: datetime
    client_timestamp: datetime
    timezone: str
    time_drift: float  # Difference between client/server time

class CrossSiteNavigation(BaseEvent):
entry_point: str
exit_point: str
time_on_domain: int
domain_bounce: bool
pages_viewed: int
domain_engagement_score: float
navigation_pattern: str # e.g., "search->shop->social"
referral_chain: List[str]

class SearchBehavior(BaseEvent):
search_engine: str
search_terms: List[str]
search_category: str
result_position: int
result_page: int
vertical_search: bool # e.g., image search, news search
local_search: bool

class ContentInteraction(BaseEvent):
content_type: str # "article", "product", "video", "social"
content_category: List[str]
content_topics: List[str]
interaction_type: str
content_sentiment: Optional[float]
reading_depth: float
attention_time: int
content_language: str

class EcommerceActivity(BaseEvent):
product_viewed: Optional[str]
price_point: Optional[float]
currency: str
product_category: Optional[str]
cart_action: Optional[str]
purchase_intent_score: float
comparison_shopping: bool
price_sensitivity: float

class AdInteraction(BaseEvent):
ad_network: str
ad_type: str
ad_category: str
ad_position: str
viewability_time: int
interaction_type: str
advertiser_domain: str
campaign_id: Optional[str]

class PrivacyEvent(BaseEvent):
privacy_tool_detected: bool
cookie_status: str
tracker_blockers: List[str]
vpn_detected: bool
consent_changes: Dict[str, bool]
privacy_settings: Dict[str, Any]

class CrossPlatformSync(BaseEvent):
device_correlation_id: str
platform_type: str
cross_device_action: str
synchronized_domains: List[str]
device_switch_count: int

## Identity Resolution

class IdentitySystem: # Primary Identifiers
anonymous_id: str # Browser/device fingerprint
global_user_id: str # Cross-site persistent ID
domain_user_id: str # Site-specific ID
session_chain_id: str # Cross-site session tracking
device_correlation_id: str # Links multiple devices
tab_id: str # Browser tab instance

For the anonymous_id:
class AnonymousIdentifier:
def generate(self) -> str: # Generated from browser fingerprint components:
components = {
'canvas': self.canvas_fingerprint(),
'webgl': self.webgl_fingerprint(),
'fonts': self.font_list(),
'audio': self.audio_fingerprint(),
'plugins': self.plugin_list(),
'hardware': self.hardware_concurrency(),
'screen': self.screen_resolution()
} # Hashed to create stable identifier
return hash_components(components)

The global_user_id is generated from the anonymous_id using a cryptographic hash function.
class GlobalIdentifier:
def track(self) -> str:
identifiers = {
'anonymous_id': self.anonymous_id,
'login_hashes': self.get_login_hashes(),
'cookie_syncs': self.get_cookie_syncs(),
'device_graphs': self.get_device_graphs()
}
return self.resolve_global_identity(identifiers)

Then the session_chain_id is generated from the global_user_id and the anonymous_id.
class SessionChain:
def maintain(self) -> str:
current_chain = {
'start_timestamp': self.session_start,
'origin_site': self.entry_point,
'navigation_path': self.site_sequence,
'time_gaps': self.inter_site_gaps
}
return self.update_chain(current_chain)

    async def track_user_journey():
    """
    Example of how IDs work together during a typical user journey
    """
    # 1. User opens browser
    anonymous_id = fingerprint.generate()

    # 2. Visits first site
    session = {
        'anonymous_id': anonymous_id,
        'session_chain_id': generate_chain_id(),
        'domain_user_id': None,
        'global_user_id': resolve_global_id(anonymous_id)
    }

    # 3. User logs into Site A
    session.update({
        'domain_user_id': 'siteA_user123',
        'global_user_id': link_identities(anonymous_id, 'siteA_user123')
    })

    # 4. User navigates to Site B (with tracking script)
    session.update({
        'domain_user_id': None,  # New site, no login yet
        'session_chain_id': existing_chain_id,  # Maintains journey
        'cross_site_transition': {
            'from': 'siteA',
            'to': 'siteB',
            'timestamp': now()
        }
    })

--

class IdentityResolution:
def resolve_user(self) -> Dict[str, str]:
return {
'priority_1': self.global_user_id, # Most reliable
'priority_2': self.domain_user_id, # Site specific
'priority_3': self.anonymous_id, # Fallback
'session_context': self.session_chain_id,
'device_context': self.device_correlation_id
}

class PrivacyControls:
def apply_privacy_rules(self, user_data: Dict) -> Dict:
return {
'anonymous_id': self.hash_if_gdpr(user_data['anonymous_id']),
'global_user_id': self.tokenize_if_required(user_data['global_user_id']),
'domain_user_id': self.encrypt_for_domain(user_data['domain_user_id']),
'session_chain_id': self.temporary_token(user_data['session_chain_id'])
}
