import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Chess } from "chess.js";
import {
  ArrowLeft, Flag, Send, Handshake, Mic, MicOff,
  Camera, X, Trophy, Minus, MessageSquare, List, Mouse, Hand, GripHorizontal,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { io, Socket } from "socket.io-client";
import { Input } from "@/components/ui/input";
import { usePreferences, type BoardTheme } from "@/hooks/use-preferences";

// ── Pieces ────────────────────────────────────────────────────────────────────

const SYM: Record<string, string> = {
  P:"♙",N:"♘",B:"♗",R:"♖",Q:"♕",K:"♔",
  p:"♟",n:"♞",b:"♝",r:"♜",q:"♛",k:"♚",
};

// ── Board ─────────────────────────────────────────────────────────────────────

function MultiplayerBoard({
  fen, onMove, isPlayerTurn, flipped, lastMove, theme,
}: {
  fen: string;
  onMove: (from: string, to: string, promotion?: string) => void;
  isPlayerTurn: boolean;
  flipped: boolean;
  lastMove: { from: string; to: string } | null;
  theme: BoardTheme;
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
                  className="flex-1 flex items-center justify-center cursor-pointer relative select-none transition-all duration-150"
                  style={{ background: sel ? theme.highlight : lm && !sel ? (light ? theme.lmLight : theme.lmDark) : (light ? theme.light : theme.dark) }}>
                  {tgt && !square && (
                    <div className="absolute inset-[32%] rounded-full pointer-events-none" style={{ background: theme.dotColor }} />
                  )}
                  {tgt && square && (
                    <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: `inset 0 0 0 3px ${theme.ringColor}` }} />
                  )}
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
    </div>
  );
}

// ── Camera (MediaPipe) ────────────────────────────────────────────────────────

