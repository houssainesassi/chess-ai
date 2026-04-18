import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useGetGameState, getGetGameStateQueryKey } from "@workspace/api-client-react";
import type { GameState } from "@workspace/api-client-react";
import { Chess } from "chess.js";
import { cn } from "@/lib/utils";
import { BestMoveArrow } from "./BestMoveArrow";
import { useChessSounds } from "@/hooks/use-chess-sounds";
import type { BoardTheme, PieceSetId, SoundPackId } from "@/hooks/use-settings";
import { BOARD_THEMES } from "@/hooks/use-settings";

const ANIM_DURATION = 150;

function getPieceSrc(type: string, color: "w" | "b", pieceSet: PieceSetId = "cburnett"): string {
  const c = color === "w" ? "w" : "b";
  const t = type.toUpperCase();
  return `https://lichess1.org/assets/piece/${pieceSet}/${c}${t}.svg`;
}

function squareToColRow(sq: string, flipped: boolean): { col: number; row: number } {
  const file = sq.charCodeAt(0) - 97;
  const rank = parseInt(sq[1]) - 1;
  const col = flipped ? 7 - file : file;
  const row = flipped ? rank : 7 - rank;
  return { col, row };
}

interface AnimatingMove {
  from: string;
  to: string;
  pieceType: string;
  pieceColor: "w" | "b";
}

interface SlidingPieceProps {
  anim: AnimatingMove;
  boardSize: number;
  flipped: boolean;
  pieceSet: PieceSetId;
  onDone: () => void;
}

function SlidingPiece({ anim, boardSize, flipped, pieceSet, onDone }: SlidingPieceProps) {
  const ref = useRef<HTMLDivElement>(null);
  const sqSize = boardSize / 8;
  const { col: fc, row: fr } = squareToColRow(anim.from, flipped);
  const { col: tc, row: tr } = squareToColRow(anim.to, flipped);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.style.transition = "none";
    el.style.transform = `translate(${fc * sqSize}px, ${fr * sqSize}px)`;

    const frameId = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition = `transform ${ANIM_DURATION}ms cubic-bezier(0.25, 0.1, 0.25, 1)`;
        el.style.transform = `translate(${tc * sqSize}px, ${tr * sqSize}px)`;
      });
    });

    const timerId = setTimeout(onDone, ANIM_DURATION + 20);
    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(timerId);
    };
  }, []);

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: sqSize,
        height: sqSize,
        zIndex: 50,
        pointerEvents: "none",
        willChange: "transform",
        transform: `translate(${fc * sqSize}px, ${fr * sqSize}px)`,
        padding: "6%",
      }}
    >
      <img
        src={getPieceSrc(anim.pieceType, anim.pieceColor, pieceSet)}
        alt=""
        className="w-full h-full object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)]"
        draggable={false}
      />
    </div>
  );
}

interface ChessBoardProps {
  theme?: "green" | "wood" | BoardTheme;
  pieceSet?: PieceSetId;
  soundPack?: SoundPackId;
  showBestMove?: boolean;
  bestMove?: string;
  mouseEnabled?: boolean;
  onMove?: (uciMove: string, source: "mouse") => void;
  handHoveredSquare?: string | null;
  handSelectedSquare?: string | null;
  eyeHoveredSquare?: string | null;
  eyeSelectedSquare?: string | null;
  externalGameState?: GameState;
  flipped?: boolean;
}

