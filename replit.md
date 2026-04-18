# Smart Chess Board

## Overview

A full-stack smart chess platform that connects a physical Arduino-powered chessboard to a premium web UI. Features real-time internet multiplayer with Clerk authentication, PostgreSQL-backed game persistence, and Stockfish AI analysis. Players can create or join online games, or use the local board with Arduino hardware.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Authentication**: Clerk (`@clerk/express` server, `@clerk/react` client)
- **Database**: PostgreSQL via Drizzle ORM (`@workspace/db`)
- **Real-time**: Socket.IO (path: /api/socket.io)
- **Chess engine**: chess.js (server-side validation + client-side move hints)
- **AI engine**: Stockfish 18 (spawned as child process via Node.js spawn, UCI protocol over stdin/stdout)
- **Validation**: Zod, `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Architecture

### Frontend (artifacts/chess-board)
- React + Vite app at `/`
- **Clerk auth** with `ClerkProvider` wrapping `WouterRouter`; uses `Show` component for conditional rendering
- **Pages**:
  - `/` — Landing page (public); if signed in, redirects to `/lobby`
  - `/sign-in`, `/sign-up` — Clerk auth pages with `routing="path"`
  - `/lobby` — Game lobby (auth-protected); list open games, create/join games, friends panel, leaderboard
  - `/game` — Local single-player game (no auth required, Arduino-connected)
  - `/game/:id` — Multiplayer game (auth-protected)
  - `/settings` — Profile settings + danger zone (account deletion)
  - `/history` — Completed game history list for current user
  - `/history/:id` — Move-by-move game replay with Stockfish analysis panel
- Custom-built 8x8 CSS chess board with click-to-move, drag-and-drop, legal move hints, last move/check highlighting
- Board theme toggle (green classic / wooden)
- AI components: `EvalBar.tsx`, `MoveQualityBadge.tsx`, `BestMoveArrow.tsx`
- Auto-triggers Stockfish analysis on FEN change (400ms debounce)
- Chess.com-style game review panel in `Sidebar.tsx` shows coach commentary, move classification, evaluation, best-move hint, retry, and next controls after each analyzed move.

### Backend (artifacts/api-server)
- Node.js + Express server at `/api`
- **Clerk middleware**: `clerkMiddleware()` runs on all requests; `requireAuth` middleware protects routes
- **Clerk proxy**: mounted at `/api/__clerk` (production only)
- `src/lib/chess-engine.ts` — `ChessEngine` class (exported) + `chessEngine` singleton for local game
- `src/lib/game-room-manager.ts` — `GameRoomManager` singleton: manages one `ChessEngine` instance per multiplayer game (keyed by UUID)
- `src/lib/socket-server.ts` — Socket.IO server; `joinGame` event puts socket in `game:{id}` room; `broadcastRoomUpdate(gameId, state)` for multiplayer
- `src/lib/arduino-serial.ts` — serial port listener auto-detecting Arduino
- `src/lib/stockfish-service.ts` — Stockfish UCI engine
- `src/routes/game.ts` — Local game REST endpoints
- `src/routes/games.ts` — Multiplayer game REST endpoints (auth-protected)
- `src/routes/analyze.ts` — POST /api/analyze
- `src/lib/stockfish-service.ts` — returns move review metadata including played move, pre-move best move, centipawn loss, review title, and coach commentary.

### Database (lib/db)
- Drizzle ORM + `drizzle-zod`
- `chess_games` table: uuid PK, whitePlayerId, blackPlayerId (nullable), status (waiting/active/completed/abandoned), fen, winner (nullable), createdAt, updatedAt
- Game state persisted after every move

### Arduino (arduino/SmartChessBoard.ino)
- 8 74HC4051 multiplexers reading 64 reed switches
- Sends UCI move strings (e.g. "e2e4") over Serial at 9600 baud

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push-force` — push schema changes to PostgreSQL

## Replit Runtime

- Development workflows run the API on port 8080 and the web preview on port 21592.
- The web app uses `BASE_PATH=/` and proxies `/api` requests to the API server during development.

## API Endpoints

### Local Game (no auth)
- `GET /api/healthz` — health check
- `GET /api/game/state` — current local game state
- `POST /api/game/move` — make a move `{ move: "e2e4", source: "ui"|"arduino" }`
- `POST /api/game/reset` — reset game to starting position
- `POST /api/game/undo` — undo the latest local move for review retry
- `GET /api/game/legal-moves?square=e2` — get legal moves for a piece
- `GET /api/game/history` — full move history
- `POST /api/analyze` — Stockfish analysis

### Multiplayer Games (auth required where noted)
- `GET /api/games` — list open games (waiting for opponent)
- `POST /api/games` — create a new game session (auth)
- `GET /api/games/:id` — get game info + full chess state
- `POST /api/games/:id/join` — join a game as black player (auth)
- `POST /api/games/:id/move` — make a move; validates it's your turn (auth)
- `GET /api/games/:id/legal-moves?square=e2` — legal moves for a square

## Socket.IO Events

- `gameUpdate` — broadcast to all clients (local game)
- `arduinoStatus` — Arduino connection status
- `joinGame` — client emits `{ gameId }` to join a multiplayer room
- `leaveGame` — client emits `{ gameId }` to leave a room
- `roomUpdate` — server broadcasts updated `GameState` to `game:{id}` room

## Environment Variables

- `VITE_CLERK_PUBLISHABLE_KEY` — Clerk publishable key (auto-provisioned)
- `CLERK_PUBLISHABLE_KEY` — Clerk server key (auto-provisioned)
- `CLERK_SECRET_KEY` — Clerk secret key (auto-provisioned)
- `DATABASE_URL` — PostgreSQL connection string (auto-provisioned)
- `VITE_CLERK_PROXY_URL` — Clerk proxy URL (production only, set automatically)
