import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Chess } from "chess.js";
import { ArrowLeft, ChevronLeft, ChevronRight, Play, Pause } from "lucide-react";
import { Link } from "wouter";
import { Progress } from "@/components/ui/progress";

export default function HistoryReplayPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const [game, setGame] = useState<any>(null);
  const [moveHistory, setMoveHistory] = useState<any[]>([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [chess] = useState(new Chess());
  const [fen, setFen] = useState(chess.fen());
  const [analysis, setAnalysis] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    async function loadGame() {
      try {
        const res = await fetch(`/api/games/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setGame(data);
          // Reconstruct move history from PGN or UCI moves array
          const temp = new Chess();
          let history: any[] = [];
          if (data.pgn && data.pgn.trim()) {
            try {
              temp.loadPgn(data.pgn);
              history = temp.history({ verbose: true });
            } catch (_) {}
          } else if (Array.isArray(data.moves) && data.moves.length > 0) {
            for (const uci of data.moves) {
              const from = uci.slice(0, 2);
              const to = uci.slice(2, 4);
              const promotion = uci.length === 5 ? uci[4] : undefined;
              const move = temp.move({ from, to, promotion });
              if (move) history.push(move);
            }
          }
          setMoveHistory(history);
          if (history.length > 0) {
            chess.reset();
            history.forEach(m => chess.move(m.san));
            setFen(chess.fen());
            setCurrentMoveIndex(history.length - 1);
          }
        }
      } catch (err) {
        console.error(err);
      }
    }
    if (token && id) loadGame();
  }, [id, token]);

  useEffect(() => {
    if (!game || moveHistory.length === 0) return;
    
    chess.reset();
    for (let i = 0; i <= currentMoveIndex; i++) {
      if (moveHistory[i]) chess.move(moveHistory[i].san);
    }
    const newFen = chess.fen();
    setFen(newFen);

    async function getAnalysis() {
      setAnalyzing(true);
      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fen: newFen, depth: 10 })
        });
        if (res.ok) setAnalysis(await res.json());
      } catch (_) {
      } finally {
        setAnalyzing(false);
      }
    }
    
    const timer = setTimeout(getAnalysis, 500);
    return () => clearTimeout(timer);
  }, [currentMoveIndex, game, moveHistory]);

  const goToMove = (index: number) => {
    setCurrentMoveIndex(index);
  };

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'best': return 'bg-blue-500';
      case 'excellent': return 'bg-green-500';
      case 'good': return 'bg-green-400';
      case 'inaccuracy': return 'bg-yellow-500';
      case 'mistake': return 'bg-orange-500';
      case 'blunder': return 'bg-red-600';
      default: return 'bg-gray-500';
    }
  };

  if (!game) return <div className="p-8 text-center">Loading game replay...</div>;

  const evaluationScore = analysis?.evaluationScore ? analysis.evaluationScore / 100 : 0;
  const evalPercentage = Math.max(0, Math.min(100, 50 + (evaluationScore * 5)));

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-4">
        <Link href="/history">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <h1 className="text-2xl font-bold">Game Analysis</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col items-center">
          <div className="w-full max-w-md flex items-center mb-2 h-4 bg-muted rounded overflow-hidden">
             <div className="h-full bg-white transition-all duration-300" style={{ width: `${evalPercentage}%` }}></div>
             <div className="h-full bg-black transition-all duration-300" style={{ width: `${100 - evalPercentage}%` }}></div>
          </div>

          <div className="w-full max-w-md aspect-square bg-[#769656] flex flex-col border-4 border-[#333]">
            {/* Simple board rendering */}
            {new Chess(fen).board().map((row, i) => (
              <div key={i} className="flex-1 flex">
                {row.map((square, j) => {
                  const isBlack = (i + j) % 2 === 1;
                  return (
                    <div key={j} className={`flex-1 flex items-center justify-center ${isBlack ? 'bg-[#769656]' : 'bg-[#eeeed2]'}`}>
                      {square && (
                        <span className={`text-4xl select-none ${square.color === 'w' ? 'text-white drop-shadow-md' : 'text-black'}`}>
                          {square.type === 'p' ? '♟' : square.type === 'n' ? '♞' : square.type === 'b' ? '♝' : square.type === 'r' ? '♜' : square.type === 'q' ? '♛' : '♚'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="w-full max-w-md mt-6 flex justify-center gap-2">
            <Button variant="outline" size="icon" onClick={() => goToMove(0)} disabled={currentMoveIndex <= 0}><ChevronLeft className="w-4 h-4" /></Button>
            <Button variant="outline" size="icon" onClick={() => goToMove(currentMoveIndex - 1)} disabled={currentMoveIndex <= 0}><ChevronLeft className="w-4 h-4" /></Button>
            <Button variant="outline" size="icon" onClick={() => goToMove(currentMoveIndex + 1)} disabled={currentMoveIndex >= moveHistory.length - 1}><ChevronRight className="w-4 h-4" /></Button>
          </div>

          {analysis && (
            <Card className="w-full max-w-md mt-6 bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={getQualityColor(analysis.moveQuality || 'good')}>
                    {analysis.moveQuality?.toUpperCase() || 'GOOD'}
                  </Badge>
                  <span className="font-bold text-lg">{analysis.evaluation}</span>
                </div>
                <h4 className="font-bold mb-1">{analysis.reviewTitle || "Solid Move"}</h4>
                <p className="text-sm text-muted-foreground">{analysis.reviewCommentary || "This move maintains your position."}</p>
                <div className="mt-4 text-sm text-muted-foreground">
                  <span className="font-bold text-foreground">Best move:</span> {analysis.bestMoveSan}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="h-[600px] flex flex-col">
          <Card className="bg-card border-border flex-1 flex flex-col">
            <div className="p-4 border-b border-border font-bold">Move List</div>
            <div className="flex-1 overflow-auto p-2">
              {moveHistory.length > 0 ? (
                <div className="grid grid-cols-2 gap-1 text-sm font-mono">
                  {moveHistory.reduce((result: any[], move: any, index: number) => {
                    if (index % 2 === 0) result.push([move]);
                    else result[result.length - 1].push(move);
                    return result;
                  }, []).map((pair, i) => (
                    <div key={i} className="col-span-2 flex px-2 py-1 rounded">
                      <span className="w-8 text-muted-foreground">{i + 1}.</span>
                      <span 
                        className={`flex-1 cursor-pointer hover:bg-muted/50 px-2 rounded ${currentMoveIndex === i*2 ? 'bg-primary/20 text-primary' : ''}`}
                        onClick={() => goToMove(i*2)}
                      >
                        {pair[0].san}
                      </span>
                      <span 
                        className={`flex-1 cursor-pointer hover:bg-muted/50 px-2 rounded ${currentMoveIndex === i*2+1 ? 'bg-primary/20 text-primary' : ''}`}
                        onClick={() => pair[1] && goToMove(i*2+1)}
                      >
                        {pair[1] ? pair[1].san : ""}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-muted-foreground text-sm">No moves recorded</div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