export function ChessBoard({
  theme = "green",
  pieceSet = "cburnett",
  soundPack = "wood",
  showBestMove = false,
  bestMove,
  mouseEnabled = true,
  onMove,
  handHoveredSquare,
  handSelectedSquare,
  eyeHoveredSquare,
  eyeSelectedSquare,
  externalGameState,
  flipped = false,
}: ChessBoardProps) {
  const resolvedTheme: BoardTheme = typeof theme === "object"
    ? theme
    : theme === "wood"
      ? BOARD_THEMES.find((t) => t.id === "walnut")!
      : BOARD_THEMES.find((t) => t.id === "classic")!;
  const { data: localGameState } = useGetGameState({ query: { queryKey: getGetGameStateQueryKey(), enabled: !externalGameState } });
  const gameState = externalGameState ?? localGameState;

  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [draggedSquare, setDraggedSquare] = useState<string | null>(null);
  const [hoveredSquare, setHoveredSquare] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const [boardSize, setBoardSize] = useState(480);

  const [optimisticFen, setOptimisticFen] = useState<string | null>(null);
  const [animatingMove, setAnimatingMove] = useState<AnimatingMove | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!boardRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setBoardSize(entry.contentRect.width);
      }
    });
    observer.observe(boardRef.current);
    setBoardSize(boardRef.current.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

  const chess = useMemo(() => new Chess(), []);
  const { playMove } = useChessSounds(soundPack);
  const prevFenRef = useRef<string | null>(null);

  // When server confirms a new FEN, clear optimistic state
  useEffect(() => {
    if (!gameState?.fen) return;
    const prevFen = prevFenRef.current;
    if (prevFen && prevFen !== gameState.fen) {
      // Opponent move or server update — play sound only if we didn't just move
      if (!optimisticFen) {
        const tempChess = new Chess(prevFen);
        const isCapture = gameState.lastMove
          ? !!tempChess.get(gameState.lastMove.to as any)
          : false;
        const nextChess = new Chess(gameState.fen);
        const isCheck = nextChess.inCheck();
        playMove(isCapture, isCheck);
      }
    }
    // Clear optimistic state once server confirms
    setOptimisticFen(null);
    prevFenRef.current = gameState.fen;
    try { chess.load(gameState.fen); } catch {}
  }, [gameState?.fen]);

  // Render using optimistic FEN when available
  const renderFen = optimisticFen ?? gameState?.fen;
  const renderChess = useMemo(() => {
    const c = new Chess();
    if (renderFen) try { c.load(renderFen); } catch {}
    return c;
  }, [renderFen]);

  const legalMoves = useMemo(() => {
    if (!selectedSquare) return [];
    return chess.moves({ square: selectedSquare as any, verbose: true });
  }, [selectedSquare, chess, gameState?.fen]);

  const fireMove = useCallback((uciMove: string) => {
    if (isAnimating) return;

    const from = uciMove.slice(0, 2) as any;
    const to = uciMove.slice(2, 4) as any;
    const promotion = uciMove[4] as any;

    const movingPiece = chess.get(from);
    const isCapture = !!chess.get(to);

    // Apply optimistic update locally
    const tempChess = new Chess(chess.fen());
    const result = tempChess.move({ from, to, promotion });
    if (!result) return;

    const newFen = tempChess.fen();
    const isCheck = tempChess.inCheck();

    playMove(isCapture, isCheck);
    // Prevent double-sound when server echoes back this FEN
    prevFenRef.current = newFen;

    // Optimistic board state
    setOptimisticFen(newFen);
    // Pre-load chess with new state so legalMoves etc. reflect it
    try { chess.load(newFen); } catch {}

    // Start slide animation
    if (movingPiece) {
      setIsAnimating(true);
      setAnimatingMove({ from, to, pieceType: movingPiece.type, pieceColor: movingPiece.color });
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
    }

    // Fire server call immediately (parallel)
    if (onMove) onMove(uciMove, "mouse");
  }, [chess, isAnimating, onMove, playMove]);

  const handleAnimDone = useCallback(() => {
    setAnimatingMove(null);
    setIsAnimating(false);
  }, []);

  const handleSquareClick = (square: string) => {
    if (!gameState || !mouseEnabled || isAnimating) return;

    if (selectedSquare) {
      const move = legalMoves.find((m) => m.to === square);
      if (move) {
        fireMove(move.from + move.to + (move.promotion ?? ""));
        setSelectedSquare(null);
        return;
      }
    }

    const piece = chess.get(square as any);
    if (piece && piece.color === gameState.turn) {
      setSelectedSquare(square);
    } else {
      setSelectedSquare(null);
    }
  };

  const handleDragStart = (e: React.DragEvent, square: string) => {
    if (!mouseEnabled || isAnimating) { e.preventDefault(); return; }
    const piece = chess.get(square as any);
    if (piece && piece.color === gameState?.turn) {
      setDraggedSquare(square);
      setSelectedSquare(square);
      e.dataTransfer.setData("text/plain", square);
      e.dataTransfer.effectAllowed = "move";
      const img = new Image();
      img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
      e.dataTransfer.setDragImage(img, 0, 0);
    } else {
      e.preventDefault();
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!mouseEnabled) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetSquare: string) => {
    if (!mouseEnabled || isAnimating) return;
    e.preventDefault();
    const sourceSquare = e.dataTransfer.getData("text/plain");
    if (sourceSquare && sourceSquare !== targetSquare) {
      const move = legalMoves.find((m) => m.to === targetSquare);
      if (move) fireMove(move.from + move.to + (move.promotion ?? ""));
    }
    setDraggedSquare(null);
    setSelectedSquare(null);
  };

  const files = flipped
    ? ["h", "g", "f", "e", "d", "c", "b", "a"]
    : ["a", "b", "c", "d", "e", "f", "g", "h"];
  const ranks = flipped
    ? ["1", "2", "3", "4", "5", "6", "7", "8"]
    : ["8", "7", "6", "5", "4", "3", "2", "1"];
  const board = renderChess.board();

  const squareSize = boardSize / 8;

  const handLegalMoves = useMemo(() => {
    if (!handSelectedSquare) return [];
    return chess.moves({ square: handSelectedSquare as any, verbose: true });
  }, [handSelectedSquare, chess, gameState?.fen]);

  const eyeLegalMoves = useMemo(() => {
    if (!eyeSelectedSquare) return [];
    return chess.moves({ square: eyeSelectedSquare as any, verbose: true });
  }, [eyeSelectedSquare, chess, gameState?.fen]);

  return (
    <div className="w-full aspect-square mx-auto relative select-none" style={{ maxWidth: "min(100%, min(calc(100vh - 180px), 560px))" }}>
      <div
        ref={boardRef}
        className="w-full h-full grid grid-cols-8 grid-rows-8 rounded-sm overflow-hidden shadow-2xl border-4 border-[#1e1e1e] relative"
      >
        {ranks.map((rank, rIndex) =>
          files.map((file, fIndex) => {
            const square = file + rank;
            const isDark = (rIndex + fIndex) % 2 !== 0;
            const piece = flipped
              ? board[7 - rIndex][7 - fIndex]
              : board[rIndex][fIndex];

            const isMouseSelected = selectedSquare === square;
            const isLastMove =
              gameState?.lastMove &&
              (gameState.lastMove.from === square || gameState.lastMove.to === square);
            const isKingInCheck =
              piece?.type === "k" && piece?.color === gameState?.turn && gameState?.isCheck;

            const legalMove = legalMoves.find((m) => m.to === square);
            const isCaptureLegal = legalMove && piece;
            const isEmptyMove = legalMove && !piece;

            // Hide the destination piece while it's sliding in
            const isAnimTarget = animatingMove?.to === square;

            const isHandHovered = handHoveredSquare === square;
            const isHandSelected = handSelectedSquare === square;
            const isHandTarget = handLegalMoves.find((m) => m.to === square);

            const isEyeHovered = eyeHoveredSquare === square;
            const isEyeSelected = eyeSelectedSquare === square;
            const isEyeTarget = eyeLegalMoves.find((m) => m.to === square);

            return (
              <div
                key={square}
                data-testid={`square-${square}`}
                onClick={() => handleSquareClick(square)}
                onMouseEnter={() => setHoveredSquare(square)}
                onMouseLeave={() => setHoveredSquare(null)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, square)}
                style={{ backgroundColor: isDark ? resolvedTheme.dark : resolvedTheme.light }}
                className={cn(
                  "relative w-full h-full flex items-center justify-center leading-none",
                  mouseEnabled && !isAnimating ? "cursor-pointer" : "cursor-default",
                  "transition-colors duration-150",
                  isMouseSelected && "after:absolute after:inset-0 after:bg-yellow-400/50 after:z-0",
                  isLastMove && !isMouseSelected &&
                    "after:absolute after:inset-0 after:bg-yellow-400/25 after:z-0",
                  isKingInCheck &&
                    "after:absolute after:inset-0 after:bg-red-500/60 after:rounded-full after:scale-90 after:z-0",
                )}
              >
                {fIndex === 0 && (
                  <span
                    className="absolute top-0.5 left-0.5 font-bold opacity-60 z-30 pointer-events-none"
                    style={{
                      color: isDark ? resolvedTheme.light : resolvedTheme.dark,
                      fontSize: Math.max(8, squareSize * 0.18),
                    }}
                  >
                    {rank}
                  </span>
                )}
                {rIndex === 7 && (
                  <span
                    className="absolute bottom-0.5 right-0.5 font-bold opacity-60 z-30 pointer-events-none"
                    style={{
                      color: isDark ? resolvedTheme.light : resolvedTheme.dark,
                      fontSize: Math.max(8, squareSize * 0.18),
                    }}
                  >
                    {file}
                  </span>
                )}

                {isEmptyMove && !isHandSelected && (
                  <div className="absolute w-[28%] h-[28%] rounded-full bg-black/25 z-10 pointer-events-none" />
                )}
                {isCaptureLegal && !isHandSelected && (
                  <div className="absolute inset-0 rounded-sm border-[5px] border-black/25 z-10 pointer-events-none" />
                )}

                {isHandHovered && !isHandSelected && (
                  <div className="absolute inset-[3px] rounded-sm border-2 border-yellow-400/80 z-20 pointer-events-none animate-pulse" />
                )}
                {isHandSelected && (
                  <div className="absolute inset-0 bg-blue-400/40 z-10 pointer-events-none" />
                )}
                {isHandTarget && !isHandSelected && piece && (
                  <div className="absolute inset-0 rounded-sm border-[4px] border-blue-400/60 z-15 pointer-events-none" />
                )}
                {isHandTarget && !isHandSelected && !piece && (
                  <div className="absolute w-[28%] h-[28%] rounded-full bg-blue-400/40 z-15 pointer-events-none" />
                )}

                {isEyeHovered && !isEyeSelected && (
                  <div className="absolute inset-[3px] rounded-sm border-2 border-cyan-400/80 z-20 pointer-events-none animate-pulse" />
                )}
                {isEyeSelected && (
                  <div className="absolute inset-0 bg-cyan-400/35 z-10 pointer-events-none" />
                )}
                {isEyeTarget && !isEyeSelected && piece && (
                  <div className="absolute inset-0 rounded-sm border-[4px] border-cyan-400/55 z-15 pointer-events-none" />
                )}
                {isEyeTarget && !isEyeSelected && !piece && (
                  <div className="absolute w-[28%] h-[28%] rounded-full bg-cyan-400/35 z-15 pointer-events-none" />
                )}

                {/* Piece — hidden on the destination square while sliding in */}
                {piece && !isAnimTarget && (
                  <div
                    draggable={mouseEnabled && !isAnimating && piece.color === gameState?.turn}
                    onDragStart={(e) => handleDragStart(e, square)}
                    onDragEnd={() => setDraggedSquare(null)}
                    className={cn(
                      "chess-piece relative z-20 w-[88%] h-[88%] flex items-center justify-center",
                      mouseEnabled && !isAnimating ? "cursor-grab active:cursor-grabbing" : "cursor-default",
                      "transition-transform duration-150 ease-out",
                      mouseEnabled && !isAnimating && "hover:scale-110",
                      draggedSquare === square && "opacity-40 scale-125 pointer-events-none"
                    )}
                    data-testid={`piece-${square}`}
                  >
                    <img
                      src={getPieceSrc(piece.type, piece.color, pieceSet)}
                      alt={`${piece.color}${piece.type}`}
                      className="w-full h-full object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)] pointer-events-none select-none"
                      draggable={false}
                    />
                  </div>
                )}

                {isHandHovered && (
                  <div
                    className="absolute top-1 right-1 w-2 h-2 rounded-full bg-yellow-400 z-30 pointer-events-none shadow-lg"
                    style={{ boxShadow: "0 0 6px 2px rgba(250,204,21,0.6)" }}
                  />
                )}
                {isEyeHovered && (
                  <div
                    className="absolute bottom-1 right-1 w-2 h-2 rounded-full bg-cyan-400 z-30 pointer-events-none"
                    style={{ boxShadow: "0 0 6px 2px rgba(34,211,238,0.7)" }}
                  />
                )}
              </div>
            );
          })
        )}

        {/* Sliding piece overlay */}
        {animatingMove && boardSize > 0 && (
          <SlidingPiece
            key={animatingMove.from + animatingMove.to}
            anim={animatingMove}
            boardSize={boardSize}
            flipped={flipped}
            pieceSet={pieceSet}
            onDone={handleAnimDone}
          />
        )}

        {showBestMove && bestMove && boardSize > 0 && (
          <BestMoveArrow bestMove={bestMove} boardSize={boardSize} flipped={flipped} />
        )}
      </div>
    </div>
  );
}
