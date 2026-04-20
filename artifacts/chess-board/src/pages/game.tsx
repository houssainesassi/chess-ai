import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { api, type LocalGameState, type LocalMove } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Chess } from "chess.js";
import { ArrowLeft, Flag, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

const PIECE_SYMBOLS: Record<string, string> = {
  P: "♙", N: "♘", B: "♗", R: "♖", Q: "♕", K: "♔",
  p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚",
};

function ChessBoard({ fen, onMove }: { fen: string; onMove: (from: string, to: string) => void }) {
  const chess = new Chess(fen);
  const board = chess.board();
  const [selected, setSelected] = useState<string | null>(null);
  const [legalTargets, setLegalTargets] = useState<string[]>([]);

  const handleClick = (sq: string) => {
    if (selected) {
      if (legalTargets.includes(sq)) {
        onMove(selected, sq);
      }
      setSelected(null);
      setLegalTargets([]);
    } else {
      const piece = chess.get(sq as any);
      if (piece && piece.color === chess.turn()) {
        setSelected(sq);
        const moves = chess.moves({ square: sq as any, verbose: true });
        setLegalTargets(moves.map((m: any) => m.to));
      }
    }
  };

  return (
    <div className="w-full max-w-md aspect-square flex flex-col border-2 border-border rounded overflow-hidden shadow-lg">
      {board.map((row, i) => (
        <div key={i} className="flex-1 flex">
          {row.map((square, j) => {
            const isLight = (i + j) % 2 === 0;
            const file = String.fromCharCode(97 + j);
            const rank = 8 - i;
            const sq = `${file}${rank}`;
            const isSelected = selected === sq;
            const isTarget = legalTargets.includes(sq);
            const pieceKey = square
              ? square.color === "w"
                ? square.type.toUpperCase()
                : square.type.toLowerCase()
              : null;

            return (
              <div
                key={j}
                onClick={() => handleClick(sq)}
                className={`flex-1 flex items-center justify-center cursor-pointer relative select-none transition-colors
                  ${isLight ? "bg-[#f0d9b5]" : "bg-[#b58863]"}
                  ${isSelected ? "!bg-yellow-400/70" : ""}
                  ${isTarget && !square ? "after:absolute after:inset-[35%] after:rounded-full after:bg-black/20" : ""}
                  ${isTarget && square ? "!ring-2 !ring-inset !ring-yellow-400/80" : ""}
                `}
              >
                {square && (
                  <span
                    className={`text-[clamp(1rem,4.5vw,2.5rem)] leading-none drop-shadow-md select-none
                      ${square.color === "w" ? "text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]" : "text-[#1a1a1a] [text-shadow:0_1px_0_rgba(255,255,255,0.3)]"}`}
                  >
                    {pieceKey ? PIECE_SYMBOLS[pieceKey] : ""}
                  </span>
                )}
                {j === 0 && (
                  <span className={`absolute top-0.5 left-0.5 text-[9px] font-bold ${isLight ? "text-[#b58863]" : "text-[#f0d9b5]"}`}>{rank}</span>
                )}
                {i === 7 && (
                  <span className={`absolute bottom-0 right-0.5 text-[9px] font-bold ${isLight ? "text-[#b58863]" : "text-[#f0d9b5]"}`}>{file}</span>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default function GamePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [gameState, setGameState] = useState<LocalGameState | null>(null);
  const [moveHistory, setMoveHistory] = useState<LocalMove[]>([]);
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [state, history] = await Promise.all([api.getGameState(), api.getGameHistory()]);
      setGameState(state);
      setMoveHistory(history.moves || []);
    } catch (err) {
      toast({ title: "Failed to load game state", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, []);

  const handleMove = async (from: string, to: string) => {
    if (moving || gameState?.status !== "playing") return;
    setMoving(true);
    try {
      const state = await api.localMove(`${from}${to}`);
      setGameState(state);
      await refresh();
    } catch (_) {
      toast({ title: "Invalid move", variant: "destructive" });
    } finally {
      setMoving(false);
    }
  };

  const handleUndo = async () => {
    try {
      const state = await api.undoMove();
      setGameState(state);
      await refresh();
    } catch (_) {
      toast({ title: "Cannot undo", variant: "destructive" });
    }
  };

  const handleResign = async () => {
    try {
      await api.resetGame();
      setLocation("/lobby");
    } catch (_) {}
  };

  if (loading || !gameState) {
    return <div className="p-8 text-center text-muted-foreground">Loading game...</div>;
  }

  const chess = new Chess(gameState.fen);
  const isPlayerTurn = chess.turn() === "w";

  const statusText = gameState.isCheckmate
    ? "Checkmate!"
    : gameState.isDraw
    ? "Draw!"
    : gameState.isCheck
    ? "Check!"
    : isPlayerTurn
    ? "Your turn"
    : "AI thinking...";

  const statusColor = gameState.isCheckmate
    ? "destructive"
    : gameState.isDraw
    ? "secondary"
    : gameState.isCheck
    ? "destructive"
    : isPlayerTurn
    ? "default"
    : "secondary";

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 flex flex-col items-center space-y-3">
        <div className="w-full max-w-md flex justify-between items-center bg-card p-3 rounded-lg border border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-purple-500/20 text-purple-500 rounded-full flex items-center justify-center font-bold text-sm">AI</div>
            <div>
              <div className="font-bold text-sm">Stockfish</div>
              <div className="text-xs text-muted-foreground">Computer</div>
            </div>
          </div>
          <Badge variant="secondary">Black</Badge>
        </div>

        <ChessBoard fen={gameState.fen} onMove={handleMove} />

        <div className="w-full max-w-md flex justify-between items-center bg-card p-3 rounded-lg border border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary/20 text-primary rounded-full flex items-center justify-center font-bold text-sm">
              {(user?.username || "Y").charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-bold text-sm">{user?.username || "You"}</div>
              <div className="text-xs text-muted-foreground">White</div>
            </div>
          </div>
          <Badge variant={statusColor as any}>{statusText}</Badge>
        </div>
      </div>

      <div className="space-y-4">
        <Card className="bg-card border-border flex flex-col" style={{ height: "500px" }}>
          <div className="p-4 border-b border-border flex justify-between items-center shrink-0">
            <h3 className="font-bold">Move History</h3>
            <span className="text-xs text-muted-foreground">{Math.ceil(moveHistory.length / 2)} moves</span>
          </div>
          <div className="flex-1 overflow-auto p-3">
            {moveHistory.length > 0 ? (
              <div className="text-sm font-mono space-y-0.5">
                {Array.from({ length: Math.ceil(moveHistory.length / 2) }).map((_, i) => {
                  const white = moveHistory[i * 2];
                  const black = moveHistory[i * 2 + 1];
                  return (
                    <div key={i} className="flex gap-1 hover:bg-muted/50 px-1 rounded">
                      <span className="w-7 text-muted-foreground text-right">{i + 1}.</span>
                      <span className="flex-1 font-medium">{white?.san}</span>
                      <span className="flex-1 text-muted-foreground">{black?.san || ""}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                Make your first move
              </div>
            )}
          </div>
          <div className="p-3 border-t border-border flex gap-2 shrink-0">
            <Button variant="outline" size="sm" className="flex-1" onClick={handleUndo} disabled={moveHistory.length === 0}>
              <RotateCcw className="w-3 h-3 mr-1" /> Undo
            </Button>
            <Button variant="outline" size="sm" className="flex-1 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleResign}>
              <Flag className="w-3 h-3 mr-1" /> Resign
            </Button>
          </div>
        </Card>

        {(gameState.isCheckmate || gameState.isDraw) && (
          <Card className="bg-card border-border p-4 text-center space-y-3">
            <h3 className="font-bold text-lg">
              {gameState.isCheckmate ? (isPlayerTurn ? "You lost" : "You won!") : "Draw!"}
            </h3>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={async () => { await api.resetGame(); refresh(); }}>
                Play Again
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setLocation("/lobby")}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Lobby
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