function CameraOverlay({ onSquareSelect, flipped, trackingActive, onHoverChange }: {
  onClose?: () => void;
  boardRef?: React.RefObject<HTMLDivElement | null>;
  onSquareSelect: (sq: string) => void;
  flipped: boolean;
  trackingActive?: boolean;
  onHoverChange?: (sq: string | null) => void;
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

  // Map normalized (0-1) finger coords to a chess square.
  // The camera feed acts as a virtual board overlay:
  // top-left of the camera = top-left of the board as viewed by the player.
  // Cameras are typically mirrored, so we flip x to make pointing feel natural.
  const sqFromNorm = useCallback((nx: number, ny: number): string => {
    // Mirror x because webcam shows a mirrored view
    const mx = 1 - nx;
    // When board is flipped (playing as black), reverse both axes
    const fx = flipped ? 1 - mx : mx;
    const fy = flipped ? 1 - ny : ny;
    const fileIdx = Math.min(7, Math.max(0, Math.floor(fx * 8)));
    const rankIdx = Math.min(7, Math.max(0, Math.floor(fy * 8)));
    return `${String.fromCharCode(97 + fileIdx)}${8 - rankIdx}`;
  }, [flipped]);

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
      s.onerror = () => setStatus("Failed to load hand tracking library");
      document.head.appendChild(s);
    });
  }, []);

  useEffect(() => {
    if (!mpLoaded) return;
    const w = window as any;
    if (!w.Hands) { setStatus("Hand tracking unavailable"); return; }

    const hands = new w.Hands({
      locateFile: (f: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/${f}`,
    });
    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.5,
    });

    hands.onResults((results: any) => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const W = video.videoWidth || 320;
      const H = video.videoHeight || 240;
      canvas.width = W;
      canvas.height = H;

      // Draw mirrored video so the display feels like a mirror
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(video, -W, 0, W, H);
      ctx.restore();

      // Draw an 8x8 grid to help the user see the board mapping
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 0.5;
      for (let i = 1; i < 8; i++) {
        ctx.beginPath(); ctx.moveTo((i / 8) * W, 0); ctx.lineTo((i / 8) * W, H); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, (i / 8) * H); ctx.lineTo(W, (i / 8) * H); ctx.stroke();
      }

      if (results.multiHandLandmarks?.length > 0) {
        const lm = results.multiHandLandmarks[0];
        const tip = lm[8]; // index finger tip

        // Mirror x for display (since we drew the video mirrored)
        const dispX = (1 - tip.x) * W;
        const dispY = tip.y * H;

        // Draw connection lines and landmarks (on mirrored display)
        if (w.HAND_CONNECTIONS) {
          ctx.strokeStyle = "#6366f1";
          ctx.lineWidth = 2;
          for (const [a, b] of w.HAND_CONNECTIONS) {
            ctx.beginPath();
            ctx.moveTo((1 - lm[a].x) * W, lm[a].y * H);
            ctx.lineTo((1 - lm[b].x) * W, lm[b].y * H);
            ctx.stroke();
          }
        }
        lm.forEach((pt: any) => {
          ctx.beginPath(); ctx.arc((1 - pt.x) * W, pt.y * H, 3, 0, Math.PI * 2);
          ctx.fillStyle = "#fff"; ctx.fill();
        });

        // Highlight fingertip
        ctx.beginPath(); ctx.arc(dispX, dispY, 14, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(99,102,241,0.6)"; ctx.fill();
        ctx.strokeStyle = "white"; ctx.lineWidth = 2.5; ctx.stroke();

        // Map to square using normalized coords (tip.x/tip.y are raw, not mirrored)
        const sq = trackingActive !== false ? sqFromNorm(tip.x, tip.y) : "";
        setHoveredSq(sq || null);
        onHoverChange?.(sq || null);

        // Highlight the hovered cell on the grid
        const mx = 1 - tip.x; // mirrored x for display
        const cellX = Math.min(7, Math.max(0, Math.floor(mx * 8)));
        const cellY = Math.min(7, Math.max(0, Math.floor(tip.y * 8)));
        ctx.fillStyle = "rgba(99,102,241,0.25)";
        ctx.fillRect(cellX * (W / 8), cellY * (H / 8), W / 8, H / 8);

        // Dwell logic
        const now = Date.now();
        if (dwellRef.current?.sq === sq) {
          const elapsed = now - dwellRef.current.start;
          const pct = Math.min(elapsed / 1500, 1);
          setDwellPct(pct * 100);

          // Draw circular dwell progress around fingertip
          ctx.beginPath();
          ctx.arc(dispX, dispY, 20, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
          ctx.strokeStyle = "#a5b4fc"; ctx.lineWidth = 3; ctx.stroke();

          if (elapsed >= 1500) {
            onSquareSelect(sq);
            dwellRef.current = null;
            setDwellPct(0);
          }
        } else {
          dwellRef.current = { sq, start: now };
          setDwellPct(0);
        }

        setStatus("✋ Hold still over a square for 1.5s");
      } else {
        setStatus("Show your hand to the camera");
        setHoveredSq(null);
        onHoverChange?.(null);
        dwellRef.current = null;
        setDwellPct(0);
      }
    });

    handsRef.current = hands;

    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 320, height: 240 } })
      .then(stream => {
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        video.play();
        setStatus("Point at the grid to select squares");

        const loop = async () => {
          try {
            if (handsRef.current && video.readyState >= 2) {
              await handsRef.current.send({ image: video });
            }
          } catch {
            // WASM aborted or camera frame issue — skip frame silently
          }
          if (handsRef.current) requestAnimationFrame(loop);
        };
        loop();
      })
      .catch((err) => {
        setStatus(err.name === "NotAllowedError" ? "Camera permission denied" : "Camera unavailable");
      });

    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      handsRef.current = null;
    };
  }, [mpLoaded, sqFromNorm, onSquareSelect]);

  return (
    <div className="relative w-full bg-black" style={{ height: 200 }}>
      <video ref={videoRef} className="hidden" muted playsInline />
      <canvas ref={canvasRef} className="w-full h-full object-cover" />
      {trackingActive !== false && (
        <div className="absolute top-2 right-2 bg-green-500/90 text-black text-[10px] font-bold px-2 py-0.5 rounded">
          HAND TRACK
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-3 py-1.5 flex items-center justify-between">
        <span className="text-[10px] text-white/50">{status}</span>
        {dwellPct > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="w-20 h-1 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-400 transition-all duration-100" style={{ width: `${dwellPct}%` }} />
            </div>
            <span className="text-[10px] text-indigo-300">{Math.round(dwellPct)}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Draggable camera popup ────────────────────────────────────────────────────

function DraggableCameraPopup({
  onSquareSelect,
  flipped,
  handActive,
  onHoverChange,
  onClose,
  hoveredSq,
}: {
  onSquareSelect: (sq: string) => void;
  flipped: boolean;
  handActive: boolean;
  onHoverChange: (sq: string | null) => void;
  onClose: () => void;
  hoveredSq: string | null;
}) {
  const [pos, setPos] = useState(() => ({
    x: typeof window !== "undefined" ? Math.max(0, window.innerWidth - 310) : 40,
    y: 80,
  }));
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 288, e.clientX - offset.current.x)),
        y: Math.max(0, Math.min(window.innerHeight - 260, e.clientY - offset.current.y)),
      });
    };
    const onMouseUp = () => { dragging.current = false; };
    const onTouchMove = (e: TouchEvent) => {
      if (!dragging.current) return;
      e.preventDefault();
      const t = e.touches[0];
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 288, t.clientX - offset.current.x)),
        y: Math.max(0, Math.min(window.innerHeight - 260, t.clientY - offset.current.y)),
      });
    };
    const onTouchEnd = () => { dragging.current = false; };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  const startDrag = (clientX: number, clientY: number) => {
    dragging.current = true;
    offset.current = { x: clientX - pos.x, y: clientY - pos.y };
  };

  return (
    <div
      className="fixed z-50 rounded-xl overflow-hidden shadow-2xl border border-white/10 bg-[#1a1a1a] select-none"
      style={{ left: pos.x, top: pos.y, width: 288 }}
    >
      <div
        className="flex items-center justify-between px-3 py-2 bg-[#2a2a2a] cursor-grab active:cursor-grabbing"
        onMouseDown={e => { startDrag(e.clientX, e.clientY); e.preventDefault(); }}
        onTouchStart={e => { const t = e.touches[0]; startDrag(t.clientX, t.clientY); }}
      >
        <div className="flex items-center gap-2">
          <Camera className="w-3.5 h-3.5 text-white/60" />
          <span className="text-xs font-semibold text-white/80">Hand Camera</span>
          {handActive && (
            <span className="bg-green-500/20 text-green-400 text-[9px] font-bold px-1.5 py-0.5 rounded">LIVE</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-white/40">
          <GripHorizontal className="w-3.5 h-3.5" />
          <button onClick={onClose} className="hover:text-white/80 transition-colors ml-0.5">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <CameraOverlay
        onSquareSelect={onSquareSelect}
        flipped={flipped}
        trackingActive={handActive}
        onHoverChange={onHoverChange}
      />
      <div className="px-3 py-1.5 bg-black/80 flex items-center justify-between text-[10px]">
        {hoveredSq ? (
          <span className="text-white/50">HOVER <span className="text-white font-bold">{hoveredSq.toUpperCase()}</span></span>
        ) : (
          <span className="text-white/30">HOVER —</span>
        )}
        <span className="text-white/20 italic">drag to move</span>
      </div>
    </div>
  );
}

// ── Voice ─────────────────────────────────────────────────────────────────────

function parseVoice(text: string): { from: string; to: string } | null {
  const t = text.toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\bto\b/g, " ")
    .replace(/\bmove\b/g, " ")
    .replace(/\bfrom\b/g, " ")
    .trim();
  // Match two square names like "e2 e4", "e 2 e 4", "e2 to e4"
  const m = t.match(/([a-h]\s*[1-8])[\s,]+([a-h]\s*[1-8])/);
  if (!m) return null;
  const from = m[1].replace(/\s/g, "");
  const to = m[2].replace(/\s/g, "");
  return { from, to };
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function MultiplayerGamePage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { theme, playMove, playCheck, playGameEnd } = usePreferences();

  const [game, setGame] = useState<any>(null);
  const [opponentProfile, setOpponentProfile] = useState<{ nickname: string; avatarColor: string; country?: string } | null>(null);
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
  const [handActive, setHandActive] = useState(false);
  const [mouseActive, setMouseActive] = useState(true);
  const [hoveredSqFromCamera, setHoveredSqFromCamera] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [showMoves, setShowMoves] = useState(false);
  const [voiceSelection, setVoiceSelection] = useState<string | null>(null);
  const [unreadChat, setUnreadChat] = useState(0);

  const recognitionRef = useRef<any>(null);
  const handleMoveRef = useRef<((from: string, to: string, promotion?: string) => void) | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const moveListRef = useRef<HTMLDivElement>(null);

  // ── Move ─────────────────────────────────────────────────────────────────────
  const handleMove = useCallback(async (from: string, to: string, promotion?: string) => {
    const moveStr = promotion ? `${from}${to}${promotion}` : `${from}${to}`;
    try {
      const currentGame = await fetch(`/api/games/${id}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => null);
      const isCapture = currentGame ? !!new Chess(currentGame.fen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1").get(to as any) : false;
      const res = await fetch(`/api/games/${id}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ move: moveStr }),
      });
      if (!res.ok) throw new Error("Invalid move");
      const updated = await res.json();
      setGame((prev: any) => prev ? { ...prev, ...updated, ...updated.gameState } : updated);
      // Sound feedback
      if (updated.isCheckmate || updated.isDraw || updated.isStalemate) playGameEnd(true);
      else if (updated.isCheck) playCheck();
      else playMove(isCapture);
    } catch { toast({ title: "Invalid Move", variant: "destructive" }); }
  }, [id, token, toast, playMove, playCheck, playGameEnd]);

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
        const gameData = await res.json();
        setGame(gameData);
        // Fetch opponent profile
        const opponentId = gameData.whitePlayerId === user?.id ? gameData.blackPlayerId : gameData.whitePlayerId;
        if (opponentId) {
          try {
            const pr = await fetch(`/api/profiles?userIds=${opponentId}`);
            if (pr.ok) {
              const pd = await pr.json();
              const prof = pd.profiles?.[0];
              if (prof) setOpponentProfile({ nickname: prof.nickname, avatarColor: prof.avatarColor || "#3b82f6", country: prof.country });
            }
          } catch (_) {}
        }
      } catch { toast({ title: "Failed to load game", variant: "destructive" }); setLocation("/lobby"); }
    };
    loadGame();

    const sock = io({ path: "/api/socket.io", auth: { token } });
    sock.on("connect", () => { sock.emit("joinGame", { gameId: id }); if (user?.id) sock.emit("registerUser", { userId: user.id }); });
    sock.on("roomUpdate", (engineState: any) => {
      setGame((prev: any) => {
        if (prev && engineState.fen && engineState.fen !== prev.fen) {
          if (engineState.isCheckmate || engineState.isDraw || engineState.isStalemate) playGameEnd(false);
          else if (engineState.isCheck) playCheck();
          else playMove(false);
        }
        return prev ? { ...prev, ...engineState } : engineState;
      });
    });
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

  // Keep ref in sync so voice callback always calls the latest handleMove
  useEffect(() => { handleMoveRef.current = handleMove; }, [handleMove]);

  // ── Voice ────────────────────────────────────────────────────────────────────
  const toggleVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast({ title: "Voice control not supported", description: "Use Chrome or Edge for voice moves.", variant: "destructive" });
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
        const p = parseVoice(text);
        if (p) {
          handleMoveRef.current?.(p.from, p.to);
          toast({ title: `Voice move: ${p.from.toUpperCase()} → ${p.to.toUpperCase()}` });
        }
      }
    };
    r.onerror = (e: any) => {
      const msg = e.error === "not-allowed" ? "Microphone permission denied" : "Voice error — try again";
      toast({ title: msg, variant: "destructive" });
      setVoiceActive(false);
      recognitionRef.current = null;
    };
    r.onend = () => {
      // Auto-restart if still supposed to be active
      if (recognitionRef.current === r) {
        try { r.start(); } catch (_) {}
      }
    };
    r.start();
    recognitionRef.current = r;
    setVoiceActive(true);
    toast({ title: "Voice active 🎙️", description: "Say \"e2 to e4\" to move" });
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
        <div className="relative w-20 h-20 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-primary/20 animate-ping" />
          <div className="absolute inset-2 rounded-full border-4 border-primary/40 animate-ping" style={{ animationDelay: "200ms" }} />
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center relative z-10">
            <Flag className="w-6 h-6 text-primary" />
          </div>
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">Waiting for Opponent</h2>
          <p className="text-muted-foreground text-sm">Your challenge has been sent. The game will start once they accept.</p>
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

  const showCameraSection = cameraOpen || handActive;

  // Helper: player bar component
  const PlayerBar = ({ isMe }: { isMe: boolean }) => {
    const name = isMe ? (user?.username || "You") : (opponentProfile?.nickname || "Opponent");
    const label = isMe ? myLabel : opponentLabel;
    const avatarColor = isMe ? undefined : opponentProfile?.avatarColor;
    const captures = isMe
      ? (myColor === "w" ? game.capturedPieces?.white : game.capturedPieces?.black) || []
      : (myColor === "w" ? game.capturedPieces?.black : game.capturedPieces?.white) || [];
    const thinking = !isMe && !isMyTurn && !gameOver;

    return (
      <div className="flex items-center gap-3 w-full py-2">
        <div
          className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm text-white shrink-0 ${isMe ? "bg-primary/70" : ""}`}
          style={!isMe ? { background: avatarColor || "#64748b" } : {}}
        >
          {name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm leading-tight truncate text-foreground">
            {name}
          </div>
          <div className="text-[11px] text-muted-foreground leading-tight flex items-center gap-1.5">
            {label} Pieces
            {thinking && <span className="text-yellow-400 animate-pulse">• Thinking…</span>}
          </div>
        </div>
        <div className="text-xs text-muted-foreground font-mono shrink-0">
          {captures.join("")}
        </div>
        {isMe && isMyTurn && !gameOver && (
          <span className="shrink-0 text-[10px] bg-green-500 text-black font-bold px-2 py-0.5 rounded-full animate-pulse">
            Your turn
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 flex min-h-0 overflow-hidden bg-[#262421]">

      {/* ── Game over modal ── */}
      {gameOver && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-[#2c2c2c] border border-white/10 rounded-2xl p-8 flex flex-col items-center gap-5 shadow-2xl max-w-sm w-full mx-4 animate-in fade-in zoom-in duration-300">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center ${iWon ? "bg-yellow-500/20" : isDraw ? "bg-blue-500/20" : "bg-red-500/20"}`}>
              {iWon ? <Trophy className="w-10 h-10 text-yellow-400" /> : isDraw ? <Minus className="w-10 h-10 text-blue-400" /> : <Flag className="w-10 h-10 text-red-400" />}
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white">{iWon ? "You Won!" : isDraw ? "Draw!" : "You Lost"}</h2>
              <p className="text-white/50 text-sm mt-1">{gameOver.reason}</p>
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
        <div className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-[#2c2c2c] border border-white/10 rounded-xl p-6 flex flex-col items-center gap-4 shadow-xl max-w-xs w-full mx-4 animate-in fade-in zoom-in duration-200">
            <Handshake className="w-10 h-10 text-blue-400" />
            <div className="text-center"><h3 className="font-bold text-lg text-white">Draw Offered</h3><p className="text-sm text-white/50">Accept?</p></div>
            <div className="flex gap-3 w-full">
              <Button className="flex-1" onClick={() => { socket?.emit("acceptDraw", { gameId: id }); setDrawOfferedByOpponent(false); }}>Accept</Button>
              <Button variant="outline" className="flex-1" onClick={() => { socket?.emit("declineDraw", { gameId: id }); setDrawOfferedByOpponent(false); }}>Decline</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Board column (main area) ── */}
      <div className="flex-1 flex flex-col items-center justify-center min-h-0 min-w-0 px-2 py-2 lg:px-4 lg:py-3">

        {/* Back button — sits above board column */}
        <div className="w-full flex items-center gap-2 mb-1" style={{ maxWidth: "min(100%, calc(100vh - 260px))" }}>
          <button onClick={() => setLocation("/lobby")} className="text-white/40 hover:text-white/80 transition-colors flex items-center gap-1.5 text-xs">
            <ArrowLeft className="w-4 h-4" /> Back to lobby
          </button>
          <div className="flex-1" />
          {/* Live sync */}
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            <span className="text-[10px] text-green-400 font-medium">Live</span>
          </div>
        </div>

        {/* Opponent bar */}
        <div className="w-full" style={{ maxWidth: "min(100%, calc(100vh - 260px))" }}>
          <PlayerBar isMe={false} />
        </div>

        {/* Board */}
        <div
          ref={boardContainerRef}
          className="w-full shrink-0"
          style={{ maxWidth: "min(100%, calc(100vh - 260px))", aspectRatio: "1" }}
        >
          <MultiplayerBoard
            fen={fen}
            onMove={mouseActive ? handleMove : () => {}}
            isPlayerTurn={isMyTurn && mouseActive}
            flipped={flipped}
            lastMove={lastMove}
            theme={theme}
          />
        </div>

        {/* My bar */}
        <div className="w-full" style={{ maxWidth: "min(100%, calc(100vh - 260px))" }}>
          <PlayerBar isMe={true} />
        </div>

        {/* ── Controls toolbar ── */}
        <div className="w-full shrink-0" style={{ maxWidth: "min(100%, calc(100vh - 260px))" }}>
          {/* Voice transcript */}
          {voiceActive && voiceTranscript && (
            <div className="flex items-center gap-2 text-xs text-primary mb-1.5 px-1">
              <Mic className="w-3 h-3 animate-pulse shrink-0" />
              <span className="italic truncate">"{voiceTranscript}"</span>
            </div>
          )}
          {voiceSelection && (
            <div className="flex items-center gap-2 text-xs text-orange-400 mb-1.5 px-1">
              <Hand className="w-3 h-3 shrink-0" />
              <span>Selected: <strong>{voiceSelection.toUpperCase()}</strong> — hover destination</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Pill toggles */}
            {[
              { label: mouseActive ? "Mouse" : "Mouse", icon: <Mouse className="w-3 h-3" />, active: mouseActive, onClick: () => setMouseActive(v => !v) },
              { label: "Camera", icon: <Camera className="w-3 h-3" />, active: cameraOpen, onClick: () => setCameraOpen(v => !v) },
              { label: "Hand", icon: <Hand className="w-3 h-3" />, active: handActive, onClick: () => { setHandActive(v => { const n = !v; if (n) setCameraOpen(true); return n; }); setVoiceSelection(null); } },
              { label: "Voice", icon: voiceActive ? <Mic className="w-3 h-3 animate-pulse" /> : <MicOff className="w-3 h-3" />, active: voiceActive, onClick: toggleVoice },
            ].map(({ label, icon, active, onClick }) => (
              <button
                key={label}
                onClick={onClick}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium border transition-all ${
                  active
                    ? "bg-[#81b64c]/20 border-[#81b64c]/60 text-[#81b64c]"
                    : "bg-white/5 border-white/10 text-white/40 hover:text-white/60 hover:border-white/20"
                }`}
              >
                {icon} {label} {active ? "ON" : "OFF"}
              </button>
            ))}

            <div className="flex-1" />

            {/* Icon actions */}
            {!gameOver && (
              <>
                {resignConfirm ? (
                  <>
                    <button onClick={handleResign} className="px-2 py-1 text-[10px] bg-red-600 text-white rounded font-medium">Confirm?</button>
                    <button onClick={() => setResignConfirm(false)} className="p-1.5 text-white/40 hover:text-white/70"><X className="w-3.5 h-3.5" /></button>
                  </>
                ) : (
                  <>
                    <button onClick={handleResign} className="p-1.5 text-white/30 hover:text-red-400 transition-colors" title="Resign"><Flag className="w-4 h-4" /></button>
                    <button onClick={() => { if (!drawOfferSent) { socket?.emit("offerDraw", { gameId: id, userId: user?.id }); setDrawOfferSent(true); toast({ title: "Draw offered" }); } }}
                      disabled={drawOfferSent} className="p-1.5 text-white/30 hover:text-white/70 disabled:opacity-20 transition-colors" title="Offer draw">
                      <Handshake className="w-4 h-4" />
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:flex w-60 xl:w-72 flex-col border-l border-white/5 bg-[#1f1d1a] shrink-0">
        {/* Move list */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 shrink-0">
          <span className="text-xs font-semibold text-white/60 uppercase tracking-widest">Moves</span>
          <button onClick={() => setShowMoves(v => !v)} className={`text-white/30 hover:text-white/60 transition-colors ${showMoves ? "text-white/60" : ""}`}>
            <List className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-2 text-xs font-mono" ref={moveListRef}>
          {moveHistory.length === 0 ? (
            <div className="text-white/20 text-center py-6">No moves yet</div>
          ) : (
            Array.from({ length: Math.ceil(moveHistory.length / 2) }).map((_, i) => (
              <div key={i} className="flex gap-1 px-2 py-0.5 hover:bg-white/5 rounded">
                <span className="w-6 text-white/30 text-right shrink-0">{i + 1}.</span>
                <span className="flex-1 text-white/80">{moveHistory[i * 2]?.san}</span>
                <span className="flex-1 text-white/50">{moveHistory[i * 2 + 1]?.san || ""}</span>
              </div>
            ))
          )}
        </div>

        {/* Chat */}
        <div className="border-t border-white/5 shrink-0">
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
            <span className="text-xs font-semibold text-white/60 uppercase tracking-widest">Chat</span>
            {unreadChat > 0 && <span className="w-4 h-4 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center">{unreadChat}</span>}
          </div>
          <div className="max-h-36 overflow-auto p-2 space-y-1">
            {messages.length === 0 && <div className="text-xs text-white/20 text-center py-2">No messages</div>}
            {messages.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.sender === user?.username ? "items-end" : "items-start"}`}>
                <span className="text-[9px] text-white/30">{msg.sender}</span>
                <div className={`px-2 py-1 rounded text-[11px] max-w-[90%] break-words ${msg.sender === user?.username ? "bg-[#81b64c]/80 text-black" : "bg-white/10 text-white/80"}`}>{msg.text}</div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="p-2">
            <form onSubmit={sendChat} className="flex gap-1.5">
              <Input value={chatMsg} onChange={e => setChatMsg(e.target.value)} placeholder="Message…" className="flex-1 text-xs h-7 bg-white/5 border-white/10 text-white placeholder:text-white/20" />
              <Button type="submit" size="icon" className="h-7 w-7 shrink-0 bg-[#81b64c] hover:bg-[#81b64c]/80"><Send className="w-3 h-3 text-black" /></Button>
            </form>
          </div>
        </div>
      </aside>

      {/* ── Mobile: chat + moves sheets (slide up) ── */}
      {showMoves && (
        <div className="fixed bottom-0 inset-x-0 z-40 lg:hidden bg-[#1f1d1a] border-t border-white/10 max-h-60 flex flex-col">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 shrink-0">
            <span className="text-xs font-semibold text-white/60">Moves</span>
            <button onClick={() => setShowMoves(false)}><X className="w-4 h-4 text-white/40" /></button>
          </div>
          <div className="overflow-auto p-2 text-xs font-mono" ref={moveListRef}>
            {moveHistory.length === 0 ? <div className="text-white/20 text-center py-3">No moves yet</div> : (
              Array.from({ length: Math.ceil(moveHistory.length / 2) }).map((_, i) => (
                <div key={i} className="flex gap-1 px-2 py-0.5 hover:bg-white/5 rounded">
                  <span className="w-6 text-white/30 text-right shrink-0">{i + 1}.</span>
                  <span className="flex-1 text-white/80">{moveHistory[i * 2]?.san}</span>
                  <span className="flex-1 text-white/50">{moveHistory[i * 2 + 1]?.san || ""}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
      {showChat && (
        <div className="fixed bottom-0 inset-x-0 z-40 lg:hidden bg-[#1f1d1a] border-t border-white/10 flex flex-col" style={{ maxHeight: 260 }}>
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 shrink-0">
            <span className="text-xs font-semibold text-white/60">Chat</span>
            <button onClick={() => setShowChat(false)}><X className="w-4 h-4 text-white/40" /></button>
          </div>
          <div className="flex-1 overflow-auto p-2 space-y-1.5">
            {messages.length === 0 && <div className="text-xs text-white/20 text-center py-4">No messages</div>}
            {messages.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.sender === user?.username ? "items-end" : "items-start"}`}>
                <span className="text-[10px] text-white/30">{msg.sender}</span>
                <div className={`px-2 py-1 rounded text-xs max-w-[90%] break-words ${msg.sender === user?.username ? "bg-[#81b64c]/80 text-black" : "bg-white/10 text-white/80"}`}>{msg.text}</div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="p-2 border-t border-white/10 shrink-0">
            <form onSubmit={sendChat} className="flex gap-1.5">
              <Input value={chatMsg} onChange={e => setChatMsg(e.target.value)} placeholder="Message…" className="flex-1 text-xs h-8 bg-white/5 border-white/10 text-white placeholder:text-white/20" />
              <Button type="submit" size="icon" className="h-8 w-8 shrink-0 bg-[#81b64c] hover:bg-[#81b64c]/80"><Send className="w-3 h-3 text-black" /></Button>
            </form>
          </div>
        </div>
      )}

      {/* Mobile chat/moves toggle buttons — bottom right */}
      <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-30 lg:hidden">
        <button onClick={() => { setShowChat(v => !v); setUnreadChat(0); setShowMoves(false); }}
          className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg border transition-colors relative ${showChat ? "bg-[#81b64c] border-[#81b64c] text-black" : "bg-[#2c2c2c] border-white/10 text-white/50 hover:text-white/80"}`}>
          <MessageSquare className="w-4 h-4" />
          {unreadChat > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center">{unreadChat}</span>}
        </button>
        <button onClick={() => { setShowMoves(v => !v); setShowChat(false); }}
          className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg border transition-colors ${showMoves ? "bg-[#81b64c] border-[#81b64c] text-black" : "bg-[#2c2c2c] border-white/10 text-white/50 hover:text-white/80"}`}>
          <List className="w-4 h-4" />
        </button>
      </div>

      {/* ── Draggable camera popup ── */}
      {showCameraSection && (
        <DraggableCameraPopup
          onSquareSelect={handleCameraSquare}
          flipped={flipped}
          handActive={handActive}
          onHoverChange={setHoveredSqFromCamera}
          onClose={() => { setCameraOpen(false); setHandActive(false); setVoiceSelection(null); }}
          hoveredSq={hoveredSqFromCamera}
        />
      )}
    </div>
  );
}
