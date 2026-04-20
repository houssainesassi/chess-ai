# Smart Chess Board

A full-stack chess platform with real-time multiplayer, AI analysis, game history, and Arduino physical board integration.

## Architecture

### Monorepo Structure
- `artifacts/api-server/` — Node.js/Express backend (port 8080, served at `/api`)
- `artifacts/chess-board/` — React/Vite frontend (port 21592, served at `/`)
- `lib/db/` — Drizzle ORM + PostgreSQL schema
- `lib/api-spec/` — OpenAPI spec + Orval codegen
- `lib/api-client-react/` — Generated React Query hooks
- `lib/api-zod/` — Generated Zod schemas
- `arduino/` — Arduino Mega firmware for physical chess board

### Backend
- **Framework**: Express 5 + Socket.IO for real-time updates
- **Auth**: JWT-based (bcrypt passwords, `jsonwebtoken`)
- **Database**: PostgreSQL via Drizzle ORM
- **Chess Engine**: chess.js for move validation, Stockfish 18 for analysis
- **Hardware**: SerialPort for Arduino integration

### Frontend
- **Framework**: React 19 + Vite 7
- **Styling**: Tailwind CSS 4 (dark chess theme)
- **Routing**: Wouter
- **Data Fetching**: TanStack Query + generated API hooks
- **Real-time**: Socket.IO client
- **Chess**: chess.js for board rendering + move validation

## Pages
- `/` — Login/Register (JWT auth)
- `/lobby` — Game mode hub (Play Online, Play vs Robot, Friends, Leaderboard, Player Search)
- `/game` — Local AI game with Stockfish analysis
- `/game/:id` — Real-time multiplayer game via Socket.IO
- `/history` — Game history with stats (Wins/Losses/Draws/Accuracy)
- `/history/:id` — Game replay + Stockfish move analysis
- `/settings` — Account settings (avatar color picker, country, 2-step delete confirmation)
- `/profile/:userId` — Public user profile (stats, friend status, challenge button)

## API Routes (all under `/api`)
- `POST /api/auth/register` — Register with username/email/password
- `POST /api/auth/login` — Login, returns JWT
- `GET /api/auth/me` — Get current user
- `GET/POST /api/game/...` — Local game state
- `GET/POST /api/games/...` — Multiplayer game sessions
- `POST /api/analyze` — Stockfish position analysis
- `GET /api/leaderboard` — Top players ranked by wins
- `GET /api/friends` — Friends list + pending requests
- `GET/POST /api/profile` — User profile management
- `GET /api/my/games` — Current user's completed games
- `DELETE /api/account` — Delete account
- `GET /api/profiles` — All player profiles
- `GET /api/profiles/search?q=` — Search players by nickname
- `GET /api/profile/:userId` — Public profile for any user
- `POST /api/friends/request` — Send friend request
- `POST /api/friends/accept/:requestId` — Accept friend request
- `POST /api/friends/decline/:requestId` — Decline friend request
- `POST /api/challenge/:toUserId` — Challenge a user to a game (creates multiplayer game session)

## Frontend Key Files
- `src/lib/api.ts` — Centralized typed API client (all endpoints, no auto-generated hooks)
- `src/hooks/use-auth.tsx` — JWT auth context (token in localStorage)
- `src/hooks/use-socket-notifications.tsx` — Global Socket.IO listener for game invites, friend requests
- `src/components/layout.tsx` — Sidebar nav with My Profile link

## Important Notes
- Vite proxy: `/api` → `http://localhost:8080` (incl. `ws: true` for Socket.IO)
- Profile fields: `nickname` / `avatarColor` / `country` (not `username` / `rating`)
- Socket events emitted: `joinGame`, `leaveGame`, `registerUser`, `sendMessage`
- Socket events received: `roomUpdate`, `chatMessage`, `gameInvite`, `friendRequest`, `friendAccepted`
- Winner field: `white`/`black`/`draw` — compare against `whitePlayerId`/`blackPlayerId`

## Environment Variables Required
- `DATABASE_URL` — PostgreSQL connection string (auto-set by Replit DB)
- No Clerk keys needed — uses custom JWT auth

## Key Dependencies
- `chess.js` — Move validation and FEN manipulation
- `stockfish` — Server-side chess engine (18.0.7)
- `socket.io` / `socket.io-client` — Real-time game events
- `drizzle-orm` — Type-safe PostgreSQL ORM
- `framer-motion` — UI animations
