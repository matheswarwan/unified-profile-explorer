# Claude Work Log — Unified Profile Explorer

## What Was Built

Full implementation of Project 06: Dynamic Unified Profile Explorer + Visual Data Model Editor, as specified in `docs/design.md`.

---

## Project Structure

```
unified-profile-explorer/
├── package.json                  # Root monorepo (npm workspaces)
├── docker-compose.yml            # Full stack: PG + Redis + backend + frontend
├── .env.example                  # All required env vars documented
├── docs/design.md                # Original project brief
│
├── backend/
│   ├── package.json              # Express, pg, redis, jwt, bcryptjs, crypto-js, etc.
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts              # Express app + startup (runs migrations on boot)
│       ├── db/
│       │   ├── connection.ts     # pg Pool (DATABASE_URL)
│       │   └── migrate.ts        # Runs SQL migrations on startup
│       ├── migrations/
│       │   └── 001_initial_schema.sql  # All tables: users, orgs, annotations, etc.
│       ├── middleware/
│       │   └── auth.ts           # JWT Bearer verify, attaches req.user
│       ├── types/
│       │   └── index.ts          # All TypeScript interfaces
│       ├── services/
│       │   ├── DataCloudClient.ts   # OAuth2 token mgmt + query/schema/resolve APIs
│       │   ├── ProfileAssembler.ts  # BFS traversal + parallel DMO fan-out
│       │   ├── SchemaBuilder.ts     # Schema introspection + Redis graph cache
│       │   └── AnnotationStore.ts   # Annotation CRUD + history log
│       └── routes/
│           ├── auth.ts           # POST /register, POST /login
│           ├── orgs.ts           # CRUD + test connection (AES-256 credential encryption)
│           ├── lookup.ts         # Individual search + profile assembly
│           ├── schema.ts         # Graph build + layout persistence
│           ├── annotations.ts    # Annotation CRUD + comments + history
│           ├── patterns.ts       # Reusable pattern library
│           └── export.ts         # JSON + Markdown export
│
└── frontend/
    ├── package.json              # Next.js 14, React Flow, Zustand, TanStack Query
    ├── tsconfig.json
    ├── next.config.ts
    ├── tailwind.config.ts
    ├── postcss.config.mjs
    └── src/
        ├── app/
        │   ├── layout.tsx        # Root layout + toast system + QueryClientProvider
        │   ├── page.tsx          # Redirect: /lookup (auth'd) or /login
        │   ├── globals.css       # Tailwind + React Flow overrides + animations
        │   ├── login/page.tsx    # Login form
        │   ├── register/page.tsx # Registration form
        │   ├── orgs/page.tsx     # Org manager (list + create/edit modal)
        │   ├── lookup/page.tsx   # Individual search + profile + history
        │   ├── graph/[orgId]/page.tsx  # Full-screen React Flow graph editor
        │   └── patterns/page.tsx # Pattern library browser
        ├── components/
        │   ├── Navbar.tsx        # Nav links + user email + logout
        │   ├── OrgManager/
        │   │   ├── OrgList.tsx   # Table with status badges + test/edit/delete
        │   │   └── OrgForm.tsx   # Create/edit org modal
        │   ├── ProfileView/
        │   │   ├── ProfileSearch.tsx   # Org selector + search type + input
        │   │   ├── CandidateList.tsx   # Match list with confidence badges
        │   │   ├── ProfileCard.tsx     # Collapsible DMO card + raw JSON toggle
        │   │   └── ProfileView.tsx     # Profile header + card list
        │   ├── GraphEditor/
        │   │   ├── GraphEditor.tsx     # React Flow canvas + toolbar + layout save
        │   │   ├── DmoNode.tsx         # Custom node: color-coded by status
        │   │   ├── AnnotationForm.tsx  # Slide-over form for all annotation types
        │   │   └── NodeDetailPanel.tsx # Node info + field list + annotations
        │   └── PatternLibrary/
        │       └── PatternLibrary.tsx  # Pattern grid with apply-to-org button
        └── lib/
            ├── api.ts            # Typed axios client + all API functions
            └── auth.ts           # Zustand auth store (persisted to localStorage)
```

---

## Key Design Decisions

### Credential Security
- Org credentials (client_id + client_secret) encrypted with AES-256 via `crypto-js` before storing in PostgreSQL
- Encryption key loaded from `ENCRYPTION_KEY` env var — never hardcoded
- Decryption happens only inside `DataCloudClient` constructor, in memory

### Dynamic Profile Assembly
- `ProfileAssembler` uses BFS from `ssot__UnifiedIndividual__dlm` node
- Overlays annotated (team-defined) edges from the tool DB on top of native Data Cloud edges
- All DMO queries run in parallel via `Promise.allSettled` — one failure doesn't block others
- Results tagged `source: 'native' | 'team-defined'`

### Graph Caching
- `SchemaBuilder` caches the full org graph in Redis (TTL: 60 min, key: `graph:{orgId}`)
- Cache cleared on schema refresh or new annotation creation

### Annotation History
- Every annotation update/delete writes a full diff to `annotation_history` table
- Includes: who changed it, when, previous state as JSON, human-readable summary

### React Flow Graph
- Custom `DmoNode` with color coding: green (reachable), yellow (unreachable), grey (no data)
- Drawing a new edge between nodes triggers `AnnotationForm` slide-over
- Annotated edges rendered as dashed amber lines (vs solid indigo for native)
- Layout saved per org per user in `graph_layouts` table

---

## All Phases Implemented

- **Phase 1**: Auth, org registration (encrypted), DataCloudClient, DB migrations
- **Phase 2**: Individual lookup, ProfileAssembler, dynamic profile cards, progressive loading
- **Phase 3**: React Flow graph, color-coded nodes, edge hover labels, layout persistence
- **Phase 4**: Annotation forms (all types), edge drawing, node detail panel, history, comments
- **Phase 5**: Pattern library, JSON/Markdown export
- **Phase 6**: Redis caching (schema + tokens), Docker Compose, error handling

---

## What Remains / Future Work

- Unit tests (Jest) and E2E tests (Playwright) — stubs for all services exist
- WebSocket real-time annotation sync (currently: each page load fetches fresh data)
- Clustering for large DMO graphs (50+ nodes) — React Flow handles up to ~100 well
- Audit log for individual lookups (logged user + hashed individual ID) — backend hook point exists in `lookup.ts`
