import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Chess } from "chess.js";
import {
  ArrowLeft, Flag, Send, Handshake, Mic, MicOff,
  Camera, X, Trophy, Minus, Video, VideoOff, MessageSquare, List,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { io, Socket } from "socket.io-client";
import { Input } from "@/components/ui/input";

// ── Pieces ────────────────────────────────────────────────────────────────────

const SYM: Record<string, string> = {
  P:"♙",N:"♘",B:"♗",R:"♖",Q:"♕",K:"♔",
  p:"♟",n:"♞",b:"♝",r:"♜",q:"♛",k:"♚",
};

// ── Board ─────────────────────────────────────────────────────────────────────

function MultiplayerBoard({
  fen, onMove, isPlayerTurn, flipped, lastMove,
}: {
  fen: string;
  onMove: (from: string, to: string, promotion?: string) => void;
  isPlayerTurn: boolean;
  flipped: boolean;
  lastMove: { from: string; to: string } | null;
}) {
  const chess = new Chess(fen);
  const rawBoard = chess.board();
  const board = flipped ? [...rawBoard].reverse().map(row => [...row].reverse()) : rawBoard;
  const [selected, setSelected] = useState<string | null>(null);
  const [legalTargets, setLegalTargets] = useState<string[]>([]);
  const [promo, setPromo] = useState<{ from: string; to: string } | null>(null);

  const toSq = (i: number, j: number) => {
    const file = String.fromCharCode(97 + (flipped ? 7 - j : j));
    const rank = flipped ? i + 1 : 8 - i;
    return `${file}${rank}`;
  };

  const handleClick = (sq: string) => {
    if (!isPlayerTurn || promo) return;
    if (selected) {
      if (legalTargets.includes(sq)) {
        const piece = chess.get(selected as any);
        const isP = piece?.type === "p" && ((piece.color === "w" && sq[1] === "8") || (piece.color === "b" && sq[1] === "1"));
        if (isP) { setPromo({ from: selected, to: sq }); setSelected(null); setLegalTargets([]); }
        else { onMove(selected, sq); setSelected(null); setLegalTargets([]); }
      } else {
        const p = chess.get(sq as any);
        if (p && p.color === chess.turn()) { setSelected(sq); setLegalTargets(chess.moves({ square: sq as any, verbose: true }).map((m: any) => m.to)); }
        else { setSelected(null); setLegalTargets([]); }
      }
    } else {
      const p = chess.get(sq as any);
      if (p && p.color === chess.turn()) { setSelected(sq); setLegalTargets(chess.moves({ square: sq as any, verbose: true }).map((m: any) => m.to)); }
    }
  };

  return (
    <div className="relative w-full h-full">
      {promo && (
        <div className="absolute inset-0 z-20 bg-black/80 flex items-center justify-center rounded">
          <div className="bg-card border border-border rounded-xl p-4 flex flex-col items-center gap-3">
            <p className="text-sm font-medium">Promote pawn to:</p>
            <div className="flex gap-3">
              {["q","r","b","n"].map(p => (
                <button key={p} className="w-14 h-14 text-4xl bg-muted hover:bg-primary/20 rounded-lg transition-colors"
                  onClick={() => { onMove(promo.from, promo.to, p); setPromo(null); }}>
                  {SYM[chess.turn() === "w" ? p.toUpperCase() : p]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      <div className="w-full h-full flex flex-col border border-border rounded overflow-hidden shadow-xl">
        {board.map((row, i) => (
          <div key={i} className="flex-1 flex">
            {row.map((square, j) => {
              const light = (i + j) % 2 === 0;
              const sq = toSq(i, j);
              const sel = selected === sq;
              const tgt = legalTargets.includes(sq);
              const lm = lastMove && (lastMove.from === sq || lastMove.to === sq);
              const pk = square ? (square.color === "w" ? square.type.toUpperCase() : square.type) : null;
              return (
                <div key={j} onClick={() => handleClick(sq)}
                  className={`flex-1 flex items-center justify-center cursor-pointer relative select-none transition-colors
                    ${light ? "bg-[#f0d9b5]" : "bg-[#b58863]"}
                    ${sel ? "!bg-yellow-400/80" : ""}
                    ${lm && !sel ? "!bg-yellow-300/40" : ""}
                    ${tgt && !square ? "after:absolute after:inset-[30%] after:rounded-full after:bg-black/20" : ""}
                    ${tgt && square ? "ring-2 ring-inset ring-yellow-400" : ""}`}>
                  {square && (
                    <span className={`text-[clamp(1.2rem,4vw,3.5rem)] leading-none drop-shadow-md select-none
                      ${square.color === "w" ? "text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]" : "text-[#1a1a1a] [text-shadow:0_1px_0_rgba(255,255,255,0.4)]"}`}>
                      {pk ? SYM[pk] : ""}
                    </span>
                  )}
                  {!flipped && j === 0 && <span className={`absolute top-0.5 left-0.5 text-[9px] font-bold leading-none ${light ? "text-[#b58863]" : "text-[#f0d9b5]"}`}>{8-i}</span>}
                  {!flipped && i === 7 && <span className={`absolute bottom-0.5 right-0.5 text-[9px] font-bold leading-none ${light ? "text-[#b58863]" : "text-[#f0d9b5]"}`}>{String.fromCharCode(97+j)}</span>}
                  {flipped && j === 7 && <span className={`absolute top-0.5 right-0.5 text-[9px] font-bold leading-none ${light ? "text-[#b58863]" : "text-[#f0d9b5]"}`}>{i+1}</span>}
                  {flipped && i === 0 && <span className={`absolute bottom-0.5 left-0.5 text-[9px] font-bold leading-none ${light ? "text-[#b58863]" : "text-[#f0d9b5]"}`}>{String.fromCharCode(104-j)}</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Camera (MediaPipe) ────────────────────────────────────────────────────────

function CameraOverlay({ onClose, boardRef, onSquareSelect }: {
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
  const [dwellPct, setDwellPct] = useState(0);
  const [mpLoaded, setMpLoaded] = useState(false);

  useEffect(() => {
    const scripts = [
      "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3/camera_utils.js",
      "https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils@0.3/drawing_utils.js",
      "https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/hands.js",
    ];
    let loaded = 0;
    scripts.forEach(src => {
      if (document.querySelector(`script[src="${src}"]`)) { loaded++; if (loaded === scripts.length) setMpLoaded(true); return; }
      const s = document.createElement("script"); s.src = src; s.crossOrigin = "anonymous";
      s.onload = () => { loaded++; if (loaded === scripts.length) setMpLoaded(true); };
      s.onerror = () => setStatus("Failed to load hand tracking"); document.head.appendChild(s);
    });
  }, []);

  const sqFromPoint = useCallback((x: number, y: number) => {
    const board = boardRef.current; if (!board) return null;
    const rect = board.getBoundingClientRect();
    const rx = (x - rect.left) / rect.width; const ry = (y - rect.top) / rect.height;
    if (rx < 0 || rx > 1 || ry < 0 || ry > 1) return null;
    return `${String.fromCharCode(97 + Math.floor(rx * 8))}${8 - Math.floor(ry * 8)}`;
  }, [boardRef]);

  useEffect(() => {
    if (!mpLoaded) return;
    const w = window as any;
    if (!w.Hands) { setStatus("Hands module unavailable"); return; }
    const hands = new w.Hands({ locateFile: (f: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/${f}` });
    hands.setOptions({ maxNumHands: 1, modelComplexity: 0, minDetectionConfidence: 0.7, minTrackingConfidence: 0.5 });
    hands.onResults((results: any) => {
      const canvas = canvasRef.current; const video = videoRef.current;
      if (!canvas || !video) return;
      const ctx = canvas.getContext("2d"); if (!ctx) return;
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      if (results.multiHandLandmarks?.length > 0) {
        const lm = results.multiHandLandmarks[0]; const tip = lm[8];
        const px = tip.x * canvas.width; const py = tip.y * canvas.height;
        ctx.beginPath(); ctx.arc(px, py, 12, 0, Math.PI*2);
        ctx.fillStyle = "rgba(99,102,241,0.7)"; ctx.fill();
        ctx.strokeStyle = "white"; ctx.lineWidth = 2; ctx.stroke();
        const sq = sqFromPoint(tip.x * window.innerWidth, tip.y * window.innerHeight);
        setHoveredSq(sq);
        if (sq) {
          const now = Date.now();
          if (dwellRef.current?.sq === sq) {
            const elapsed = now - dwellRef.current.start;
            const pct = Math.min(elapsed / 1500, 1); setDwellPct(pct * 100);
            if (elapsed >= 1500) { onSquareSelect(sq); dwellRef.current = null; setDwellPct(0); }
          } else { dwellRef.current = { sq, start: now }; setDwellPct(0); }
        } else { dwellRef.current = null; setDwellPct(0); }
        if (w.drawConnectors && w.drawLandmarks && w.HAND_CONNECTIONS) {
          w.drawConnectors(ctx, lm, w.HAND_CONNECTIONS, { color: "#6366f1", lineWidth: 2 });
          w.drawLandmarks(ctx, lm, { color: "#fff", lineWidth: 1, radius: 3 });
        }
        setStatus("✋ Hover a square for 1.5s to select");
      } else { setStatus("Show your hand to the camera"); setHoveredSq(null); dwellRef.current = null; setDwellPct(0); }
    });
    handsRef.current = hands;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } })
      .then(stream => {
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) { video.srcObject = stream; video.play(); setStatus("Camera active");
          const loop = async () => { if (handsRef.current && video.readyState >= 2) await handsRef.current.send({ image: video }); requestAnimationFrame(loop); };
          loop();
        }
      }).catch(() => setStatus("Camera access denied"));
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); handsRef.current = null; };
  }, [mpLoaded, sqFromPoint, onSquareSelect]);

  return (
    <div className="absolute bottom-[57px] right-0 w-80 bg-card border border-border rounded-tl-xl shadow-2xl z-30 overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2 text-sm font-bold"><Camera className="w-4 h-4 text-primary" /> Hand Control</div>
        <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground hover:text-foreground" /></button>
      </div>
      <div className="p-3 space-y-2">
        <div className="relative aspect-video bg-black rounded overflow-hidden">
          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline />
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover" />
          {hoveredSq && <div className="absolute bottom-1 left-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded">{hoveredSq.toUpperCase()} {dwellPct > 0 ? `${Math.round(dwellPct)}%` : ""}</div>}
        </div>
        {dwellPct > 0 && <div className="h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${dwellPct}%` }} /></div>}
        <p className="text-xs text-muted-foreground text-center">{status}</p>
      </div>
    </div>
  );
}

// ── Voice ─────────────────────────────────────────────────────────────────────

function parseVoice(text: string) {
  const m = text.toLowerCase().match(/([a-h][1-8])\s+(?:to\s+)?([a-h][1-8])/);
  return m ? { from: m[1], to: m[2] } : null;
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function MultiplayerGamePage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

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
  const [showChat, setShowChat] = useState(false);
  const [showMoves, setShowMoves] = useState(false);
  const [voiceSelection, setVoiceSelection] = useState<string | null>(null);
  const [unreadChat, setUnreadChat] = useState(0);

  const recognitionRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const moveListRef = useRef<HTMLDivElement>(null);

  // ── Move ─────────────────────────────────────────────────────────────────────
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
      setGame((prev: any) => prev ? { ...prev, ...updated, ...updated.gameState } : updated);
    } catch { toast({ title: "Invalid Move", variant: "destructive" }); }
  }, [id, token, toast]);

  const handleCameraSquare = useCallback((sq: string) => {
    if (voiceSelection) { handleMove(voiceSelection, sq); setVoiceSelection(null); toast({ title: `${voiceSelection}→${sq}` }); }
    else { setVoiceSelection(sq); toast({ title: `${sq.toUpperCase()} selected`, description: "Hover destination" }); }
  }, [voiceSelection, handleMove]);

  // ── Socket ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token || !id) return;
    const loadGame = async () => {
      await fetch(`/api/games/${id}/join`, { method: "POST", headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
      try {
        const res = await fetch(`/api/games/${id}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error();
        setGame(await res.json());
      } catch { toast({ title: "Failed to load game", variant: "destructive" }); setLocation("/lobby"); }
    };
    loadGame();

    const sock = io({ path: "/api/socket.io", auth: { token } });
    sock.on("connect", () => { sock.emit("joinGame", { gameId: id }); if (user?.id) sock.emit("registerUser", { userId: user.id }); });
    sock.on("roomUpdate", (engineState: any) => { setGame((prev: any) => prev ? { ...prev, ...engineState } : engineState); });
    sock.on("chatMessage", (msg: any) => {
      setMessages(p => [...p, { sender: msg.username, text: msg.message }]);
      if (!showChat) setUnreadChat(n => n + 1);
    });
    sock.on("playerResigned", ({ resignedUserId, winner }: any) => {
      setGameOver({ winner, reason: resignedUserId !== user?.id ? "Your opponent resigned" : "You resigned" });
    });
    sock.on("drawOffered", () => setDrawOfferedByOpponent(true));
    sock.on("drawAccepted", () => { setDrawOfferSent(false); setGameOver({ winner: "draw", reason: "Draw agreed" }); });
    sock.on("drawDeclined", () => { setDrawOfferSent(false); toast({ title: "Draw offer declined" }); });
    setSocket(sock);
    return () => { sock.emit("leaveGame", { gameId: id }); sock.disconnect(); };
  }, [id, token, user?.id]);

  // Detect game end from engine state
  useEffect(() => {
    if (!game || gameOver) return;
    if (game.isCheckmate && game.turn) {
      const loserColor = game.turn;
      const winnerStr = loserColor === "w" ? "black" : "white";
      const iWin = (winnerStr === "white" && game.whitePlayerId === user?.id) || (winnerStr === "black" && game.blackPlayerId === user?.id);
      setGameOver({ winner: winnerStr, reason: iWin ? "You won by checkmate! 🎉" : "Opponent won by checkmate" });
    } else if (game.isDraw || game.isStalemate) {
      setGameOver({ winner: "draw", reason: game.isStalemate ? "Stalemate" : "Draw" });
    }
  }, [game?.isCheckmate, game?.isDraw, game?.isStalemate]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => { if (moveListRef.current) moveListRef.current.scrollTop = moveListRef.current.scrollHeight; }, [game?.moveHistory]);

  // ── Voice ────────────────────────────────────────────────────────────────────
  const toggleVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast({ title: "Voice not supported", variant: "destructive" }); return; }
    if (voiceActive) { recognitionRef.current?.stop(); recognitionRef.current = null; setVoiceActive(false); setVoiceTranscript(""); return; }
    const r = new SR(); r.continuous = true; r.interimResults = true; r.lang = "en-US";
    r.onresult = (e: any) => {
      const last = e.results[e.results.length - 1]; const text = last[0].transcript; setVoiceTranscript(text);
      if (last.isFinal) { setVoiceTranscript(""); const p = parseVoice(text); if (p) { handleMove(p.from, p.to); toast({ title: `Voice: ${p.from}→${p.to}` }); } }
    };
    r.onerror = () => { setVoiceActive(false); recognitionRef.current = null; };
    r.start(); recognitionRef.current = r; setVoiceActive(true);
  };
  useEffect(() => () => { recognitionRef.current?.stop(); }, []);

  const handleResign = () => {
    if (!resignConfirm) { setResignConfirm(true); setTimeout(() => setResignConfirm(false), 4000); return; }
    socket?.emit("resignGame", { gameId: id, userId: user?.id }); setResignConfirm(false);
  };

  const sendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMsg.trim() || !socket || !user) return;
    socket.emit("sendMessage", { gameId: id, userId: user.id, username: user.username, message: chatMsg });
    setMessages(p => [...p, { sender: user.username, text: chatMsg }]);
    setChatMsg("");
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  if (!game) return <div className="flex-1 flex items-center justify-center text-muted-foreground">Loading game...</div>;

  if (game.status === "waiting") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
        <img src="/icon.png" alt="" className="w-16 h-16 rounded-2xl object-cover animate-pulse" />
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">Waiting for Opponent</h2>
          <p className="text-muted-foreground text-sm">Share the link or wait for someone to join.</p>
          <p className="text-xs font-mono bg-muted px-3 py-1 rounded break-all">{window.location.href}</p>
        </div>
        <Button variant="outline" onClick={() => setLocation("/lobby")}><ArrowLeft className="w-4 h-4 mr-2" /> Back to Lobby</Button>
      </div>
    );
  }

  const fen = game.fen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const chess = new Chess(fen);
  const myColor = game.whitePlayerId === user?.id ? "w" : "b";
  const isMyTurn = chess.turn() === myColor && !gameOver;
  const flipped = myColor === "b";
  const lastMove = game.lastMove || null;
  const moveHistory: any[] = game.moveHistory || [];

  const opponentLabel = myColor === "w" ? "Black" : "White";
  const myLabel = myColor === "w" ? "White" : "Black";

  const iWon = gameOver && ((gameOver.winner === "white" && game.whitePlayerId === user?.id) || (gameOver.winner === "black" && game.blackPlayerId === user?.id));
  const isDraw = gameOver?.winner === "draw";

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">

      {/* ── Game over modal ── */}
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
              <Button className="flex-1" onClick={() => setLocation("/lobby")}><ArrowLeft className="w-4 h-4 mr-2" /> Lobby</Button>
              <Button variant="outline" className="flex-1" onClick={() => setLocation(`/history/${id}`)}>Analysis</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Draw offer dialog ── */}
      {drawOfferedByOpponent && !gameOver && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-card border border-border rounded-xl p-6 flex flex-col items-center gap-4 shadow-xl max-w-xs w-full mx-4 animate-in fade-in zoom-in duration-200">
            <Handshake className="w-10 h-10 text-blue-400" />
            <div className="text-center"><h3 className="font-bold text-lg">Draw Offered</h3><p className="text-sm text-muted-foreground">Accept?</p></div>
            <div className="flex gap-3 w-full">
              <Button className="flex-1" onClick={() => { socket?.emit("acceptDraw", { gameId: id }); setDrawOfferedByOpponent(false); }}>Accept</Button>
              <Button variant="outline" className="flex-1" onClick={() => { socket?.emit("declineDraw", { gameId: id }); setDrawOfferedByOpponent(false); }}>Decline</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Top bar: opponent ── */}
      <div className="h-14 shrink-0 flex items-center px-3 gap-3 bg-card border-b border-border">
        <button onClick={() => setLocation("/lobby")} className="text-muted-foreground hover:text-foreground transition-colors mr-1">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-9 h-9 bg-secondary rounded-full flex items-center justify-center font-bold text-sm shrink-0">O</div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm truncate">Opponent ({opponentLabel})</div>
          {!isMyTurn && !gameOver && <div className="text-xs text-muted-foreground">Thinking…</div>}
        </div>
        <div className="text-sm shrink-0">{myColor === "w" ? (game.capturedPieces?.black || []).join("") : (game.capturedPieces?.white || []).join("")}</div>
      </div>

      {/* ── Board ── */}
      <div ref={boardContainerRef} className="flex-1 min-h-0 flex items-center justify-center p-1 bg-background">
        <div className="h-full aspect-square max-w-full">
          <MultiplayerBoard fen={fen} onMove={handleMove} isPlayerTurn={isMyTurn} flipped={flipped} lastMove={lastMove} />
        </div>
      </div>

      {/* ── Voice transcript ── */}
      {voiceActive && voiceTranscript && (
        <div className="shrink-0 bg-primary/10 border-t border-primary/20 px-4 py-1.5 flex items-center gap-2 text-sm text-primary">
          <Mic className="w-3 h-3 animate-pulse shrink-0" /><span className="italic truncate">"{voiceTranscript}"</span>
        </div>
      )}
      {voiceSelection && (
        <div className="shrink-0 bg-orange-500/10 border-t border-orange-500/20 px-4 py-1.5 flex items-center gap-2 text-sm text-orange-400">
          <Camera className="w-3 h-3 shrink-0" /><span>Selected: <strong>{voiceSelection.toUpperCase()}</strong> — hover destination</span>
        </div>
      )}

      {/* ── Bottom bar: me + controls ── */}
      <div className="shrink-0 bg-card border-t border-border">
        <div className="h-14 flex items-center px-3 gap-3">
          <div className="w-9 h-9 bg-primary/20 text-primary rounded-full flex items-center justify-center font-bold text-sm shrink-0">
            {(user?.username || "Y").charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm truncate">{user?.username} ({myLabel})</div>
          </div>
          <div className="text-sm shrink-0">{myColor === "w" ? (game.capturedPieces?.white || []).join("") : (game.capturedPieces?.black || []).join("")}</div>
          {isMyTurn && <Badge variant="default" className="shrink-0 text-xs animate-pulse">Your turn</Badge>}

          {/* Action buttons */}
          {!gameOver && (
            <div className="flex items-center gap-1">
              {resignConfirm ? (
                <>
                  <button onClick={handleResign} className="px-2 py-1 text-xs bg-destructive text-destructive-foreground rounded font-medium">Confirm</button>
                  <button onClick={() => setResignConfirm(false)} className="p-2 rounded-lg hover:bg-muted"><X className="w-4 h-4" /></button>
                </>
              ) : (
                <>
                  <button onClick={handleResign} className="p-2 rounded-lg hover:bg-muted text-destructive transition-colors" title="Resign"><Flag className="w-4 h-4" /></button>
                  <button onClick={() => { if (!drawOfferSent) { socket?.emit("offerDraw", { gameId: id, userId: user?.id }); setDrawOfferSent(true); toast({ title: "Draw offered" }); } }}
                    disabled={drawOfferSent} className="p-2 rounded-lg hover:bg-muted disabled:opacity-40 transition-colors" title="Offer draw">
                    <Handshake className="w-4 h-4" />
                  </button>
                  <button onClick={toggleVoice} className={`p-2 rounded-lg transition-colors ${voiceActive ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`} title="Voice">
                    {voiceActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                  </button>
                  <button onClick={() => setCameraOpen(v => !v)} className={`p-2 rounded-lg transition-colors ${cameraOpen ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`} title="Hand camera">
                    {cameraOpen ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                  </button>
                </>
              )}
              <button onClick={() => { setShowChat(v => !v); setUnreadChat(0); }} className={`p-2 rounded-lg transition-colors relative ${showChat ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`} title="Chat">
                <MessageSquare className="w-4 h-4" />
                {unreadChat > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center">{unreadChat}</span>}
              </button>
              <button onClick={() => setShowMoves(v => !v)} className={`p-2 rounded-lg transition-colors ${showMoves ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`} title="Move list">
                <List className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Camera overlay ── */}
      {cameraOpen && (
        <CameraOverlay
          onClose={() => { setCameraOpen(false); setVoiceSelection(null); }}
          boardRef={boardContainerRef}
          onSquareSelect={handleCameraSquare}
        />
      )}

      {/* ── Move list overlay ── */}
      {showMoves && (
        <div className="absolute bottom-[57px] right-16 w-56 max-h-72 bg-card border border-border rounded-tl-xl shadow-2xl flex flex-col z-30">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
            <span className="text-sm font-bold">Moves</span>
            <button onClick={() => setShowMoves(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
          </div>
          <div className="overflow-auto p-2 text-xs font-mono" ref={moveListRef}>
            {moveHistory.length === 0 ? <div className="text-muted-foreground text-center py-3">No moves yet</div> : (
              Array.from({ length: Math.ceil(moveHistory.length / 2) }).map((_, i) => (
                <div key={i} className="flex gap-1 px-1 py-0.5 hover:bg-muted/50 rounded">
                  <span className="w-6 text-muted-foreground text-right shrink-0">{i+1}.</span>
                  <span className="flex-1 font-medium">{moveHistory[i*2]?.san}</span>
                  <span className="flex-1 text-muted-foreground">{moveHistory[i*2+1]?.san || ""}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Chat overlay ── */}
      {showChat && (
        <div className="absolute bottom-[57px] right-0 w-72 max-h-80 bg-card border border-border rounded-tl-xl shadow-2xl flex flex-col z-30">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
            <span className="text-sm font-bold">Chat</span>
            <button onClick={() => setShowChat(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
          </div>
          <div className="flex-1 overflow-auto p-2 space-y-1.5">
            {messages.length === 0 && <div className="text-xs text-muted-foreground text-center py-4">No messages yet</div>}
            {messages.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.sender === user?.username ? "items-end" : "items-start"}`}>
                <span className="text-[10px] text-muted-foreground">{msg.sender}</span>
                <div className={`px-2 py-1 rounded text-xs max-w-[90%] break-words ${msg.sender === user?.username ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{msg.text}</div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="p-2 border-t border-border shrink-0">
            <form onSubmit={sendChat} className="flex gap-1.5">
              <Input value={chatMsg} onChange={e => setChatMsg(e.target.value)} placeholder="Message..." className="flex-1 text-xs h-8" />
              <Button type="submit" size="icon" className="h-8 w-8 shrink-0"><Send className="w-3 h-3" /></Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
