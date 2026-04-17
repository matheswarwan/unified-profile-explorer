# Unified Profile Explorer

> **Dynamic Salesforce Data Cloud profile viewer and visual data model editor for consulting teams.**

A web-based tool that lets you look up any individual across registered Data Cloud orgs, renders a complete profile from every linked DMO dynamically, and provides an interactive graph editor for mapping and annotating the org's data model — with shared team annotations that persist across sessions.

---

## The Problem

Salesforce Data Cloud distributes a single customer's data across dozens of DMOs — purchase history, web interactions, loyalty records, service cases, email engagement, identity attributes, and more. To understand what Data Cloud actually knows about one person, a consultant today must:

- Write SQL queries across multiple DMOs manually
- Cross-reference results via Unified Individual ID
- Jump between disconnected UI screens
- Mentally stitch the picture together with no visual map

Every client org has a completely different data model. A hardcoded profile viewer is useless. There is also no place to capture what the team has *learned* about an org's data model — which linkages are missing, which join paths are broken, which DMOs are never connected to the Unified Individual.

---

## What This Tool Does

### Layer 1 — Multi-Org Individual Lookup
Search any registered Data Cloud org by email, name, or phone number. Resolves to a Unified Individual, then fans out across every reachable DMO — rendering a complete, org-aware profile with no hardcoded assumptions about the data model.

### Layer 2 — Dynamic Profile Renderer
Reads the org's DMO schema at query time. Builds a structured profile view from whatever is actually mapped in that org. PAL shows loyalty tier and purchase history. HealthEquity shows HSA contributions and benefit elections. Same tool, completely different rendering — driven by the org's own metadata.

### Layer 3 — Visual Data Model Editor
Builds an interactive graph of the org's DMO relationships. Surfaces gaps: DMOs with no traversal path to the Unified Individual, data points captured but never linked. Consultants can draw new linkages, annotate them with rationale and status — and those annotations are immediately shared across the entire team.

---

## Screenshots

| Individual Lookup | Profile View |
|---|---|
| Search by email/name/phone, select from candidates | Dynamic DMO cards with field values, null gaps shown, Raw JSON toggle |

| Graph Editor | Pattern Library |
|---|---|
| Color-coded nodes (green=linked, yellow=unreachable, grey=no-data), draw edges to annotate joins | Firm-wide reusable linkage patterns across all client orgs |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router) + TypeScript |
| Graph | React Flow |
| State | Zustand + TanStack Query |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL |
| Cache | Redis (DMO schema + token cache) |
| Auth | JWT (8h expiry) |
| Deployment | Docker Compose / Vercel + Supabase |

---

## Project Structure

```
unified-profile-explorer/
├── frontend/               # Next.js 14 application
│   └── src/
│       ├── app/            # Pages: login, register, orgs, lookup, graph/[orgId], patterns
│       ├── components/     # OrgManager, ProfileView, GraphEditor, PatternLibrary
│       └── lib/            # Typed API client (axios), auth store (Zustand)
├── backend/                # Express API
│   └── src/
│       ├── routes/         # auth, orgs, lookup, schema, annotations, patterns, export
│       ├── services/       # DataCloudClient, ProfileAssembler, SchemaBuilder, AnnotationStore
│       ├── db/             # pg connection + migration runner
│       └── migrations/     # 001_initial_schema.sql
├── docker-compose.yml      # Postgres + Redis + backend + frontend
├── .env.example            # All required env vars
├── claude-work.md          # Full implementation log and architecture notes
├── deployment-instructions.md
└── user-instructions.md
```

---

## Quick Start

### Using Docker Compose

```bash
git clone <this-repo>
cd unified-profile-explorer

cp .env.example .env
# Edit .env — set JWT_SECRET and ENCRYPTION_KEY (see below)

docker-compose up --build
```

Open http://localhost:3000, register your account, and add your first Data Cloud org.

### Generating Secrets

```bash
# In your .env:
JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
```

### Local Development (without Docker)

```bash
npm install
# Ensure PostgreSQL and Redis are running locally
cp .env.example .env   # configure DATABASE_URL and REDIS_URL
npm run dev            # starts backend :4000 + frontend :3000 concurrently
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | Secret for signing JWTs (min 32 chars) |
| `ENCRYPTION_KEY` | AES-256 key for org credential encryption |
| `NEXT_PUBLIC_API_URL` | Frontend API base URL (default: `http://localhost:4000/api`) |

Full reference in `.env.example` and `deployment-instructions.md`.

---

## Key Features

### Security
- Org credentials (Client ID + Secret) encrypted AES-256 before PostgreSQL storage — key lives only in env
- All Data Cloud queries are read-only — no writes to any client org
- Annotated edge queries are parameterized (no SQL injection risk)
- JWT sessions with 8-hour expiry

### Dynamic Profile Assembly
The `ProfileAssembler` performs a BFS from `ssot__UnifiedIndividual__dlm`, discovers all reachable DMOs (including team-annotated edges), and runs parallel queries (`Promise.allSettled`) — one DMO failing doesn't block the others. Results are tagged `native` or `team-defined`.

### Schema Graph Caching
The full org graph JSON is cached in Redis with a 60-minute TTL. Refreshable on demand from the graph toolbar.

### Annotation History
Every annotation change (update, delete) is logged to `annotation_history` with a full JSON diff of the previous state, the user who changed it, and a human-readable summary.

### Export
Org annotations can be exported as:
- **JSON** — machine-readable, for pipeline tooling
- **Markdown** — client-deliverable data model documentation

---

## Database Schema

Seven tables: `users`, `orgs`, `dmo_schema_cache`, `graph_layouts`, `annotations`, `annotation_history`, `annotation_comments`.

Migrations run automatically on backend startup via `src/db/migrate.ts`.

---

## API Endpoints

```
POST   /api/auth/register
POST   /api/auth/login

GET    /api/orgs
POST   /api/orgs
GET    /api/orgs/:id
PUT    /api/orgs/:id
DELETE /api/orgs/:id
POST   /api/orgs/:id/test

POST   /api/lookup/search
POST   /api/lookup/profile

GET    /api/schema/:orgId/graph
POST   /api/schema/:orgId/refresh
POST   /api/schema/:orgId/layout

GET    /api/annotations/:orgId
POST   /api/annotations
PUT    /api/annotations/:id
DELETE /api/annotations/:id
GET    /api/annotations/:id/comments
POST   /api/annotations/:id/comments

GET    /api/patterns

GET    /api/export/:orgId/json
GET    /api/export/:orgId/markdown

GET    /api/health
```

---

## Roadmap

- [ ] Unit tests (Jest) for all service classes
- [ ] Playwright E2E tests
- [ ] WebSocket real-time annotation sync (currently: fresh fetch on load)
- [ ] DMO clustering for large graphs (50+ nodes)
- [ ] Audit log for individual lookups (hashed individual IDs for compliance)
- [ ] Profile diff: compare the same individual across two orgs
- [ ] Segment membership overlay on profile view
- [ ] Timeline view: behavioral events in chronological order across DMOs
- [ ] MCP Server integration: expose `get_unified_profile` and `get_dmo_graph` as Claude tools

---

## Contributing

All annotations and schema notes are shared across the team. To propose a new DMO linkage:

1. Open the Graph Editor for the relevant org
2. Draw an edge between the two DMO nodes
3. Fill in source/target fields, join type, and rationale
4. Set status to **Proposed**
5. Once validated in the org, update status to **Validated**

If the pattern applies to multiple orgs, check **Mark as reusable pattern** — it will appear in the Pattern Library for all users.

---

## License

MIT
