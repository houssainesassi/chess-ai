import { useState, useEffect, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { Chess } from "chess.js";

const OPERA_GAME: string[] = [
  "e2e4","e7e5","g1f3","d7d6","d2d4","c8g4","d4e5","g4f3",
  "d1f3","d6e5","f1c4","g8f6","f3b3","d8e7","b1c3","c7c6",
  "c1g5","b7b5","c3b5","c6b5","c4b5","b8d7","e1c1","a8d8",
  "d1d7","d8d7","h1d1","e7e6","g5d7","f6d7","b3b8","d7b8","d1d8",
];

const UNICODE: Record<string, string> = {
  p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚",
  P: "♙", N: "♘", B: "♗", R: "♖", Q: "♕", K: "♔",
};

const RANKS = ["8","7","6","5","4","3","2","1"];
const FILES = ["a","b","c","d","e","f","g","h"];

function AnimatedBoard() {
  const chessRef = useRef(new Chess());
  const moveIdxRef = useRef(0);
  const [fen, setFen] = useState(chessRef.current.fen());
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);

  useEffect(() => {
    const step = () => {
      const chess = chessRef.current;
      const idx = moveIdxRef.current;

      if (idx >= OPERA_GAME.length || chess.isGameOver()) {
        setTimeout(() => {
          chess.reset();
          moveIdxRef.current = 0;
          setLastMove(null);
          setFen(chess.fen());
        }, 3500);
        return;
      }

      const uci = OPERA_GAME[idx];
      const from = uci.slice(0, 2) as any;
      const to = uci.slice(2, 4) as any;
      const promotion = uci[4] as any;
      try {
        chess.move({ from, to, promotion });
        moveIdxRef.current = idx + 1;
        setLastMove({ from, to });
        setFen(chess.fen());
      } catch {}
    };

    const id = setInterval(step, 1100);
    return () => clearInterval(id);
  }, []);

  const board = useMemo(() => {
    const c = new Chess();
    try { c.load(fen); } catch {}
    return c.board();
  }, [fen]);

  return (
    <div
      className="grid grid-cols-8 grid-rows-8 rounded-2xl overflow-hidden shadow-[0_24px_100px_rgba(0,0,0,0.7)] select-none"
      style={{ aspectRatio: "1 / 1", width: "100%" }}
    >
      {board.map((row, rIdx) =>
        row.map((sq, fIdx) => {
          const isDark = (rIdx + fIdx) % 2 !== 0;
          const squareName = FILES[fIdx] + RANKS[rIdx];
          const isLast =
            lastMove &&
            (lastMove.from === squareName || lastMove.to === squareName);

          return (
            <div
              key={squareName}
              className="relative flex items-center justify-center"
              style={{
                background: isLast
                  ? isDark ? "#baca44" : "#f6f669"
                  : isDark ? "#779952" : "#edeed1",
              }}
            >
              {sq && (
                <span
                  className={
                    sq.color === "w"
                      ? "text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] leading-none"
                      : "text-[#1a1a1a] drop-shadow-[0_1px_1px_rgba(255,255,255,0.15)] leading-none"
                  }
                  style={{ fontSize: "min(8vw, 64px)" }}
                >
                  {UNICODE[sq.color === "w" ? sq.type.toUpperCase() : sq.type]}
                </span>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

export default function HomePage() {
  const [, navigate] = useLocation();

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "#212121", fontFamily: "'Inter', sans-serif" }}
    >
      {/* ── TOP NAV ── */}
      <header
        className="flex items-center justify-between px-6 py-4 shrink-0"
        style={{ background: "#161512" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-2xl">♟</span>
          <span className="font-bold text-white text-base leading-tight">
            Smart Chess Board
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/sign-in")}
            className="px-4 py-2 rounded-lg font-semibold text-sm text-white border border-zinc-600 hover:bg-white/5 transition-colors"
          >
            Log In
          </button>
          <button
            onClick={() => navigate("/sign-up")}
            className="px-4 py-2 rounded-lg font-bold text-sm text-white transition-all hover:brightness-110"
            style={{ background: "#6fba3a" }}
          >
            Sign Up
          </button>
        </div>
      </header>

      {/* ── HERO ── */}
      <main className="flex-1 flex items-center justify-center gap-10 xl:gap-16 px-6 xl:px-16 py-8">

        {/* Board — now much larger */}
        <div className="shrink-0" style={{ width: "min(55vh, 580px)" }}>
          <AnimatedBoard />
        </div>

        {/* Marketing text */}
        <div className="flex flex-col gap-6 max-w-sm xl:max-w-md">
          <h1
            className="font-extrabold text-white leading-tight"
            style={{ fontSize: "clamp(2rem, 4vw, 3.2rem)" }}
          >
            Play Chess Online<br />on the{" "}
            <span style={{ color: "#6fba3a" }}>#1 Smart Board!</span>
          </h1>

          <p className="text-zinc-400 text-base leading-relaxed">
            Connect your Arduino board, challenge friends online, and analyze every move with Stockfish AI.
          </p>

          <button
            onClick={() => navigate("/sign-up")}
            className="w-full py-4 rounded-xl font-bold text-white text-lg transition-all hover:brightness-110 hover:scale-[1.02] active:scale-100 shadow-lg"
            style={{ background: "#6fba3a" }}
          >
            Get Started
          </button>

          <div className="flex items-center gap-2">
            <span className="text-zinc-500 text-sm">Already have an account?</span>
            <button
              onClick={() => navigate("/sign-in")}
              className="text-sm font-semibold hover:underline"
              style={{ color: "#6fba3a" }}
            >
              Log In
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
