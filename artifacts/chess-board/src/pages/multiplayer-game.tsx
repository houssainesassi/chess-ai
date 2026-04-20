import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Chess } from "chess.js";
import {
  ArrowLeft, Flag, Send, Handshake, Mic, MicOff,
  Camera, X, Trophy, Minus, Video, VideoOff,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { io, Socket } from "socket.io-client";
import { Input } from "@/components/ui/input";

// ── Piece symbols ─────────────────────────────────────────────────────────────

const PIECE_SYMBOLS: Record<string, string> = {
  P: "♙", N: "♘", B: "♗", R: "♖", Q: "♕", K: "♔",
  p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚",
};

// ── Chess board ───────────────────────────────────────────────────────────────

function MultiplayerBoard({
  fen,
  onMove,
  isPlayerTurn,
  flipped,
  lastMove,
}: {
  fen: string;
  onMove: (from: string, to: string, promotion?: string) => void;
  isPlayerTurn: boolean;
  flipped: boolean;
  lastMove: { from: string; to: string } | null;
}) {
  const chess = new Chess(fen);
  const rawBoard = chess.board();
  const board = flipped
    ? [...rawBoard].reverse().map((row) => [...row].reverse())
    : rawBoard;

  const [selected, setSelected] = useState<string | null>(null);
  const [legalTargets, setLegalTargets] = useState<string[]>([]);
  const [promotionPending, setPromotionPending] = useState<{ from: string; to: string } | null>(null);

  const toSq = (i: number, j: number) => {
    const file = String.fromCharCode(97 + (flipped ? 7 - j : j));
    const rank = flipped ? i + 1 : 8 - i;
    return `${file}${rank}`;
  };

  const handleClick = (sq: string) => {
    if (!isPlayerTurn || promotionPending) return;

    if (selected) {
      if (legalTargets.includes(sq)) {
        const piece = chess.get(selected as any);
        const isPromo =
          piece?.type === "p" &&
          ((piece.color === "w" && sq[1] === "8") || (piece.color === "b" && sq[1] === "1"));

        if (isPromo) {
          setPromotionPending({ from: selected, to: sq });
          setSelected(null);
          setLegalTargets([]);
        } else {
          onMove(selected, sq);
          setSelected(null);
          setLegalTargets([]);
        }
      } else {
        const piece = chess.get(sq as any);
        if (piece && piece.color === chess.turn()) {
          setSelected(sq);
          setLegalTargets(chess.moves({ square: sq as any, verbose: true }).map((m: any) => m.to));
        } else {
          setSelected(null);
          setLegalTargets([]);
        }
      }
    } else {
      const piece = chess.get(sq as any);
      if (piece && piece.color === chess.turn()) {
        setSelected(sq);
        setLegalTargets(chess.moves({ square: sq as any, verbose: true }).map((m: any) => m.to));
      }
    }
  };

  return (
    <div className="relative w-full aspect-square">
      {promotionPending && (
        <div className="absolute inset-0 z-20 bg-black/80 flex items-center justify-center rounded">
          <div className="bg-card border border-border rounded-xl p-4 flex flex-col items-center gap-3">
            <p className="text-sm font-medium">Promote pawn to:</p>
            <div className="flex gap-3">
              {["q", "r", "b", "n"].map((p) => {
                const sym = chess.turn() === "w" ? p.toUpperCase() : p;
                return (
                  <button
                    key={p}
                    className="w-14 h-14 text-4xl bg-muted hover:bg-primary/20 rounded-lg transition-colors"
                    onClick={() => {
                      onMove(promotionPending.from, promotionPending.to, p);
                      setPromotionPending(null);
                    }}
                  >
                    {PIECE_SYMBOLS[sym]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="w-full h-full flex flex-col border-2 border-border rounded overflow-hidden shadow-xl">
        {board.map((row, i) => (
          <div key={i} className="flex-1 flex">
            {row.map((square, j) => {
              const isLight = (i + j) % 2 === 0;
              const sq = toSq(i, j);
              const isSelected = selected === sq;
              const isTarget = legalTargets.includes(sq);
              const isLast = lastMove && (lastMove.from === sq || lastMove.to === sq);
              const pieceKey = square
                ? square.color === "w" ? square.type.toUpperCase() : square.type.toLowerCase()
                : null;

              return (
                <div
                  key={j}
                  onClick={() => handleClick(sq)}
                  className={`flex-1 flex items-center justify-center cursor-pointer relative select-none transition-colors
                    ${isLight ? "bg-[#f0d9b5]" : "bg-[#b58863]"}
                    ${isSelected ? "!bg-yellow-400/80" : ""}
                    ${isLast && !isSelected ? "!bg-yellow-300/40" : ""}
                    ${isTarget && !square ? "after:absolute after:inset-[30%] after:rounded-full after:bg-black/20" : ""}
                    ${isTarget && square ? "!ring-2 !ring-inset !ring-yellow-400" : ""}`}
                >
                  {square && (
                    <span className={`text-[clamp(1rem,5vw,3rem)] leading-none drop-shadow-md select-none
                      ${square.color === "w" ? "text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]" : "text-[#1a1a1a] [text-shadow:0_1px_0_rgba(255,255,255,0.4)]"}`}>
                      {pieceKey ? PIECE_SYMBOLS[pieceKey] : ""}
                    </span>
                  )}
                  {j === 0 && !flipped && <span className={`absolute top-0.5 left-0.5 text-[10px] font-bold ${isLight ? "text-[#b58863]" : "text-[#f0d9b5]"}`}>{8 - i}</span>}
                  {i === 7 && !flipped && <span className={`absolute bottom-0.5 right-0.5 text-[10px] font-bold ${isLight ? "text-[#b58863]" : "text-[#f0d9b5]"}`}>{String.fromCharCode(97 + j)}</span>}
                  {flipped && j === 7 && <span className={`absolute top-0.5 right-0.5 text-[10px] font-bold ${isLight ? "text-[#b58863]" : "text-[#f0d9b5]"}`}>{i + 1}</span>}
                  {flipped && i === 0 && <span className={`absolute bottom-0.5 left-0.5 text-[10px] font-bold ${isLight ? "text-[#b58863]" : "text-[#f0d9b5]"}`}>{String.fromCharCode(104 - j)}</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Camera hand control ───────────────────────────────────────────────────────

function CameraControl({ onClose, boardRef, onSquareSelect }: {
  onClose: () => void;
  boardRef: React.RefObject<HTMLDivElement | null>;
  onSquareSelect: (sq: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const handsRef = useRef<any>(null);
  const dwellRef = useRef<{ sq: string; start: number } | null>(null);
  const [status, setStatus] = useState("Loading hand tracking...");
  const [hoveredSq, setHoveredSq] = useState<string | null>(null);
  const [dwellProgress, setDwellProgress] = useState(0);
  const [mpLoaded, setMpLoaded] = useState(false);

  // Load MediaPipe via CDN
  useEffect(() => {
    const scripts = [
      "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3/camera_utils.js",
      "https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils@0.3/drawing_utils.js",
      "https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/hands.js",
    ];

    let loaded = 0;
    scripts.forEach((src) => {
      if (document.querySelector(`script[src="${src}"]`)) { loaded++; if (loaded === scripts.length) setMpLoaded(true); return; }
      const s = document.createElement("script");
      s.src = src;
      s.crossOrigin = "anonymous";
      s.onload = () => { loaded++; if (loaded === scripts.length) setMpLoaded(true); };
      s.onerror = () => setStatus("Failed to load hand tracking library");
      document.head.appendChild(s);
    });
  }, []);

  const squareFromPoint = useCallback((x: number, y: number): string | null => {
    const board = boardRef.current;
    if (!board) return null;
    const rect = board.getBoundingClientRect();
    const relX = (x - rect.left) / rect.width;
    const relY = (y - rect.top) / rect.height;
    if (relX < 0 || relX > 1 || relY < 0 || relY > 1) return null;
    const col = Math.floor(relX * 8);
    const row = Math.floor(relY * 8);
    const file = String.fromCharCode(97 + col);
    const rank = 8 - row;
    return `${file}${rank}`;
  }, [boardRef]);

  // Start camera + hands once MediaPipe loaded
  useEffect(() => {
    if (!mpLoaded) return;
    const w = window as any;
    if (!w.Hands) { setStatus("Hands module not available"); return; }

    const hands = new w.Hands({
      locateFile: (file: string) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/${file}`,
    });
    hands.setOptions({ maxNumHands: 1, modelComplexity: 0, minDetectionConfidence: 0.7, minTrackingConfidence: 0.5 });

    hands.onResults((results: any) => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      if (results.multiHandLandmarks?.length > 0) {
        const lm = results.multiHandLandmarks[0];
        // Index finger tip = landmark 8
        const tip = lm[8];
        const px = tip.x * canvas.width;
        const py = tip.y * canvas.height;

        // Draw fingertip circle
        ctx.beginPath();
        ctx.arc(px, py, 12, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(99,102,241,0.7)";
        ctx.fill();
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Map to board square using screen coords
        const screenX = tip.x * window.innerWidth;
        const screenY = tip.y * window.innerHeight;
        const sq = squareFromPoint(screenX, screenY);
        setHoveredSq(sq);

        if (sq) {
          const now = Date.now();
          if (dwellRef.current?.sq === sq) {
            const elapsed = now - dwellRef.current.start;
            const progress = Math.min(elapsed / 1500, 1);
            setDwellProgress(progress * 100);
            if (elapsed >= 1500) {
              onSquareSelect(sq);
              dwellRef.current = null;
              setDwellProgress(0);
            }
          } else {
            dwellRef.current = { sq, start: now };
            setDwellProgress(0);
          }
        } else {
          dwellRef.current = null;
          setDwellProgress(0);
        }

        // Draw hand skeleton
        if (w.drawConnectors && w.drawLandmarks && w.HAND_CONNECTIONS) {
          w.drawConnectors(ctx, lm, w.HAND_CONNECTIONS, { color: "#6366f1", lineWidth: 2 });
          w.drawLandmarks(ctx, lm, { color: "#fff", lineWidth: 1, radius: 3 });
        }
        setStatus("✋ Hand detected — hover over a square for 1.5s to select");
      } else {
        setStatus("No hand detected — show your hand to the camera");
        setHoveredSq(null);
        dwellRef.current = null;
        setDwellProgress(0);
      }
    });

    handsRef.current = hands;

    // Start camera
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } })
      .then((stream) => {
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.play();
          setStatus("Camera active — show your hand");

          const processFrame = async () => {
            if (handsRef.current && video.readyState >= 2) {
              await handsRef.current.send({ image: video });
            }
            requestAnimationFrame(processFrame);
          };
          processFrame();
        }
      })
      .catch(() => setStatus("Camera access denied. Please allow camera."));

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      handsRef.current = null;
    };
  }, [mpLoaded, squareFromPoint, onSquareSelect]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary" />
            <h3 className="font-bold">Hand Gesture Control</h3>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>

        <div className="p-4 space-y-3">
          <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
            <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline />
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover" />
            {hoveredSq && (
              <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                Square: <strong>{hoveredSq.toUpperCase()}</strong>
                {dwellProgress > 0 && ` — ${Math.round(dwellProgress)}%`}
              </div>
            )}
          </div>

          {dwellProgress > 0 && (
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-100"
                style={{ width: `${dwellProgress}%` }}
              />
            </div>
          )}

          <p className="text-sm text-muted-foreground text-center">{status}</p>
          <p className="text-xs text-muted-foreground text-center">
            Point your index finger at a square and hold for 1.5 seconds to select/move.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Voice command parser ──────────────────────────────────────────────────────

function parseVoiceCommand(text: string): { from: string; to: string } | null {
  const lower = text.toLowerCase().trim();
  const squarePair = lower.match(/([a-h][1-8])\s+(?:to\s+)?([a-h][1-8])/);
  if (squarePair) return { from: squarePair[1], to: squarePair[2] };
  return null;
}

// ── Main game page ────────────────────────────────────────────────────────────

export default function MultiplayerGamePage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // ── State ───────────────────────────────────────────────────────────────────
  // dbGame holds the DB fields; engineState holds the live chess state
  // We merge them so neither field is ever missing
  const [game, setGame] = useState<any>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [chatMsg, setChatMsg] = useState("");
  const [messages, setMessages] = useState<{ sender: string; text: string }[]>([]);

  const [resignConfirm, setResignConfirm] = useState(false);
  const [drawOfferedByOpponent, setDrawOfferedByOpponent] = useState(false);
  const [drawOfferSent, setDrawOfferSent] = useState(false);
  const [gameOver, setGameOver] = useState<{ winner: string; reason: string } | null>(null);

  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [voiceSelection, setVoiceSelection] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const socketRef = useRef<Socket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const boardContainerRef = useRef<HTMLDivElement>(null);

  // ── Move handler ────────────────────────────────────────────────────────────
  const handleMove = useCallback(async (from: string, to: string, promotion?: string) => {
    const moveStr = promotion ? `${from}${to}${promotion}` : `${from}${to}`;
    try {
      const res = await fetch(`/api/games/${id}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ move: moveStr }),
      });
      if (!res.ok) throw new Error("Invalid move");
      const updated = await res.json();
      // Merge: keep DB fields, update engine fields
      setGame((prev: any) => prev ? { ...prev, ...updated, ...updated.gameState } : updated);
    } catch {
      toast({ title: "Invalid Move", variant: "destructive" });
    }
  }, [id, token, toast]);

  // ── Camera square selection ─────────────────────────────────────────────────
  const handleCameraSquareSelect = useCallback((sq: string) => {
    if (voiceSelection) {
      handleMove(voiceSelection, sq);
      setVoiceSelection(null);
      toast({ title: `Camera: ${voiceSelection} → ${sq}` });
    } else {
      setVoiceSelection(sq);
      toast({ title: `Camera: ${sq.toUpperCase()} selected`, description: "Now hover over destination" });
    }
  }, [voiceSelection, handleMove]);

  // ── Socket setup ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token || !id) return;

    const loadGame = async () => {
      // Try to join (will fail if already active — that's fine)
      await fetch(`/api/games/${id}/join`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});

      try {
        const res = await fetch(`/api/games/${id}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error();
        const data = await res.json();
        setGame(data);
      } catch {
        toast({ title: "Failed to load game", variant: "destructive" });
        setLocation("/lobby");
      }
    };

    loadGame();

    const sock = io({ path: "/api/socket.io", auth: { token } });
    socketRef.current = sock;

    sock.on("connect", () => {
      sock.emit("joinGame", { gameId: id });
      if (user?.id) sock.emit("registerUser", { userId: user.id });
    });

    sock.on("roomUpdate", (engineState: any) => {
      // CRITICAL FIX: merge engine state into existing DB game, never replace
      setGame((prev: any) => prev ? { ...prev, ...engineState } : engineState);
    });

    sock.on("chatMessage", (msg: any) => {
      setMessages((p) => [...p, { sender: msg.username, text: msg.message }]);
    });

    sock.on("playerResigned", ({ resignedUserId, winner }: any) => {
      setGameOver({
        winner,
        reason: resignedUserId !== user?.id ? "Your opponent resigned" : "You resigned",
      });
    });

    sock.on("drawOffered", () => {
      setDrawOfferedByOpponent(true);
    });

    sock.on("drawAccepted", () => {
      setDrawOfferSent(false);
      setGameOver({ winner: "draw", reason: "Draw agreed" });
    });

    sock.on("drawDeclined", () => {
      setDrawOfferSent(false);
      toast({ title: "Draw offer declined" });
    });

    setSocket(sock);

    return () => {
      sock.emit("leaveGame", { gameId: id });
      sock.disconnect();
    };
  }, [id, token, user?.id]);

  // Detect checkmate from game state
  useEffect(() => {
    if (!game || gameOver) return;
    if (game.status === "completed" && game.winner) {
      const iWin =
        (game.winner === "white" && game.whitePlayerId === user?.id) ||
        (game.winner === "black" && game.blackPlayerId === user?.id);
      setGameOver({
        winner: game.winner,
        reason: game.winner === "draw" ? "Draw" : iWin ? "You won by checkmate!" : "Opponent won by checkmate",
      });
    }
  }, [game]);

  // Also detect from engine state
  useEffect(() => {
    if (!game || gameOver) return;
    if (game.isCheckmate && game.turn) {
      const loserColor = game.turn; // the side to move is in checkmate
      const winnerStr = loserColor === "w" ? "black" : "white";
      const iWin =
        (winnerStr === "white" && game.whitePlayerId === user?.id) ||
        (winnerStr === "black" && game.blackPlayerId === user?.id);
      setGameOver({
        winner: winnerStr,
        reason: iWin ? "You won by checkmate! 🎉" : "Opponent won by checkmate",
      });
    } else if (game.isDraw || game.isStalemate) {
      setGameOver({ winner: "draw", reason: game.isStalemate ? "Stalemate" : "Draw" });
    }
  }, [game?.isCheckmate, game?.isDraw, game?.isStalemate]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Voice control ───────────────────────────────────────────────────────────
  const toggleVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast({ title: "Voice not supported in this browser", variant: "destructive" });
      return;
    }
    if (voiceActive) {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      setVoiceActive(false);
      setVoiceTranscript("");
      return;
    }
    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = "en-US";
    r.onresult = (e: any) => {
      const last = e.results[e.results.length - 1];
      const text = last[0].transcript;
      setVoiceTranscript(text);
      if (last.isFinal) {
        setVoiceTranscript("");
        const parsed = parseVoiceCommand(text);
        if (parsed) {
          handleMove(parsed.from, parsed.to);
          toast({ title: `Voice: ${text}`, description: `${parsed.from} → ${parsed.to}` });
        }
      }
    };
    r.onerror = () => { setVoiceActive(false); recognitionRef.current = null; };
    r.start();
    recognitionRef.current = r;
    setVoiceActive(true);
    toast({ title: "Voice control on", description: "Say 'e2 to e4'" });
  };

  useEffect(() => () => { recognitionRef.current?.stop(); }, []);

  // ── Actions ─────────────────────────────────────────────────────────────────
  const handleResign = () => {
    if (!resignConfirm) { setResignConfirm(true); return; }
    socket?.emit("resignGame", { gameId: id, userId: user?.id });
    setResignConfirm(false);
  };

  const handleOfferDraw = () => {
    if (drawOfferSent) return;
    socket?.emit("offerDraw", { gameId: id, userId: user?.id });
    setDrawOfferSent(true);
    toast({ title: "Draw offer sent" });
  };

  const sendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMsg.trim() || !socket || !user) return;
    socket.emit("sendMessage", { gameId: id, userId: user.id, username: user.username, message: chatMsg });
    setMessages((p) => [...p, { sender: user.username, text: chatMsg }]);
    setChatMsg("");
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!game) {
    return <div className="p-8 text-center text-muted-foreground">Loading game...</div>;
  }

  if (game.status === "waiting") {
    return (
      <div className="p-8 flex flex-col items-center justify-center gap-6 min-h-[60vh]">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
          <ArrowLeft className="w-8 h-8 text-primary rotate-180" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">Waiting for Opponent</h2>
          <p className="text-muted-foreground">Share the link or wait for someone to join.</p>
          <p className="text-xs font-mono bg-muted px-3 py-1 rounded">{window.location.href}</p>
        </div>
        <Button variant="outline" onClick={() => setLocation("/lobby")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Lobby
        </Button>
      </div>
    );
  }

  const fen = game.fen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const chess = new Chess(fen);
  const myColor = game.whitePlayerId === user?.id ? "w" : "b";
  const isMyTurn = chess.turn() === myColor && !gameOver;
  const flipped = myColor === "b";

  const opponentId = myColor === "w" ? game.blackPlayerId : game.whitePlayerId;
  const opponentLabel = myColor === "w" ? "Opponent (Black)" : "Opponent (White)";
  const myLabel = myColor === "w" ? "White" : "Black";

  const gameOverWinner = gameOver?.winner;
  const iWon =
    (gameOverWinner === "white" && game.whitePlayerId === user?.id) ||
    (gameOverWinner === "black" && game.blackPlayerId === user?.id);
  const isDraw = gameOverWinner === "draw";

  const lastMove = game.lastMove || null;

  return (
    <div className="p-2 md:p-4 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 relative">

      {/* Camera modal */}
      {cameraOpen && (
        <CameraControl
          onClose={() => { setCameraOpen(false); setVoiceSelection(null); }}
          boardRef={boardContainerRef}
          onSquareSelect={handleCameraSquareSelect}
        />
      )}

      {/* Game over overlay */}
      {gameOver && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center gap-5 shadow-2xl max-w-sm w-full mx-4 animate-in fade-in zoom-in duration-300">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center ${iWon ? "bg-yellow-500/20" : isDraw ? "bg-blue-500/20" : "bg-red-500/20"}`}>
              {iWon ? <Trophy className="w-10 h-10 text-yellow-500" /> : isDraw ? <Minus className="w-10 h-10 text-blue-500" /> : <Flag className="w-10 h-10 text-red-500" />}
            </div>
            <div className="text-center space-y-1">
              <h2 className="text-2xl font-bold">{iWon ? "You Won!" : isDraw ? "Draw!" : "You Lost"}</h2>
              <p className="text-muted-foreground text-sm">{gameOver.reason}</p>
            </div>
            <div className="flex gap-3 w-full">
              <Button className="flex-1" onClick={() => setLocation("/lobby")}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Lobby
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setLocation(`/history/${id}`)}>
                Analysis
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Draw offer popup */}
      {drawOfferedByOpponent && !gameOver && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-card border border-border rounded-xl p-6 flex flex-col items-center gap-4 shadow-xl max-w-xs w-full mx-4 animate-in fade-in zoom-in duration-200">
            <Handshake className="w-10 h-10 text-blue-400" />
            <div className="text-center">
              <h3 className="font-bold text-lg">Draw Offered</h3>
              <p className="text-sm text-muted-foreground">Your opponent offers a draw. Accept?</p>
            </div>
            <div className="flex gap-3 w-full">
              <Button className="flex-1" onClick={() => { socket?.emit("acceptDraw", { gameId: id }); setDrawOfferedByOpponent(false); }}>Accept</Button>
              <Button variant="outline" className="flex-1" onClick={() => { socket?.emit("declineDraw", { gameId: id }); setDrawOfferedByOpponent(false); }}>Decline</Button>
            </div>
          </div>
        </div>
      )}

      {/* Board column */}
      <div className="flex flex-col gap-3 min-w-0">
        {/* Opponent */}
        <div className="flex justify-between items-center bg-card p-3 rounded-lg border border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-secondary rounded-full flex items-center justify-center font-bold">O</div>
            <div>
              <span className="font-bold text-sm">{opponentLabel}</span>
              {!isMyTurn && !gameOver && (
                <Badge variant="default" className="ml-2 text-xs animate-pulse">Thinking...</Badge>
              )}
            </div>
          </div>
          <div className="text-sm">{myColor === "w" ? game.capturedPieces?.black?.join("") : game.capturedPieces?.white?.join("") || ""}</div>
        </div>

        {/* Board */}
        <div ref={boardContainerRef} className="w-full">
          <MultiplayerBoard
            fen={fen}
            onMove={handleMove}
            isPlayerTurn={isMyTurn}
            flipped={flipped}
            lastMove={lastMove}
          />
        </div>

        {/* Voice transcript */}
        {voiceActive && voiceTranscript && (
          <div className="bg-primary/10 border border-primary/20 rounded px-4 py-2 text-sm text-primary flex items-center gap-2">
            <Mic className="w-4 h-4 animate-pulse shrink-0" />
            <span className="italic truncate">"{voiceTranscript}"</span>
          </div>
        )}
        {voiceSelection && (
          <div className="bg-orange-500/10 border border-orange-500/20 rounded px-4 py-2 text-sm text-orange-500 flex items-center gap-2">
            <Camera className="w-4 h-4 shrink-0" />
            <span>Selected: <strong>{voiceSelection.toUpperCase()}</strong> — now hover over destination</span>
          </div>
        )}

        {/* Me */}
        <div className="flex justify-between items-center bg-card p-3 rounded-lg border border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/20 text-primary rounded-full flex items-center justify-center font-bold">
              {(user?.username || "Y").charAt(0).toUpperCase()}
            </div>
            <div>
              <span className="font-bold text-sm">{user?.username}</span>
              <span className="text-xs text-muted-foreground ml-2">({myLabel})</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-sm">{myColor === "w" ? game.capturedPieces?.white?.join("") : game.capturedPieces?.black?.join("") || ""}</div>
            <Badge variant={isMyTurn ? "default" : "secondary"}>
              {isMyTurn ? "Your Turn" : "Waiting..."}
            </Badge>
          </div>
        </div>

        {/* Controls */}
        {!gameOver && (
          <div className="flex flex-wrap gap-2">
            {resignConfirm ? (
              <>
                <Button variant="destructive" size="sm" className="flex-1" onClick={handleResign}>
                  <Flag className="w-3 h-3 mr-1" /> Confirm Resign
                </Button>
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setResignConfirm(false)}>Cancel</Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" className="flex-1 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleResign}>
                  <Flag className="w-3 h-3 mr-1" /> Resign
                </Button>
                <Button variant="outline" size="sm" className="flex-1" onClick={handleOfferDraw} disabled={drawOfferSent}>
                  <Handshake className="w-3 h-3 mr-1" />
                  {drawOfferSent ? "Offered" : "Draw"}
                </Button>
                <Button variant={voiceActive ? "default" : "outline"} size="sm" className="flex-1" onClick={toggleVoice}>
                  {voiceActive ? <Mic className="w-3 h-3 mr-1" /> : <MicOff className="w-3 h-3 mr-1" />}
                  Voice
                </Button>
                <Button variant={cameraOpen ? "default" : "outline"} size="sm" className="flex-1" onClick={() => setCameraOpen(!cameraOpen)}>
                  {cameraOpen ? <Video className="w-3 h-3 mr-1" /> : <VideoOff className="w-3 h-3 mr-1" />}
                  Hand
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Chat sidebar */}
      <div className="flex flex-col h-[500px] lg:h-auto lg:max-h-[calc(100vh-8rem)]">
        <Card className="bg-card border-border flex-1 flex flex-col min-h-0">
          <div className="p-3 border-b border-border flex justify-between items-center shrink-0">
            <h3 className="font-bold text-sm">Chat</h3>
            {voiceActive && <Badge variant="default" className="text-xs animate-pulse"><Mic className="w-3 h-3 mr-1" />Live</Badge>}
          </div>
          <div className="flex-1 overflow-auto p-3 space-y-2">
            {messages.length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-4">No messages yet</div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.sender === user?.username ? "items-end" : "items-start"}`}>
                <span className="text-xs text-muted-foreground mb-0.5">{msg.sender}</span>
                <div className={`px-3 py-1.5 rounded-lg text-sm max-w-[90%] break-words ${msg.sender === user?.username ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  {msg.text}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="p-3 border-t border-border shrink-0">
            <form onSubmit={sendChat} className="flex gap-2">
              <Input value={chatMsg} onChange={(e) => setChatMsg(e.target.value)} placeholder="Message..." className="flex-1 text-sm" />
              <Button type="submit" size="icon" className="shrink-0"><Send className="w-4 h-4" /></Button>
            </form>
          </div>
        </Card>
      </div>
    </div>
  );
}
