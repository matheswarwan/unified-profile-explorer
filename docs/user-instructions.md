# User Instructions — Unified Profile Explorer

## Getting Started

### 1. Start the app

See `deployment-instructions.md` for full setup. Quick start:

```bash
cp .env.example .env
# Edit .env: set JWT_SECRET and ENCRYPTION_KEY
docker-compose up --build
```

Open http://localhost:3000

---

## First-Time Setup

### Create your account

Go to http://localhost:3000/register and create an account. All tool users share the same annotation/pattern data — this is a team tool.

### Register a Data Cloud org

1. Go to **Orgs** in the navbar
2. Click **Register Org**
3. Fill in:
   - **Display Name**: e.g., `HealthEquity PROD`
   - **Client Name**: e.g., `HealthEquity`
   - **Instance URL**: Your org's Salesforce instance URL (e.g., `https://your-org.my.salesforce.com`)
   - **Tenant ID**: Your Data Cloud tenant ID
   - **Client ID + Secret**: From your Connected App in Salesforce Setup
4. Click **Register Org**
5. Click **Test** to verify the connection

---

## Using the Individual Lookup

1. Go to **Lookup** in the navbar
2. Select your org from the dropdown
3. Choose search type: Email, Name, or Phone
4. Enter the search value and click **Search**
5. Click a candidate to open their full profile

**Profile cards:**
- Each card represents one Data Cloud Object (DMO) related to this individual
- **Null values** are shown in muted grey — they represent data gaps, not missing fields
- Click **Raw JSON** on any card to see the unprocessed API response
- Cards with a **⚠ Team-defined** badge are from consultant-annotated linkages (not native Data Cloud joins)

---

## Using the Graph Editor

1. From the **Orgs** page, click **Graph** next to any org
2. The graph loads all DMOs and their known join paths

**Node colors:**
- **Green** — DMO is linked to the Unified Individual (traversable)
- **Yellow** — DMO exists but has no path to Unified Individual
- **Grey** — DMO is in the schema but has no data ingested

**Drawing a new linkage:**
- Click-drag from one node's handle to another to draw a new edge
- This opens the **Annotation Form** — fill in the source/target fields, join type, and rationale
- Save the annotation — it's immediately visible to all team members

**Clicking a node:**
- Opens the **Node Detail Panel** — field list, record count, existing annotations
- Click **Add Annotation** to add a note or gap flag to that DMO

**Clicking an annotated edge (dashed amber):**
- Opens the annotation form so you can edit or update the status

**Toolbar:**
- **Search DMOs** — filters visible nodes by name
- **Reachable only** — hides DMOs with no path to Unified Individual
- **Refresh** — re-introspects the org's schema from Data Cloud
- **Save Layout** — persists your node positions

---

## Annotation Types

| Type | When to use |
|------|-------------|
| **Edge** | Propose a join between two DMOs that Data Cloud doesn't map natively |
| **Node Note** | Add a free-text observation about a specific DMO |
| **Gap Flag** | Mark a DMO as having a known data gap (Info / Warning / Blocker severity) |
| **Pattern** | Same as edge, but mark as "reusable pattern" to surface it in the Pattern Library |

**Statuses:**
- **Proposed** — suggested but not yet validated in production
- **Validated** — confirmed working in the org
- **Deprecated** — no longer applicable

---

## Pattern Library

Go to **Patterns** in the navbar to browse all annotations marked as reusable patterns across all orgs.

These are firm-wide learnings — e.g., "Standard way to link Email Engagement DMO when client has no direct Individual key."

To mark an annotation as a pattern: check **Mark as reusable pattern** in the annotation form and add a pattern description.

---

## Exporting Data

From any Graph Editor page, click **Export** in the top-right:

- **Export as JSON** — all annotations for the org, machine-readable
- **Export as Markdown** — client-deliverable data model documentation

---

## Tips & Gotchas

**Connected App requirements:**
- The Connected App must have "Data Cloud" scopes enabled
- Credentials stored are encrypted AES-256 in the database — safe to register production orgs

**Query limits:**
- Fan-out profile queries are capped at 5 parallel DMO queries at a time to respect Data Cloud API rate limits

**Team-defined joins in profiles:**
- When viewing a profile, DMO cards from annotated edges show a **⚠ Team-defined** badge
- The raw SQL query is shown on error — if a team-defined join fails, the card shows the attempted query for debugging

**Shared annotations:**
- All annotations are visible to all logged-in users immediately after save
- Every edit is logged in the annotation history (who changed what, when, full diff)

**Graph layout:**
- Your node positions are saved per-org per-user — other team members have independent layouts
- Click **Save Layout** after repositioning nodes to persist your layout

---

## Troubleshooting

**"Connection test failed"**: Check that the Connected App client_id/secret are correct and that Data Cloud scopes are enabled.

**Profile shows "No records"**: The individual exists but has no data linked in that DMO — this is expected and informative (shows as a data gap).

**Graph shows all grey nodes**: The org's schema loaded but no DMOs have a traversal path to `ssot__UnifiedIndividual__dlm`. This means the org's identity resolution isn't fully configured.

**"Failed to load graph"**: Click **Refresh** in the graph toolbar to re-introspect the schema from Data Cloud.
