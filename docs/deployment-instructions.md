# Deployment Instructions

## Prerequisites

- Docker + Docker Compose installed
- Node.js 18+ (for local development)
- npm 9+

---

## Option A — Docker Compose (Recommended)

### 1. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in:

```
JWT_SECRET=<generate with: openssl rand -hex 32>
ENCRYPTION_KEY=<generate with: openssl rand -hex 32>
```

All other defaults work for local Docker deployment.

### 2. Start all services

```bash
docker-compose up --build
```

This starts:
- **PostgreSQL** on port 5432 (DB: `unified_profile`, user: `postgres`, pass: `postgres`)
- **Redis** on port 6379
- **Backend API** on port 4000
- **Frontend** on port 3000

Migrations run automatically on backend startup.

### 3. Access the app

Open http://localhost:3000

Register your first account at http://localhost:3000/register

### 4. Stop

```bash
docker-compose down          # stop (keep data)
docker-compose down -v       # stop + delete database volumes
```

---

## Option B — Local Development (No Docker)

### Prerequisites

- PostgreSQL 14+ running locally
- Redis running locally

### 1. Install dependencies

```bash
npm install
```

### 2. Create local PostgreSQL database

```sql
CREATE DATABASE unified_profile;
```

### 3. Configure environment

```bash
cp .env.example .env
```

Set:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/unified_profile
REDIS_URL=redis://localhost:6379
JWT_SECRET=<any long random string>
ENCRYPTION_KEY=<32-byte hex string>
```

### 4. Run development servers

```bash
npm run dev
```

This runs backend (port 4000) and frontend (port 3000) concurrently.

Migrations run on backend startup automatically.

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `JWT_SECRET` | Yes | Secret for signing JWTs (min 32 chars) |
| `ENCRYPTION_KEY` | Yes | AES-256 key for credential encryption (32 hex bytes) |
| `PORT` | No | Backend port (default: 4000) |
| `FRONTEND_URL` | No | CORS origin for frontend (default: `*`) |
| `NODE_ENV` | No | `development` or `production` |
| `NEXT_PUBLIC_API_URL` | No | Frontend API base URL (default: `http://localhost:4000/api`) |

---

## Production Deployment (Vercel + Supabase)

### Backend on Railway / Render

1. Set all env vars in the platform dashboard
2. Build: `npm run build --workspace=backend`
3. Start: `node backend/dist/index.js`

### Frontend on Vercel

1. Set `NEXT_PUBLIC_API_URL` to your backend URL
2. Deploy the `frontend/` directory
3. Framework preset: Next.js

### Database: Supabase

1. Create a project
2. Set `DATABASE_URL` to the connection pooler URL (Transaction mode, port 6543)
3. Run migrations manually:
   ```bash
   psql $DATABASE_URL < backend/src/migrations/001_initial_schema.sql
   ```

### Cache: Redis Cloud / Upstash

Set `REDIS_URL` to the provided connection string.

---

## Generating Secrets

```bash
# JWT_SECRET
openssl rand -hex 32

# ENCRYPTION_KEY
openssl rand -hex 32
```

**Never commit these values to version control.**

---

## Health Check

```
GET http://localhost:4000/api/health
```

Returns `{"status":"ok","timestamp":"..."}` when the API is running.
