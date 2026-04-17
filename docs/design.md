# PROJECT 06 — Dynamic Unified Profile Explorer + Visual Data Model Editor

> **How to use this document**: This is a full project brief. Share it with Claude at the start of a session and say: _"Let's work on Project 06. Start with [phase/component]."_ Claude will have all context needed to design, implement, and test each piece.

---

## 1. Project Overview

### Problem Statement

Salesforce Data Cloud distributes a single customer's data across dozens of DMOs — purchase history, web interactions, loyalty records, service cases, email engagement, identity attributes, benefit elections, and more. To understand what Data Cloud actually knows about one person, a consultant today must:

- Write SQL queries across multiple DMOs manually
- Cross-reference results via Unified Individual ID
- Jump between disconnected UI screens
- Mentally stitch the picture together without a map

Worse: every client org has a completely different data model. HealthEquity's DMO structure shares nothing with PAL's. A hardcoded profile viewer is useless. The tool must discover the data model dynamically per org.

There is also no place to capture what the team has *learned* about an org's data model — which linkages are missing, which join paths are broken, which data points exist but are never connected to the Unified Individual. That institutional knowledge lives in Slack messages and people's heads.

### Solution

A web-based tool with three integrated layers:

**Layer 1 — Multi-Org Individual Lookup**
Search any registered Data Cloud org by email, name, or phone number. Resolves to a Unified Individual, then dynamically fans out across every DMO related to that individual — rendering a complete, org-aware profile card with no hardcoded assumptions about the data model.

**Layer 2 — Dynamic Profile Renderer**
Reads the org's DMO schema and field mappings at query time. Builds a structured profile view from whatever is actually mapped in that org. PAL shows loyalty tier and purchase history. HealthEquity shows HSA contributions and benefit elections. Same tool, completely different rendering — driven by the org's own metadata.

**Layer 3 — Visual Data Model Editor (the unique layer)**
Builds a visual graph of the org's DMO relationships — nodes are DMOs, edges are known join paths. Surfaces gaps: DMOs with no traversal path to the Unified Individual, data points captured but never linked. Consultants can draw new linkages in the UI, annotate them with notes and rationale, and those annotations are shared across the entire team — regardless of which org or engagement they're working on. This is a living, collaborative data model documentation layer that persists in the tool's own database and is never written back to Data Cloud.

### What Makes This Different From Anything That Exists

- Data Cloud's native UI has no single-person profile view
- The Data Graph API returns raw JSON — no visual rendering
- No tool dynamically adapts its rendering to an org's data model
- No tool captures and shares institutional knowledge about DMO gaps across a consulting team

### Target Users

- SFMC / Data Cloud consultants and architects (primary — debugging and validation during implementation)
- Implementation developers joining an active engagement (onboarding via the shared schema layer)

### Stack

- **Frontend**: Next.js (React) + TypeScript
- **Graph visualization**: React Flow (DMO graph editor)
- **Backend**: Node.js / Express API
- **Database**: PostgreSQL (org registry, schema annotations, user accounts, audit log)
- **Cache**: Redis (DMO schema cache per org, individual query results)
- **Data Cloud integration**: Data Cloud REST API (queries, schema introspection, identity resolution)
- **Auth**: JWT-based session auth for tool users
- **Deployment**: Docker Compose (self-hosted) or Vercel + Supabase (hosted)

---

## 2. Functional Requirements

### 2.1 Org Registration & Management

| # | Requirement |
|---|-------------|
| O1 | Register a Data Cloud org: name, instance URL, tenant ID, Connected App credentials (Client ID + Secret or JWT) |
| O2 | Credentials stored AES-256 encrypted in PostgreSQL — never in plaintext |
| O3 | Test connection on registration and on demand |
| O4 | List all registered orgs with last-seen status |
| O5 | Edit or remove an org |
| O6 | Per-org: store a display name, client name, and optional notes |

### 2.2 Individual Lookup

| # | Requirement |
|---|-------------|
| L1 | Search field accepts: email address, first+last name, phone number |
| L2 | User selects which org to search (dropdown of registered orgs) |
| L3 | Search resolves via Data Cloud Query API — queries the Individual or Contact Point DMOs for matching records |
| L4 | Returns a list of candidate matches with: name, email, Unified Individual ID, match confidence |
| L5 | User selects a match to open the full profile view |
| L6 | If zero results: show clear "not found" state with the query that was attempted |
| L7 | Search history: last 20 lookups per user session, stored locally |

### 2.3 Dynamic Profile Renderer

