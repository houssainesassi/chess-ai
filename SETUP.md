# Smart Chess Board — Setup Guide

## What is this app?

A full-stack chess platform that supports local play with Stockfish AI analysis, online multiplayer, and optional physical Arduino board integration.

---

## Running Locally

### 1. Prerequisites

- **Node.js** v20+
- **pnpm** v9+ — install with: `npm install -g pnpm`
- **PostgreSQL** — a running database instance

### 2. Clone and install dependencies

```bash
git clone <your-repo-url>
cd smart-chess-board
pnpm install
```

### 3. Set up environment variables

Create a file called `.env` in the **root** of the project with the following:

```env
# ── Database ──────────────────────────────────────────────
DATABASE_URL=postgresql://user:password@localhost:5432/chess

# ── Clerk Authentication ───────────────────────────────────
# Get these from https://dashboard.clerk.com → API Keys
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# ── Server ────────────────────────────────────────────────
PORT=8080
```

> The frontend Vite server reads any variable prefixed with `VITE_`.
> The API server reads `CLERK_SECRET_KEY` and `DATABASE_URL`.

### 4. Set up the database schema

```bash
pnpm --filter @workspace/db run push-force
```

### 5. Start the app

Open two terminals:

**Terminal 1 — API server (port 8080):**
```bash
pnpm --filter @workspace/api-server run dev
```

**Terminal 2 — Frontend (port 5173):**
```bash
pnpm --filter @workspace/chess-board run dev
```

Then open `http://localhost:5173` in your browser.

### 6. Arduino (optional)

Connect your Arduino via USB before starting the API server. It will be detected automatically — no extra config needed.

---

## Deploying to Vercel

> Note: Vercel is designed for static frontends and serverless functions. This app uses a stateful Express server with WebSockets (Socket.IO), which **does not run on Vercel's serverless runtime**. The recommended deployment approach is to split the two parts:

### Recommended architecture

| Part | Deploy to |
|------|-----------|
| **Frontend** (`chess-board`) | Vercel |
| **API server** (`api-server`) | Railway, Render, Fly.io, or a VPS |
| **Database** | Neon, Supabase, or Railway PostgreSQL |

---

### Step 1 — Deploy the API server (e.g. Railway)

1. Create a new project on [Railway](https://railway.app) and connect your repo.
2. Set the root directory to `artifacts/api-server`.
3. Add these environment variables in Railway's dashboard:

```
DATABASE_URL=<your production postgres URL>
CLERK_SECRET_KEY=sk_live_...
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
NODE_ENV=production
PORT=8080
```

4. Railway will detect the `package.json` and run the `start` script automatically.
5. Note your Railway public URL (e.g. `https://api.yourapp.railway.app`).

---

### Step 2 — Deploy the frontend to Vercel

1. Import your repo into [Vercel](https://vercel.com).
2. Set the **Root Directory** to `artifacts/chess-board`.
3. Set the **Build Command** to `pnpm build` and **Output Directory** to `dist`.
4. Add these environment variables in Vercel's dashboard:

```
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
VITE_API_URL=https://api.yourapp.railway.app
```

5. Deploy — Vercel will serve the built React app as a static site.

---

### Step 3 — Configure Clerk for production

1. Go to your [Clerk Dashboard](https://dashboard.clerk.com).
2. Create a **Production** instance (separate from your dev instance).
3. Under **Domains**, add:
   - Your Vercel frontend URL (e.g. `https://chess.vercel.app`)
4. Copy the **production** publishable and secret keys and use `pk_live_` / `sk_live_` values in your deployment env vars.

---

## Environment Variable Reference

| Variable | Where used | Required | Description |
|---|---|---|---|
| `DATABASE_URL` | API server | Yes | PostgreSQL connection string |
| `CLERK_SECRET_KEY` | API server | Yes | Clerk secret key for token verification |
| `VITE_CLERK_PUBLISHABLE_KEY` | Frontend + API server | Yes | Clerk publishable key |
| `PORT` | API server | Yes | Port the HTTP server listens on |
| `NODE_ENV` | API server | No | Set to `production` in prod |
| `LOG_LEVEL` | API server | No | Pino log level (default: `info`) |
