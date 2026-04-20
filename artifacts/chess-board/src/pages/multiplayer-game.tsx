import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Chess } from "chess.js";
import { ArrowLeft, Flag, Send, Handshake, Mic, MicOff, Camera, CameraOff, X, Trophy, Minus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { io, Socket } from "socket.io-client";
import { Input } from "@/components/ui/input";

// ── Chess board component ─────────────────────────────────────────────────────

const PIECE_SYMBOLS: Record<string, string> = {
  P: "♙", N: "♘", B: "♗", R: "♖", Q: "♕", K: "♔",
  p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚",
};

const SimpleChessBoard = ({
  fen,
  onPieceDrop,
  isPlayerTurn,
  flipped = false,
}: {
  fen: string;
  onPieceDrop: (source: string, target: string) => void;
  isPlayerTurn: boolean;
  flipped?: boolean;
}) => {
  const chess = new Chess(fen);
  const rawBoard = chess.board();
  const board = flipped ? [...rawBoard].reverse().map((row) => [...row].reverse()) : rawBoard;

  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalTargets, setLegalTargets] = useState<string[]>([]);

  const sqName = (i: number, j: number) => {
    const file = String.fromCharCode(97 + (flipped ? 7 - j : j));
    const rank = flipped ? i + 1 : 8 - i;
    return `${file}${rank}`;
  };

  const handleSquareClick = (sq: string) => {
    if (!isPlayerTurn) return;

    if (selectedSquare) {
      if (legalTargets.includes(sq)) {
        onPieceDrop(selectedSquare, sq);
        setSelectedSquare(null);
        setLegalTargets([]);
      } else {
        const piece = chess.get(sq as any);
        if (piece && piece.color === chess.turn()) {
          setSelectedSquare(sq);
          const moves = chess.moves({ square: sq as any, verbose: true });
          setLegalTargets(moves.map((m: any) => m.to));
        } else {
          setSelectedSquare(null);
          setLegalTargets([]);
        }
      }
    } else {
      const piece = chess.get(sq as any);
      if (piece && piece.color === chess.turn()) {
        setSelectedSquare(sq);
        const moves = chess.moves({ square: sq as any, verbose: true });
        setLegalTargets(moves.map((m: any) => m.to));
      }
    }
  };

  return (
    <div className="w-full max-w-md aspect-square flex flex-col border-2 border-border rounded overflow-hidden shadow-xl">
      {board.map((row, i) => (
        <div key={i} className="flex-1 flex">
          {row.map((square, j) => {
            const isLight = (i + j) % 2 === 0;
            const sq = sqName(i, j);
            const isSelected = selectedSquare === sq;
            const isTarget = legalTargets.includes(sq);
            const pieceKey = square
              ? square.color === "w"
                ? square.type.toUpperCase()
                : square.type.toLowerCase()
              : null;

            return (
              <div
                key={j}
                className={`flex-1 flex items-center justify-center cursor-pointer relative select-none transition-colors
                  ${isLight ? "bg-[#f0d9b5]" : "bg-[#b58863]"}
                  ${isSelected ? "!bg-yellow-400/70" : ""}
                  ${isTarget && !square ? "after:absolute after:inset-[35%] after:rounded-full after:bg-black/20" : ""}
                  ${isTarget && square ? "!ring-2 !ring-inset !ring-yellow-400/80" : ""}`}
                onClick={() => handleSquareClick(sq)}
              >
                {square && (
                  <span
                    className={`text-[clamp(1rem,4.5vw,2.5rem)] leading-none drop-shadow-md select-none
                      ${square.color === "w" ? "text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]" : "text-[#1a1a1a] [text-shadow:0_1px_0_rgba(255,255,255,0.3)]"}`}
                  >
                    {pieceKey ? PIECE_SYMBOLS[pieceKey] : ""}
                  </span>
                )}
                {j === 0 && !flipped && (
                  <span className={`absolute top-0.5 left-0.5 text-[9px] font-bold ${isLight ? "text-[#b58863]" : "text-[#f0d9b5]"}`}>{8 - i}</span>
                )}
                {i === 7 && !flipped && (
                  <span className={`absolute bottom-0 right-0.5 text-[9px] font-bold ${isLight ? "text-[#b58863]" : "text-[#f0d9b5]"}`}>{String.fromCharCode(97 + j)}</span>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

// ── Voice command parser ──────────────────────────────────────────────────────

function parseVoiceCommand(text: string): { from: string; to: string } | null {
  const lower = text.toLowerCase().trim();
  // "e2 to e4", "e2 e4", "move e2 to e4"
  const squarePair = lower.match(/([a-h][1-8])\s+(?:to\s+)?([a-h][1-8])/);
  if (squarePair) return { from: squarePair[1], to: squarePair[2] };
  return null;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MultiplayerGamePage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [game, setGame] = useState<any>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [chatMsg, setChatMsg] = useState("");
  const [messages, setMessages] = useState<{ sender: string; text: string }[]>([]);

  // Game action states
  const [resignConfirm, setResignConfirm] = useState(false);
  const [drawOfferedByOpponent, setDrawOfferedByOpponent] = useState(false);
  const [drawOfferSent, setDrawOfferSent] = useState(false);
  const [gameOver, setGameOver] = useState<{ winner: string; reason: string } | null>(null);

  // Feature states
  const [voiceActive, setVoiceActive] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");

  const recognitionRef = useRef<any>(null);
  const socketRef = useRef<Socket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── Handle incoming moves via voice ──────────────────────────────────────
  const handlePieceDrop = useCallback(
    async (sourceSquare: string, targetSquare: string) => {
      try {
        const res = await fetch(`/api/games/${id}/move`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ move: `${sourceSquare}${targetSquare}` }),
        });
        if (!res.ok) throw new Error("Invalid move");
        const updated = await res.json();
        setGame(updated);
      } catch {
        toast({ title: "Invalid Move", variant: "destructive" });
      }
    },
    [id, token, toast]
  );

  // ── Socket setup ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token || !id) return;

    const loadGame = async () => {
      try {
        await fetch(`/api/games/${id}/join`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch { /* creator — ignore */ }

      try {
        const res = await fetch(`/api/games/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to load game");
        setGame(await res.json());
      } catch {
        toast({ title: "Error", description: "Failed to load game", variant: "destructive" });
        setLocation("/lobby");
      }
    };

    loadGame();

    const newSocket = io({ path: "/api/socket.io", auth: { token } });
    socketRef.current = newSocket;

    newSocket.on("connect", () => {
      newSocket.emit("joinGame", { gameId: id });
      if (user?.id) newSocket.emit("registerUser", { userId: user.id });
    });

    newSocket.on("roomUpdate", (updatedGame: any) => {
      setGame(updatedGame);
    });

    newSocket.on("chatMessage", (msg: any) => {
      setMessages((prev) => [...prev, { sender: msg.username, text: msg.message }]);
    });

    newSocket.on("playerResigned", ({ resignedUserId, winner }: { resignedUserId: string; winner: string }) => {
      const opponentResigned = resignedUserId !== user?.id;
      setGameOver({
        winner,
        reason: opponentResigned ? "Your opponent resigned" : "You resigned",
      });
    });

    newSocket.on("drawOffered", () => {
      setDrawOfferedByOpponent(true);
      toast({ title: "Opponent offers a draw", description: "Accept or decline below." });
    });

    newSocket.on("drawAccepted", () => {
      setDrawOfferSent(false);
      setGameOver({ winner: "draw", reason: "Draw agreed" });
    });

    newSocket.on("drawDeclined", () => {
      setDrawOfferSent(false);
      toast({ title: "Draw offer declined" });
    });

    setSocket(newSocket);

    return () => {
      newSocket.emit("leaveGame", { gameId: id });
      newSocket.disconnect();
    };
  }, [id, token, user?.id]);

  // Auto-detect checkmate / game-over from board state
  useEffect(() => {
    if (!game || gameOver) return;
    if (game.status === "completed" && game.winner) {
      setGameOver({ winner: game.winner, reason: "Game over" });
    }
  }, [game]);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Voice control ─────────────────────────────────────────────────────────
  const toggleVoice = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast({ title: "Voice control not supported in this browser", variant: "destructive" });
      return;
    }

    if (voiceActive) {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      setVoiceActive(false);
      setVoiceTranscript("");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      const lastResult = event.results[event.results.length - 1];
      const transcript = lastResult[0].transcript;
      setVoiceTranscript(transcript);

      if (lastResult.isFinal) {
        setVoiceTranscript("");
        const move = parseVoiceCommand(transcript);
        if (move) {
          handlePieceDrop(move.from, move.to);
          toast({ title: `Voice: ${transcript}`, description: `Moving ${move.from} → ${move.to}` });
        } else {
          toast({ title: `Heard: "${transcript}"`, description: "Say squares like 'e2 to e4'", variant: "destructive" });
        }
      }
    };

    recognition.onerror = () => {
      setVoiceActive(false);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      if (voiceActive) recognition.start();
    };

    recognition.start();
    recognitionRef.current = recognition;
    setVoiceActive(true);
    toast({ title: "Voice control on", description: "Say a move like 'e2 to e4'" });
  };

  // Clean up recognition on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleResign = () => {
    if (!resignConfirm) {
      setResignConfirm(true);
      return;
    }
    socket?.emit("resignGame", { gameId: id, userId: user?.id });
    setResignConfirm(false);
  };

  const handleOfferDraw = () => {
    if (drawOfferSent) return;
    socket?.emit("offerDraw", { gameId: id, userId: user?.id });
    setDrawOfferSent(true);
    toast({ title: "Draw offer sent" });
  };

  const handleAcceptDraw = () => {
    socket?.emit("acceptDraw", { gameId: id });
    setDrawOfferedByOpponent(false);
  };

  const handleDeclineDraw = () => {
    socket?.emit("declineDraw", { gameId: id });
    setDrawOfferedByOpponent(false);
  };

  const sendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMsg.trim() || !socket || !user) return;
    socket.emit("sendMessage", {
      gameId: id,
      userId: user.id,
      username: user.username,
      message: chatMsg,
    });
    setMessages((prev) => [...prev, { sender: user.username, text: chatMsg }]);
    setChatMsg("");
  };

  // ── Render states ─────────────────────────────────────────────────────────

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
          <p className="text-muted-foreground">Share the game link or wait for someone to join.</p>
          <p className="text-xs text-muted-foreground font-mono bg-muted px-3 py-1 rounded">
            {window.location.href}
          </p>
        </div>
        <Button variant="outline" onClick={() => setLocation("/lobby")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Lobby
        </Button>
      </div>
    );
  }

  const chess = new Chess(game.fen);
  const myColor = game.whitePlayerId === user?.id ? "w" : "b";
  const isMyTurn = chess.turn() === myColor && !gameOver;
  const flipped = myColor === "b";

  const opponentName =
    game.whitePlayerId === user?.id ? "Opponent (Black)" : "Opponent (White)";
  const myColorLabel = myColor === "w" ? "White" : "Black";

  const gameOverWinner = gameOver?.winner;
  const iWon =
    (gameOverWinner === "white" && game.whitePlayerId === user?.id) ||
    (gameOverWinner === "black" && game.blackPlayerId === user?.id);
  const isDraw = gameOverWinner === "draw";

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 relative">

      {/* ── Game over overlay ── */}
      {gameOver && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center gap-5 shadow-2xl max-w-sm w-full mx-4 animate-in fade-in zoom-in duration-300">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center ${iWon ? "bg-yellow-500/20" : isDraw ? "bg-blue-500/20" : "bg-red-500/20"}`}>
              {iWon ? <Trophy className="w-10 h-10 text-yellow-500" /> : isDraw ? <Minus className="w-10 h-10 text-blue-500" /> : <Flag className="w-10 h-10 text-red-500" />}
            </div>
            <div className="text-center space-y-1">
              <h2 className="text-2xl font-bold">
                {iWon ? "You Won!" : isDraw ? "Draw!" : "You Lost"}
              </h2>
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

      {/* ── Draw offer popup ── */}
      {drawOfferedByOpponent && !gameOver && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-card border border-border rounded-xl p-6 flex flex-col items-center gap-4 shadow-xl max-w-xs w-full mx-4 animate-in fade-in zoom-in duration-200">
            <Handshake className="w-10 h-10 text-blue-400" />
            <div className="text-center">
              <h3 className="font-bold text-lg">Draw Offered</h3>
              <p className="text-sm text-muted-foreground">Your opponent offers a draw. Accept?</p>
            </div>
            <div className="flex gap-3 w-full">
              <Button className="flex-1" onClick={handleAcceptDraw}>Accept</Button>
              <Button variant="outline" className="flex-1" onClick={handleDeclineDraw}>Decline</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Camera placeholder modal ── */}
      {cameraOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-card border border-border rounded-xl p-6 flex flex-col items-center gap-4 shadow-xl max-w-sm w-full mx-4 animate-in fade-in zoom-in duration-200">
            <div className="w-full aspect-video bg-muted rounded-lg flex flex-col items-center justify-center gap-3 border-2 border-dashed border-border">
              <Camera className="w-12 h-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground text-center px-4">
                Hand gesture detection coming soon.
                <br />
                This feature will let you move pieces with hand gestures.
              </p>
            </div>
            <Button variant="outline" className="w-full" onClick={() => setCameraOpen(false)}>
              <X className="w-4 h-4 mr-2" /> Close
            </Button>
          </div>
        </div>
      )}

      {/* ── Board area ─── */}
      <div className="lg:col-span-2 flex flex-col items-center space-y-3">
        {/* Opponent */}
        <div className="w-full max-w-md flex justify-between items-center bg-card p-3 rounded-lg border border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-secondary rounded flex items-center justify-center font-bold">O</div>
            <span className="font-bold">{opponentName}</span>
          </div>
          {!isMyTurn && !gameOver && (
            <Badge variant="default" className="animate-pulse">Thinking...</Badge>
          )}
        </div>

        <SimpleChessBoard
          fen={game.fen}
          onPieceDrop={handlePieceDrop}
          isPlayerTurn={isMyTurn}
          flipped={flipped}
        />

        {/* Voice transcript indicator */}
        {voiceActive && voiceTranscript && (
          <div className="w-full max-w-md bg-primary/10 border border-primary/20 rounded-lg px-4 py-2 text-sm text-primary flex items-center gap-2">
            <Mic className="w-4 h-4 animate-pulse shrink-0" />
            <span className="truncate italic">"{voiceTranscript}"</span>
          </div>
        )}

        {/* Me */}
        <div className="w-full max-w-md flex justify-between items-center bg-card p-3 rounded-lg border border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary/20 text-primary rounded flex items-center justify-center font-bold">
              {(user?.username || "Y").charAt(0).toUpperCase()}
            </div>
            <div>
              <span className="font-bold">{user?.username}</span>
              <span className="text-xs text-muted-foreground ml-2">({myColorLabel})</span>
            </div>
          </div>
          <Badge variant={isMyTurn ? "default" : "secondary"}>
            {isMyTurn ? "Your Turn" : "Waiting..."}
          </Badge>
        </div>

        {/* Game controls */}
        {!gameOver && (
          <div className="w-full max-w-md flex flex-wrap gap-2">
            {resignConfirm ? (
              <>
                <Button
                  variant="destructive"
                  size="sm"
                  className="flex-1"
                  onClick={handleResign}
                >
                  <Flag className="w-3 h-3 mr-1" /> Confirm Resign
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setResignConfirm(false)}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={handleResign}
                >
                  <Flag className="w-3 h-3 mr-1" /> Resign
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={handleOfferDraw}
                  disabled={drawOfferSent}
                >
                  <Handshake className="w-3 h-3 mr-1" />
                  {drawOfferSent ? "Draw Offered" : "Offer Draw"}
                </Button>
                <Button
                  variant={voiceActive ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={toggleVoice}
                  title={voiceActive ? "Disable voice control" : "Enable voice control"}
                >
                  {voiceActive ? <Mic className="w-3 h-3 mr-1" /> : <MicOff className="w-3 h-3 mr-1" />}
                  {voiceActive ? "Voice On" : "Voice"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setCameraOpen(true)}
                  title="Hand gesture control"
                >
                  <Camera className="w-3 h-3 mr-1" /> Camera
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Chat panel ─── */}
      <div className="space-y-4 h-[600px] flex flex-col">
        <Card className="bg-card border-border flex-1 flex flex-col min-h-0">
          <div className="p-4 border-b border-border flex justify-between items-center">
            <h3 className="font-bold">Chat</h3>
            {voiceActive && (
              <Badge variant="default" className="text-xs animate-pulse">
                <Mic className="w-3 h-3 mr-1" /> Listening
              </Badge>
            )}
          </div>
          <div className="flex-1 overflow-auto p-4 space-y-3">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex flex-col ${msg.sender === user?.username ? "items-end" : "items-start"}`}
              >
                <span className="text-xs text-muted-foreground mb-1">{msg.sender}</span>
                <div
                  className={`px-3 py-2 rounded-lg text-sm max-w-[80%] break-words ${
                    msg.sender === user?.username
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="p-4 border-t border-border">
            <form onSubmit={sendChat} className="flex gap-2">
              <Input
                value={chatMsg}
                onChange={(e) => setChatMsg(e.target.value)}
                placeholder="Type a message..."
                className="flex-1"
              />
              <Button type="submit" size="icon">
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </Card>
      </div>
    </div>
  );
}