| # | Requirement |
|---|-------------|
| P1 | On profile open: fetch the org's DMO schema from cache or API |
| P2 | Identify all DMOs that have a traversal path to the resolved Unified Individual ID |
| P3 | For each reachable DMO: query records linked to this individual |
| P4 | Render one collapsible card per DMO, labeled with the DMO's display name |
| P5 | Each card shows: field name (from DMO schema), field value, field type |
| P6 | Fields with null values shown in muted style — not hidden (null = data gap, still informative) |
| P7 | Cards ordered by: Identity first, then behavioral DMOs, then transactional, then custom |
| P8 | Annotated linkages (from Layer 3) that are not in Data Cloud are shown with a distinct "team-defined" badge — data from these joins is rendered but clearly marked as consultant-annotated, not native |
| P9 | Timestamp shown for each record: when it was ingested / last updated |
| P10 | "Raw JSON" toggle per card — shows the unprocessed API response for debugging |
| P11 | Profile renders progressively — each DMO card loads independently, not waiting for all |

### 2.4 Visual Data Model Editor

| # | Requirement |
|---|-------------|
| G1 | On first load per org: introspect all DMOs and their known join paths from the Data Cloud schema API |
| G2 | Render as an interactive node graph (React Flow): DMO = node, join path = edge |
| G3 | Nodes color-coded by status: Green = linked to Unified Individual, Yellow = exists but no traversal path, Grey = in schema but no data ingested |
| G4 | Edges show join field names on hover |
| G5 | Consultants can draw a new edge between any two nodes — this opens an annotation form |
| G6 | Annotation form fields: Source DMO field, Target DMO field, Join type (inner/left), Rationale (free text), Status (Proposed / Validated / Deprecated) |
| G7 | Saved annotations are immediately visible to all tool users |
| G8 | Annotated edges visually distinct from native Data Cloud edges (dashed line, different color) |
| G9 | Clicking any node shows: DMO detail panel (field list, record count, last ingestion, data streams feeding it) |
| G10 | Clicking any edge (native or annotated) shows: join definition, who created it, when, rationale |
| G11 | Graph layout is auto-arranged on first load; user can drag nodes and layout is persisted per org per user |
| G12 | "Reset layout" button returns to auto-arranged default |
| G13 | Search/filter nodes by DMO name |
| G14 | Toggle: show only DMOs reachable from Unified Individual / show all |

### 2.5 Shared Annotation Layer

| # | Requirement |
|---|-------------|
| A1 | All annotations (edges, node notes, gap flags) stored in the tool's PostgreSQL database |
| A2 | Annotations are NOT written back to Data Cloud under any circumstances |
| A3 | Any authenticated tool user can view all annotations across all orgs |
| A4 | Any authenticated tool user can create, edit, or deprecate any annotation |
| A5 | Every annotation change is logged: who changed it, when, what changed (full diff) |
| A6 | Node-level annotations: free-text notes on a DMO node (e.g., "This DMO has stale data — ingestion broken since March") |
| A7 | Gap flags: mark a DMO as having a known gap with a severity (Info / Warning / Blocker) |
| A8 | Pattern library: annotations marked as "reusable pattern" are surfaced in a separate panel — these are firm-wide learnings applicable across orgs (e.g., "Standard way to link Email Engagement DMO when client has no direct Individual key") |
| A9 | Comment threads on any annotation — team discussion attached to a specific edge or node |
| A10 | Annotation export: download all annotations for an org as JSON or Markdown — usable as client-facing data model documentation |

---

## 3. Data Model (Tool Database — PostgreSQL)

### `orgs`
| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `display_name` | Text | e.g., "HealthEquity PROD" |
| `client_name` | Text | e.g., "HealthEquity" |
| `instance_url` | Text | Data Cloud instance URL |
| `tenant_id` | Text | Data Cloud tenant ID |
| `credentials_encrypted` | Text | AES-256 encrypted JSON blob |
| `notes` | Text | Free-form notes |
| `created_at` | Timestamp | |
| `last_tested_at` | Timestamp | Last successful connection test |
| `last_tested_status` | Text | success / failed / untested |

### `dmo_schema_cache`
| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | |
| `org_id` | UUID FK | |
| `dmo_api_name` | Text | |
| `schema_json` | JSONB | Full DMO schema from API |
| `record_count` | Integer | Last known record count |
| `cached_at` | Timestamp | |
| `ttl_minutes` | Integer | Default: 60 |

### `graph_layouts`
| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | |
| `org_id` | UUID FK | |
| `user_id` | UUID FK | |
| `layout_json` | JSONB | Node positions from React Flow |
| `updated_at` | Timestamp | |

