import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Chess } from "chess.js";
import { ArrowLeft, Flag, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { io, Socket } from "socket.io-client";
import { Input } from "@/components/ui/input";

const SimpleChessBoard = ({ fen, onPieceDrop, isPlayerTurn }: { fen: string, onPieceDrop: (source: string, target: string) => void, isPlayerTurn: boolean }) => {
  const chess = new Chess(fen);
  const board = chess.board();
  
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);

  const handleSquareClick = (square: string) => {
    if (!isPlayerTurn) return;

    if (selectedSquare) {
      onPieceDrop(selectedSquare, square);
      setSelectedSquare(null);
    } else {
      const piece = chess.get(square as any);
      if (piece) setSelectedSquare(square);
    }
  };

  const getPieceSymbol = (p: any) => {
    if (!p) return "";
    const symbols: Record<string, string> = {
      p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚",
      P: "♙", N: "♘", B: "♗", R: "♖", Q: "♕", K: "♔"
    };
    const key = p.color === 'w' ? p.type.toUpperCase() : p.type.toLowerCase();
    return symbols[key] || p.type;
  };

  return (
    <div className="w-full max-w-md aspect-square bg-[#769656] flex flex-col border-4 border-[#333]">
      {board.map((row, i) => (
        <div key={i} className="flex-1 flex">
          {row.map((square, j) => {
            const isBlack = (i + j) % 2 === 1;
            const file = String.fromCharCode(97 + j);
            const rank = 8 - i;
            const sqName = `${file}${rank}`;
            const isSelected = selectedSquare === sqName;
            
            return (
              <div 
                key={j} 
                className={`flex-1 flex items-center justify-center cursor-pointer relative
                  ${isBlack ? 'bg-[#769656]' : 'bg-[#eeeed2]'} 
                  ${isSelected ? 'bg-yellow-400/50' : ''}`}
                onClick={() => handleSquareClick(sqName)}
              >
                {square && (
                  <span className={`text-4xl select-none ${square.color === 'w' ? 'text-white drop-shadow-md' : 'text-black'}`}>
                    {getPieceSymbol(square)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default function MultiplayerGamePage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [game, setGame] = useState<any>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [chatMsg, setChatMsg] = useState("");
  const [messages, setMessages] = useState<{sender: string, text: string}[]>([]);

  useEffect(() => {
    if (!token || !id) return;

    const loadGame = async () => {
      try {
        // Try to join — a 400 here means we're the creator, that's fine
        await fetch(`/api/games/${id}/join`, { 
          method: "POST", 
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (_) { /* ignore */ }

      try {
        const res = await fetch(`/api/games/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Failed to load game");
        setGame(await res.json());
      } catch (err) {
        toast({ title: "Error", description: "Failed to load game", variant: "destructive" });
        setLocation("/lobby");
      }
    };

    loadGame();

    const newSocket = io({
      path: "/api/socket.io",
      auth: { token }
    });

    newSocket.on("connect", () => {
      newSocket.emit("joinGame", { gameId: id });
      if (user?.id) newSocket.emit("registerUser", { userId: user.id });
    });

    newSocket.on("roomUpdate", (updatedGame: any) => {
      setGame(updatedGame);
    });

    newSocket.on("chatMessage", (msg: any) => {
      setMessages(prev => [...prev, { sender: msg.username, text: msg.message }]);
    });

    setSocket(newSocket);

    return () => {
      newSocket.emit("leaveGame", { gameId: id });
      newSocket.disconnect();
    };
  }, [id, token, user?.id]);

  const handlePieceDrop = async (sourceSquare: string, targetSquare: string) => {
    try {
      const res = await fetch(`/api/games/${id}/move`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ move: `${sourceSquare}${targetSquare}` })
      });
      if (!res.ok) throw new Error("Invalid move");
      const updated = await res.json();
      setGame(updated);
    } catch (err) {
      toast({ title: "Invalid Move", variant: "destructive" });
    }
  };

  const sendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMsg.trim() || !socket || !user) return;
    socket.emit("sendMessage", { gameId: id, userId: user.id, username: user.username, message: chatMsg });
    setMessages(prev => [...prev, { sender: user.username, text: chatMsg }]);
    setChatMsg("");
  };

  if (!game) return <div className="p-8 text-center text-muted-foreground">Loading game...</div>;

  if (game.status === "waiting") {
    return (
      <div className="p-8 flex flex-col items-center justify-center gap-6 min-h-[60vh]">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
          <ArrowLeft className="w-8 h-8 text-primary rotate-180" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">Waiting for Opponent</h2>
          <p className="text-muted-foreground">Share the game link or wait for someone to join.</p>
          <p className="text-xs text-muted-foreground font-mono bg-muted px-3 py-1 rounded">{window.location.href}</p>
        </div>
        <Button variant="outline" onClick={() => setLocation("/lobby")}><ArrowLeft className="w-4 h-4 mr-2" /> Back to Lobby</Button>
      </div>
    );
  }

  const chess = new Chess(game.fen);
  const myColor = game.whitePlayerId === user?.id ? 'w' : 'b';
  const isMyTurn = chess.turn() === myColor;
  const opponentName = game.whitePlayerId === user?.id ? "Opponent (Black)" : "Opponent (White)";

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 flex flex-col items-center space-y-4">
        <div className="w-full max-w-md flex justify-between items-center bg-card p-3 rounded-lg border border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-secondary rounded flex items-center justify-center font-bold">O</div>
            <span className="font-bold">{opponentName}</span>
          </div>
        </div>

        <SimpleChessBoard fen={game.fen} onPieceDrop={handlePieceDrop} isPlayerTurn={isMyTurn} />

        <div className="w-full max-w-md flex justify-between items-center bg-card p-3 rounded-lg border border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary/20 text-primary rounded flex items-center justify-center font-bold">ME</div>
            <span className="font-bold">{user?.username}</span>
          </div>
          <Badge variant={isMyTurn ? "default" : "secondary"}>
            {isMyTurn ? "Your Turn" : "Waiting..."}
          </Badge>
        </div>
      </div>

      <div className="space-y-4 h-[600px] flex flex-col">
        <Card className="bg-card border-border flex-1 flex flex-col min-h-0">
          <div className="p-4 border-b border-border flex justify-between items-center">
            <h3 className="font-bold">Chat</h3>
          </div>
          <div className="flex-1 overflow-auto p-4 space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.sender === user?.username ? 'items-end' : 'items-start'}`}>
                <span className="text-xs text-muted-foreground mb-1">{msg.sender}</span>
                <div className={`px-3 py-2 rounded-lg text-sm ${msg.sender === user?.username ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  {msg.text}
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-border">
            <form onSubmit={sendChat} className="flex gap-2">
              <Input value={chatMsg} onChange={e => setChatMsg(e.target.value)} placeholder="Type a message..." className="flex-1" />
              <Button type="submit" size="icon"><Send className="w-4 h-4" /></Button>
            </form>
          </div>
        </Card>
      </div>
    </div>
  );
}
