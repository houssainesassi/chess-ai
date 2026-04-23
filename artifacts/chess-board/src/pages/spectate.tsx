import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { usePreferences, type BoardTheme } from "@/hooks/use-preferences";
import { Chess } from "chess.js";
import { io, Socket } from "socket.io-client";
import { ArrowLeft, Users, Radio, Eye } from "lucide-react";

// ── Piece symbols ──────────────────────────────────────────────────────────────
const SYM: Record<string, string> = {
  P:"♙",N:"♘",B:"♗",R:"♖",Q:"♕",K:"♔",
  p:"♟",n:"♞",b:"♝",r:"♜",q:"♛",k:"♚",
};

// ── Read-only board ────────────────────────────────────────────────────────────
function SpectatorBoard({
  fen,
  lastMove,
  theme,
  flipped,
}: {
  fen: string;
  lastMove: { from: string; to: string } | null;
  theme: BoardTheme;
  flipped: boolean;
}) {
  const chess = new Chess(fen);
  const rawBoard = chess.board();
  const board = flipped ? [...rawBoard].reverse().map(r => [...r].reverse()) : rawBoard;

  const toSq = (i: number, j: number) => {
    const file = String.fromCharCode(97 + (flipped ? 7 - j : j));
    const rank = flipped ? i + 1 : 8 - i;
    return `${file}${rank}`;
  };

  return (
    <div className="w-full h-full flex flex-col border border-border rounded overflow-hidden shadow-xl">
      {board.map((row, i) => (
        <div key={i} className="flex-1 flex">
          {row.map((square, j) => {
            const light = (i + j) % 2 === 0;
            const sq = toSq(i, j);
            const lm = lastMove && (lastMove.from === sq || lastMove.to === sq);
            const pk = square ? (square.color === "w" ? square.type.toUpperCase() : square.type) : null;
            return (
              <div
                key={j}
                className="flex-1 flex items-center justify-center relative select-none"
                style={{ background: lm ? (light ? theme.lmLight : theme.lmDark) : (light ? theme.light : theme.dark) }}
              >
                {square && (
                  <span className={`text-[clamp(1.2rem,4vw,3.5rem)] leading-none drop-shadow-md select-none
                    ${square.color === "w" ? "text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]" : "text-[#1a1a1a] [text-shadow:0_1px_0_rgba(255,255,255,0.4)]"}`}>
                    {pk ? SYM[pk] : ""}
                  </span>
                )}
                {!flipped && j === 0 && <span className="absolute top-0.5 left-0.5 text-[9px] font-bold leading-none" style={{ color: light ? theme.coordOnLight : theme.coordOnDark }}>{8-i}</span>}
                {!flipped && i === 7 && <span className="absolute bottom-0.5 right-0.5 text-[9px] font-bold leading-none" style={{ color: light ? theme.coordOnLight : theme.coordOnDark }}>{String.fromCharCode(97+j)}</span>}
                {flipped && j === 7 && <span className="absolute top-0.5 right-0.5 text-[9px] font-bold leading-none" style={{ color: light ? theme.coordOnLight : theme.coordOnDark }}>{i+1}</span>}
                {flipped && i === 0 && <span className="absolute bottom-0.5 left-0.5 text-[9px] font-bold leading-none" style={{ color: light ? theme.coordOnLight : theme.coordOnDark }}>{String.fromCharCode(104-j)}</span>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Player bar ─────────────────────────────────────────────────────────────────
function PlayerBar({
  name,
  color,
  avatarColor,
  isBottom,
  turn,
}: {
  name: string;
  color: "w" | "b";
  avatarColor: string;
  isBottom: boolean;
  turn: string;
}) {
  const isActive = turn === color;
  return (
    <div className={`flex items-center gap-2.5 w-full py-1.5 px-1 ${isBottom ? "" : ""}`}>
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-white shrink-0"
        style={{ background: avatarColor }}
      >
        {name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-tight truncate">{name}</p>
        <p className="text-[11px] text-muted-foreground leading-tight">{color === "w" ? "White" : "Black"}</p>
      </div>
      {isActive && (
        <div className="w-3 h-3 rounded-full bg-[#81b64c] shadow-[0_0_6px_rgba(129,182,76,0.8)] animate-pulse shrink-0" />
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function SpectatePage() {
  const { id } = useParams();
  const { token } = useAuth();
  const [, setLocation] = useLocation();
  const { theme, playMove, playCheck, playGameEnd } = usePreferences();

  const [game, setGame] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [spectatorCount, setSpectatorCount] = useState(0);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [gameEnded, setGameEnded] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const prevFenRef = useRef<string>("");

  const loadGame = useCallback(async () => {
    if (!id) return;
    try {
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`/api/games/${id}`, { headers });
      if (!res.ok) throw new Error("Game not found");
      const data = await res.json();
      setGame(data);
      prevFenRef.current = data.fen;
    } catch {
      setError("Game not found or no longer active.");
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    loadGame();
  }, [loadGame]);

  useEffect(() => {
    if (!id) return;

    const sock = io({ path: "/api/socket.io" });

    sock.on("connect", () => {
      sock.emit("joinSpectator", { gameId: id });
    });

    sock.on("roomUpdate", (engineState: any) => {
      setGame((prev: any) => {
        if (!prev) return prev;
        if (engineState.fen && engineState.fen !== prevFenRef.current) {
          // Play sounds for spectators too
          if (engineState.isCheckmate || engineState.isDraw || engineState.isStalemate) {
            playGameEnd(false);
            setGameEnded(true);
          } else if (engineState.isCheck) {
            playCheck();
          } else {
            playMove(false);
          }
          // Extract last move from lastMove field if available
          if (engineState.lastMove) {
            setLastMove({ from: engineState.lastMove.from, to: engineState.lastMove.to });
          }
          prevFenRef.current = engineState.fen;
        }
        return { ...prev, ...engineState };
      });
    });

    sock.on("spectatorCount", ({ count }: { count: number }) => {
      setSpectatorCount(count);
    });

    sock.on("playerResigned", ({ winner }: { winner: string }) => {
      setGameEnded(true);
      setGame((prev: any) => prev ? { ...prev, status: "completed", winner } : prev);
    });

    sock.on("drawAccepted", () => {
      setGameEnded(true);
      setGame((prev: any) => prev ? { ...prev, status: "completed", winner: "draw" } : prev);
    });

    socketRef.current = sock;

    return () => {
      sock.emit("leaveSpectator", { gameId: id });
      sock.disconnect();
    };
  }, [id, playMove, playCheck, playGameEnd]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Eye className="w-8 h-8 animate-pulse" />
          <p>Loading game…</p>
        </div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center px-4">
          <p className="text-muted-foreground">{error ?? "Game not found."}</p>
          <Link href="/lobby">
            <button className="px-4 py-2 rounded bg-primary text-primary-foreground text-sm font-medium">
              Back to Lobby
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const fen = game.fen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const chess = new Chess(fen);
  const turn = chess.turn();

  const whiteName = game.whitePlayer?.nickname || "White";
  const blackName = game.blackPlayer?.nickname || "Black";
  const whiteAvatarColor = game.whitePlayer?.avatarColor || "#3b82f6";
  const blackAvatarColor = game.blackPlayer?.avatarColor || "#64748b";

  const winnerText = game.winner === "white"
    ? `${whiteName} wins`
    : game.winner === "black"
    ? `${blackName} wins`
    : game.winner === "draw"
    ? "Draw"
    : null;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <Link href="/lobby">
          <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Lobby
          </button>
        </Link>

        <div className="flex items-center gap-2">
          {!gameEnded && game.status === "active" && (
            <span className="flex items-center gap-1 text-xs font-semibold text-red-500">
              <Radio className="w-3 h-3 animate-pulse" />
              LIVE
            </span>
          )}
          {gameEnded && (
            <span className="text-xs font-medium text-muted-foreground">Game over</span>
          )}
        </div>

        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="w-3.5 h-3.5" />
          <span>{spectatorCount}</span>
        </div>
      </div>

      {/* Board area — centered, square, fills available space */}
      <div className="flex-1 flex flex-col items-center justify-center px-2 py-2 gap-1.5 min-h-0">
        {/* Black player bar (top) */}
        <div className="w-full max-w-[min(90vw,90vh-120px)]">
          <PlayerBar
            name={blackName}
            color="b"
            avatarColor={blackAvatarColor}
            isBottom={false}
            turn={turn}
          />
        </div>

        {/* Board */}
        <div
          className="w-full max-w-[min(90vw,90vh-120px)] shrink-0"
          style={{ aspectRatio: "1 / 1" }}
        >
          <SpectatorBoard
            fen={fen}
            lastMove={lastMove}
            theme={theme}
            flipped={false}
          />
        </div>

        {/* White player bar (bottom) */}
        <div className="w-full max-w-[min(90vw,90vh-120px)]">
          <PlayerBar
            name={whiteName}
            color="w"
            avatarColor={whiteAvatarColor}
            isBottom={true}
            turn={turn}
          />
        </div>
      </div>

      {/* Game-over banner */}
      {(gameEnded || game.status === "completed") && winnerText && (
        <div className="mx-3 mb-3 rounded-xl bg-card border border-border px-4 py-3 flex items-center justify-between shrink-0">
          <div>
            <p className="font-semibold text-sm">{winnerText}</p>
            <p className="text-xs text-muted-foreground">
              {game.winner === "draw" ? "The game ended in a draw" : "by checkmate or resignation"}
            </p>
          </div>
          <Link href="/lobby">
            <button className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium">
              Back
            </button>
          </Link>
        </div>
      )}

      {/* Spectators banner */}
      <div className="flex items-center justify-center gap-2 py-1.5 text-xs text-muted-foreground border-t border-border shrink-0">
        <Eye className="w-3 h-3" />
        <span>Watching live — {spectatorCount} {spectatorCount === 1 ? "spectator" : "spectators"}</span>
      </div>
    </div>
  );
}