### `annotations`
| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | |
| `org_id` | UUID FK | |
| `annotation_type` | Enum | `edge` / `node_note` / `gap_flag` / `pattern` |
| `source_dmo` | Text | Source DMO API name (for edges) |
| `target_dmo` | Text | Target DMO API name (for edges) |
| `source_field` | Text | Join field on source DMO |
| `target_field` | Text | Join field on target DMO |
| `join_type` | Text | inner / left |
| `rationale` | Text | Free-text explanation |
| `status` | Enum | `proposed` / `validated` / `deprecated` |
| `is_reusable_pattern` | Boolean | Surfaced in pattern library |
| `pattern_description` | Text | If reusable: description for other orgs |
| `severity` | Enum | `info` / `warning` / `blocker` (for gap flags) |
| `created_by` | UUID FK | |
| `created_at` | Timestamp | |
| `updated_at` | Timestamp | |

### `annotation_history`
| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | |
| `annotation_id` | UUID FK | |
| `changed_by` | UUID FK | |
| `changed_at` | Timestamp | |
| `previous_value_json` | JSONB | Full annotation state before change |
| `change_summary` | Text | Human-readable diff |

### `annotation_comments`
| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | |
| `annotation_id` | UUID FK | |
| `author_id` | UUID FK | |
| `body` | Text | Comment text |
| `created_at` | Timestamp | |

### `users`
| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | |
| `email` | Text | Login email |
| `name` | Text | Display name |
| `password_hash` | Text | bcrypt |
| `created_at` | Timestamp | |
| `last_login_at` | Timestamp | |

---

## 4. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Next.js Frontend                          │
│                                                                   │
│  ┌──────────────┐  ┌───────────────────────┐  ┌──────────────┐  │
│  │  Org Manager │  │   Individual Lookup    │  │  Graph Editor│  │
│  │  (register,  │  │   - Search form        │  │  (React Flow)│  │
│  │   test conn) │  │   - Candidate list     │  │  - DMO nodes │  │
│  └──────────────┘  │   - Profile view       │  │  - Edge draw │  │
│                    │     (dynamic cards)    │  │  - Annotate  │  │
│                    └───────────────────────┘  └──────────────┘  │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │                    Pattern Library Panel                      ││
│  │  (reusable annotations surfaced across all orgs)             ││
│  └──────────────────────────────────────────────────────────────┘│
└─────────────────────────────┬───────────────────────────────────┘
                              │ REST API calls
┌─────────────────────────────▼───────────────────────────────────┐
│                      Node.js API Server                          │
│                                                                   │
│  /api/orgs          → org CRUD + connection test                 │
│  /api/lookup        → individual search + profile assembly       │
│  /api/schema        → DMO schema introspection + graph build     │
│  /api/annotations   → CRUD for all annotation types             │
│  /api/patterns      → reusable pattern library                   │
│  /api/export        → annotation export (JSON / Markdown)        │
│                                                                   │
│  ┌──────────────────┐  ┌────────────────┐  ┌──────────────────┐ │
│  │ ProfileAssembler │  │  SchemaBuilder │  │ AnnotationStore  │ │
│  │ - resolve UI ID  │  │  - introspect  │  │ - CRUD           │ │
│  │ - fan out DMOs   │  │    DMO graph   │  │ - history log    │ │
│  │ - merge results  │  │  - cache mgmt  │  │ - pattern flag   │ │
│  └──────────────────┘  └────────────────┘  └──────────────────┘ │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │              DataCloudClient (per org, stateless)            ││
│  │  - OAuth token management (per org credentials)              ││
│  │  - query()  introspectSchema()  resolveIndividual()          ││
│  └──────────────────────────────────────────────────────────────┘│
└───────────────────┬───────────────┬─────────────────────────────┘
                    │               │
          ┌─────────▼──────┐  ┌────▼──────────┐
          │   PostgreSQL   │  │     Redis      │
          │  - orgs        │  │  - DMO schema  │
          │  - users       │  │    cache       │
          │  - annotations │  │  - token cache │
          │  - history     │  │  - query       │
          │  - comments    │  │    result cache│
          └────────────────┘  └───────────────┘
                    │
          ┌─────────▼────────────────────────────────┐
          │         Data Cloud REST API               │
          │  (one connection per registered org)      │
          └──────────────────────────────────────────┘
```

---

## 5. Key Technical Design Decisions

### 5.1 Dynamic Profile Assembly

The `ProfileAssembler` does not know the org's data model in advance. It works as follows:

```
1. Resolve search term → Unified Individual ID
   Query: SELECT Id, IndividualId FROM ssot__Individual__dlm 
          WHERE ssot__Email__c = '{email}'

