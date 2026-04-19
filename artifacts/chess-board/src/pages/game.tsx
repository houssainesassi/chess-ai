import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useGetGameHistory, useGetGameState, useMakeMove, useUndoLastMove, useResetGame } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Chess } from "chess.js";
import { ArrowLeft, RotateCcw, RotateCw, Flag, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// A simple mock chess board component. In a real app we'd use react-chessboard or similar.
const SimpleChessBoard = ({ fen, onPieceDrop }: { fen: string, onPieceDrop: (source: string, target: string) => void }) => {
  const chess = new Chess(fen);
  const board = chess.board();
  
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);

  const handleSquareClick = (square: string) => {
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
                {j === 0 && <span className={`absolute top-0.5 left-0.5 text-[10px] ${isBlack ? 'text-[#eeeed2]' : 'text-[#769656]'}`}>{rank}</span>}
                {i === 7 && <span className={`absolute bottom-0.5 right-0.5 text-[10px] ${isBlack ? 'text-[#eeeed2]' : 'text-[#769656]'}`}>{file}</span>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default function GamePage() {
  const { data: gameState, refetch: refetchState } = useGetGameState();
  const { data: gameHistory, refetch: refetchHistory } = useGetGameHistory();
  const makeMove = useMakeMove();
  const undoMove = useUndoLastMove();
  const resetGame = useResetGame();
  const { toast } = useToast();

  const handlePieceDrop = async (sourceSquare: string, targetSquare: string) => {
    try {
      await makeMove.mutateAsync({ data: { move: `${sourceSquare}${targetSquare}`, source: "ui" } });
      refetchState();
      refetchHistory();
    } catch (err: any) {
      toast({ title: "Invalid Move", variant: "destructive" });
    }
  };

  const handleUndo = async () => {
    try {
      await undoMove.mutateAsync();
      refetchState();
      refetchHistory();
    } catch (err) {
      toast({ title: "Cannot undo", variant: "destructive" });
    }
  };

  const handleReset = async () => {
    try {
      await resetGame.mutateAsync();
      refetchState();
      refetchHistory();
    } catch (err) {
      toast({ title: "Cannot reset", variant: "destructive" });
    }
  };

  if (!gameState) return <div className="p-8 text-center">Loading game...</div>;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 flex flex-col items-center space-y-4">
        <div className="w-full max-w-md flex justify-between items-center bg-card p-3 rounded-lg border border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-purple-500/20 text-purple-500 rounded flex items-center justify-center font-bold">AI</div>
            <span className="font-bold">Stockfish lvl 4</span>
          </div>
          <Badge variant="outline">2000</Badge>
        </div>

        <SimpleChessBoard fen={gameState.fen} onPieceDrop={handlePieceDrop} />

        <div className="w-full max-w-md flex justify-between items-center bg-card p-3 rounded-lg border border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary/20 text-primary rounded flex items-center justify-center font-bold">ME</div>
            <span className="font-bold">You</span>
          </div>
          <Badge variant="outline">1200</Badge>
        </div>
      </div>

      <div className="space-y-4">
        <Card className="bg-card border-border flex flex-col h-[500px]">
          <div className="p-4 border-b border-border flex justify-between items-center">
            <h3 className="font-bold">Move History</h3>
          </div>
          <div className="flex-1 overflow-auto p-4 space-y-2">
            {gameHistory?.moves && gameHistory.moves.length > 0 ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm font-mono">
                {gameHistory.moves.reduce((result: any[], move, index) => {
                  if (index % 2 === 0) {
                    result.push([move]);
                  } else {
                    result[result.length - 1].push(move);
                  }
                  return result;
                }, []).map((pair, i) => (
                  <div key={i} className="col-span-2 flex hover:bg-muted p-1 rounded">
                    <span className="w-8 text-muted-foreground">{i + 1}.</span>
                    <span className="flex-1">{pair[0].san}</span>
                    <span className="flex-1">{pair[1] ? pair[1].san : ""}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                Game has not started
              </div>
            )}
          </div>
          <div className="p-4 border-t border-border flex gap-2">
            <Button variant="outline" className="flex-1" onClick={handleUndo}><ArrowLeft className="w-4 h-4 mr-2"/> Undo</Button>
            <Button variant="outline" className="flex-1 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleReset}><Flag className="w-4 h-4 mr-2"/> Resign</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