2. Load org's DMO graph from SchemaBuilder (cached)

3. Traverse graph: find all DMOs reachable from Unified Individual
   - Use BFS from the Unified Individual node
   - Follow native edges (from Data Cloud schema)
   - Also follow annotated edges (from tool database, marked as team-defined)

4. For each reachable DMO:
   - Build SELECT query: all fields for records 
     where the join field = Unified Individual ID
   - Execute in parallel (Promise.allSettled — one failure 
     doesn't block others)

5. Return results: {dmoName, displayName, fields[], records[], 
                    source: 'native' | 'team-defined'}

6. Frontend renders one card per DMO, progressively as results arrive
```

### 5.2 Schema Graph Construction

```
1. Fetch all DMOs from Data Cloud schema API
2. For each DMO: fetch field list + relationship definitions
3. Build adjacency list: 
   {dmoA: [{targetDmo: dmoB, sourceField: 'X', targetField: 'Y'}]}
4. Overlay annotated edges from tool database
5. Run reachability analysis from 'ssot__UnifiedIndividual__dlm' node
6. Tag each DMO: reachable / unreachable / no-data
7. Cache full graph JSON in Redis (TTL: 60 min)
8. Return to frontend as React Flow node/edge format
```

### 5.3 Annotated Edge Execution

When the profile assembler traverses an annotated (team-defined) edge to fetch data, it builds a JOIN query:

```sql
SELECT b.*
FROM {sourceDmo} a
JOIN {targetDmo} b 
  ON a.{sourceField} = b.{targetField}
WHERE a.ssot__UnifiedIndividualId__c = '{individualId}'
```

Results rendered with a "⚠ Team-defined linkage" badge — clearly distinguishable from native Data Cloud joins. This is critical: the consultant must always know which data is confirmed by Salesforce's own mapping vs. the team's proposed join.

---

## 6. Implementation Phases

### Phase 1 — Foundation (Week 1–2)
- [ ] Next.js + Node.js project scaffold (TypeScript, monorepo)
- [ ] PostgreSQL schema: all tables from section 3
- [ ] User auth: register, login, JWT session
- [ ] Org registration UI + encrypted credential storage
- [ ] `DataCloudClient`: OAuth token management, `query()`, `introspectSchema()`
- [ ] Connection test endpoint

### Phase 2 — Individual Lookup + Basic Profile (Week 3–4)
- [ ] Search form: email / name / phone input, org selector
- [ ] `ProfileAssembler`: resolve Unified Individual ID
- [ ] Schema introspection: fetch all DMOs, build adjacency list
- [ ] Fan-out queries: parallel DMO record fetch
- [ ] Basic profile card rendering (no graph yet)
- [ ] Raw JSON toggle per card
- [ ] Progressive loading (cards appear as data returns)

### Phase 3 — Dynamic Schema Graph (Week 5–6)
- [ ] React Flow integration: render DMO nodes and native edges
- [ ] Node color-coding: reachable / unreachable / no-data
- [ ] Edge hover: show join field names
- [ ] Node click: DMO detail panel
- [ ] Graph layout persistence (per user per org in PostgreSQL)
- [ ] Search/filter nodes

### Phase 4 — Annotation Layer (Week 7–8)
- [ ] Draw edge UI: click-drag between nodes → annotation form
- [ ] Annotation form: source/target fields, join type, rationale, status
- [ ] Save annotation → PostgreSQL → broadcast to all connected clients (WebSocket or poll)
- [ ] Annotated edges: dashed line, distinct color
- [ ] Node-level notes and gap flags
- [ ] Annotation history log
- [ ] Comment threads on annotations
- [ ] Annotated edge execution in `ProfileAssembler` with team-defined badge

### Phase 5 — Pattern Library + Export (Week 9–10)
- [ ] Mark annotation as reusable pattern + pattern description
- [ ] Pattern library panel: browse patterns across all orgs
- [ ] Apply pattern to current org: pre-fills annotation form with pattern data
- [ ] Export: org annotations as JSON
- [ ] Export: org annotations as Markdown (client-deliverable data model doc)
- [ ] Export: individual profile as JSON

### Phase 6 — Hardening (Week 11–12)
- [ ] Redis caching: schema cache, token cache, query result cache
- [ ] Error handling: partial profile (some DMOs fail, rest still render)
- [ ] Large orgs: DMO graphs with 50+ nodes (layout performance)
- [ ] Docker Compose packaging
- [ ] Environment config guide

---

## 7. Testing Requirements

### Unit Tests (Jest)
- `ProfileAssembler.resolveIndividual()`: mock query responses, assert correct Unified Individual ID extracted
- `ProfileAssembler.fanOut()`: given adjacency list and individual ID, assert correct DMOs queried
- `SchemaBuilder.buildGraph()`: given mock DMO schema API response, assert correct node/edge output
- `SchemaBuilder.reachabilityAnalysis()`: test BFS from Unified Individual node with known graph
- `AnnotationStore.create/update/delete()`: assert correct DB writes and history log entries
- `DataCloudClient`: mock OAuth flow, mock query responses, assert retry on 429

### Integration Tests
- Full lookup flow: mock Data Cloud APIs → search → resolve → fan-out → assert profile shape
- Annotation flow: create edge annotation → fetch graph → assert annotated edge present
- ProfileAssembler with annotated edges: assert team-defined join executed, results tagged correctly

### Frontend Tests (Playwright E2E)
- Register an org → test connection → success state
- Search by email → select match → profile cards render
- Open graph editor → draw edge → form appears → save → edge visible on graph
- Toggle raw JSON on a profile card → JSON visible
- Export annotations → file downloaded

### Manual QA Checklist
- [ ] Register HealthEquity org → verify connection test passes
- [ ] Search by email for a known individual → verify Unified Individual resolves correctly
- [ ] Profile view: verify each DMO card shows correct field names from that org's schema
- [ ] Verify null fields shown in muted style (not hidden)
- [ ] Open graph: verify green/yellow/grey node coloring is correct
- [ ] Draw annotated edge → save → log out → log back in → edge still visible
- [ ] Second user logs in → sees the annotated edge without doing anything
- [ ] Edit someone else's annotation → verify history log records the change with correct user
- [ ] Mark annotation as reusable pattern → verify appears in Pattern Library panel
- [ ] Export org annotations as Markdown → verify readable, accurate output
- [ ] Register PAL org → verify profile view renders completely differently from HealthEquity (different DMO cards) using the same tool

---

## 8. Security Considerations

- Org credentials (Client ID, Secret, private keys) encrypted with AES-256 before PostgreSQL storage. Encryption key loaded from environment variable, never in code or DB.
- Decryption happens only at query time, in memory, never logged
- All Data Cloud queries are read-only — no write operations to any client org
- Annotated edge queries (the team-defined joins) are read-only SELECT statements — parameterized, not string-concatenated (SQL injection prevention)
- Tool user sessions: JWT with 8-hour expiry, refresh token pattern
- HTTPS enforced in production
- Audit log: every lookup (who searched, which org, which individual) logged to PostgreSQL for compliance purposes — individual IDs are hashed in the log (not raw)

---

## 9. Open Questions / Decisions Needed

1. **Data Cloud Query API limits**: Fan-out queries across many DMOs simultaneously may hit API rate limits. Need to confirm per-org query limits and implement a queue with concurrency cap (e.g., max 5 parallel DMO queries per profile load).

2. **Annotated edge query trust**: When executing a team-defined join, the system trusts the consultant's field mapping. If the mapping is wrong (wrong field names, type mismatch), the query will fail silently or return zero results. The UI should show the raw query attempted on failure so the consultant can debug it.

3. **Very large DMO graphs**: Orgs with 50+ DMOs will stress React Flow's layout engine. May need to implement clustering (group DMOs by category: Identity / Behavioral / Transactional / Custom) with expand/collapse. Decide at Phase 3.

4. **Real-time annotation sync**: When two consultants are in the graph editor simultaneously, should annotation changes appear live (WebSocket) or on refresh? WebSocket adds complexity. Recommend polling every 30 seconds for MVP, WebSocket in Phase 2.

5. **Multi-BU orgs**: Some orgs (e.g., PAL) may have multiple Business Units. Does the profile lookup span all BUs or is it scoped to one? Data Cloud is typically org-level not BU-level, but confirm.

---

## 10. Future Enhancements

- **Profile diff**: compare the same individual's profile between two orgs (e.g., sandbox vs. production) — highlight data differences
- **Segment membership overlay**: on the profile view, show which segments this individual currently belongs to
- **Timeline view**: render an individual's behavioral events (web clicks, email opens, purchases) as a chronological timeline across all DMOs
- **Integration with Project 02 (Org Auditor)**: clicking a yellow (unreachable) node in the graph launches the Auditor's DMO finding for that object
- **Integration with Project 05 (MCP Server)**: expose `get_unified_profile` and `get_dmo_graph` as MCP tools — allowing Claude to pull up this view conversationally
- **Annotation AI assist**: when drawing a new edge, suggest the most likely join fields based on field name similarity and type matching (using Claude API)