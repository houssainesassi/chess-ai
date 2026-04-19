import { useState, useEffect } from 'react';
import { Chess, Move } from 'chess.js';
import { motion } from 'motion/react';
import { CustomChessboard } from './CustomChessboard';
import { ArrowLeft, ChevronLeft, ChevronRight, SkipBack, SkipForward, Target, TrendingUp, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Slider } from './ui/slider';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';

interface AnalysisBoardProps {
  onBack: () => void;
  gameId: string;
}

interface MoveAnalysis {
  move: string;
  san: string;
  fen: string;
  evaluation: number;
  quality: 'best' | 'good' | 'mistake' | 'blunder';
  comment?: string;
}

// Mock game data
const mockMoves: MoveAnalysis[] = [
  { move: 'e2e4', san: 'e4', fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1', evaluation: 0.3, quality: 'best', comment: 'Classic opening' },
  { move: 'e7e5', san: 'e5', fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2', evaluation: 0.2, quality: 'best' },
  { move: 'g1f3', san: 'Nf3', fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2', evaluation: 0.3, quality: 'best' },
  { move: 'b8c6', san: 'Nc6', fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', evaluation: 0.2, quality: 'best' },
  { move: 'f1c4', san: 'Bc4', fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3', evaluation: 0.4, quality: 'best', comment: 'Italian Game' },
  { move: 'f8c5', san: 'Bc5', fen: 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', evaluation: 0.3, quality: 'best' },
  { move: 'd2d3', san: 'd3', fen: 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R b KQkq - 0 4', evaluation: -0.5, quality: 'mistake', comment: 'Passive move' },
  { move: 'd7d6', san: 'd6', fen: 'r1bqk1nr/ppp2ppp/2np4/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 0 5', evaluation: 0.1, quality: 'good' },
];

export function AnalysisBoard({ onBack, gameId }: AnalysisBoardProps) {
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [game, setGame] = useState(new Chess());
  const [showBestMoves, setShowBestMoves] = useState(false);

  useEffect(() => {
    // Reset to starting position
    const newGame = new Chess();

    // Apply moves up to current index
    for (let i = 0; i <= currentMoveIndex && i < mockMoves.length; i++) {
      newGame.move(mockMoves[i].move);
    }

    setGame(newGame);
  }, [currentMoveIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPrevMove();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToNextMove();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentMoveIndex]);

  const goToStart = () => setCurrentMoveIndex(0);
  const goToPrevMove = () => setCurrentMoveIndex(Math.max(0, currentMoveIndex - 1));
  const goToNextMove = () => setCurrentMoveIndex(Math.min(mockMoves.length - 1, currentMoveIndex + 1));
  const goToEnd = () => setCurrentMoveIndex(mockMoves.length - 1);

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'best': return 'text-green-500 bg-green-500/20 border-green-500/30';
      case 'good': return 'text-blue-500 bg-blue-500/20 border-blue-500/30';
      case 'mistake': return 'text-yellow-500 bg-yellow-500/20 border-yellow-500/30';
      case 'blunder': return 'text-red-500 bg-red-500/20 border-red-500/30';
      default: return 'text-neutral-500 bg-neutral-500/20 border-neutral-500/30';
    }
  };

  const getQualityIcon = (quality: string) => {
    switch (quality) {
      case 'best': return <Target className="w-4 h-4" />;
      case 'good': return <TrendingUp className="w-4 h-4" />;
      case 'mistake': return <AlertCircle className="w-4 h-4" />;
      case 'blunder': return <AlertCircle className="w-4 h-4" />;
      default: return null;
    }
  };

  const accuracy = Math.round(
    (mockMoves.filter(m => m.quality === 'best' || m.quality === 'good').length / mockMoves.length) * 100
  );

  return (
    <div className="min-h-screen w-full bg-[#121212] flex flex-col p-6 gap-6" style={{ height: '100dvh' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button
            variant="ghost"
            className="text-white hover:text-green-500 hover:bg-neutral-800 mb-2"
            onClick={onBack}
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to History
          </Button>
          <h1 className="text-4xl font-bold text-white">Game Analysis</h1>
          <p className="text-neutral-400 mt-1">Review your moves and improve your game</p>
        </div>

        <div className="flex items-center gap-4">
          <Card className="bg-neutral-900/60 backdrop-blur-xl border-neutral-800 px-6 py-3">
            <div className="flex items-center gap-3">
              <span className="text-neutral-400 text-sm">Accuracy</span>
              <span className="text-3xl font-bold text-green-500">{accuracy}%</span>
            </div>
          </Card>

          <div className="flex items-center gap-3 bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 rounded-lg px-4 py-3">
            <span className="text-sm text-neutral-400">Show Best Moves</span>
            <Switch checked={showBestMoves} onCheckedChange={setShowBestMoves} />
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden">
        {/* Board & Controls */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Board */}
          <div className="flex items-center justify-center">
            <CustomChessboard
              position={game.fen()}
              boardOrientation="white"
              arePiecesDraggable={false}
            />
          </div>

          {/* Move Controls */}
          <Card className="bg-neutral-900/60 backdrop-blur-xl border-neutral-800 p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-white font-medium">
                  Move {currentMoveIndex + 1} of {mockMoves.length}
                </span>
                {mockMoves[currentMoveIndex] && (
                  <Badge className={getQualityColor(mockMoves[currentMoveIndex].quality)}>
                    <span className="flex items-center gap-1">
                      {getQualityIcon(mockMoves[currentMoveIndex].quality)}
                      {mockMoves[currentMoveIndex].quality.toUpperCase()}
                    </span>
                  </Badge>
                )}
              </div>

              <Slider
                value={[currentMoveIndex]}
                onValueChange={(value) => setCurrentMoveIndex(value[0])}
                min={0}
                max={mockMoves.length - 1}
                step={1}
              />

              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="bg-neutral-800 border-neutral-700 hover:bg-neutral-700"
                  onClick={goToStart}
                  disabled={currentMoveIndex === 0}
                >
                  <SkipBack className="w-4 h-4" />
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  className="bg-neutral-800 border-neutral-700 hover:bg-neutral-700"
                  onClick={goToPrevMove}
                  disabled={currentMoveIndex === 0}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>

                <div className="px-6 py-2 bg-neutral-800 rounded-lg">
                  <kbd className="text-neutral-400 text-sm">← →</kbd>
                </div>

                <Button
                  variant="outline"
                  size="icon"
                  className="bg-neutral-800 border-neutral-700 hover:bg-neutral-700"
                  onClick={goToNextMove}
                  disabled={currentMoveIndex === mockMoves.length - 1}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  className="bg-neutral-800 border-neutral-700 hover:bg-neutral-700"
                  onClick={goToEnd}
                  disabled={currentMoveIndex === mockMoves.length - 1}
                >
                  <SkipForward className="w-4 h-4" />
                </Button>
              </div>

              {mockMoves[currentMoveIndex]?.comment && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4"
                >
                  <p className="text-blue-300 text-sm">{mockMoves[currentMoveIndex].comment}</p>
                </motion.div>
              )}
            </div>
          </Card>
        </div>

        {/* Move List */}
        <div className="flex flex-col">
          <Card className="flex-1 bg-neutral-900/60 backdrop-blur-xl border-neutral-800 p-6 flex flex-col overflow-hidden">
            <h3 className="text-xl font-bold text-white mb-4">Move History</h3>
            <ScrollArea className="flex-1">
              <div className="space-y-2">
                {mockMoves.map((move, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02 }}
                  >
                    <div
                      className={`p-3 rounded-lg cursor-pointer transition-all ${
                        i === currentMoveIndex
                          ? 'bg-green-500/20 border border-green-500/50'
                          : 'bg-neutral-800/50 hover:bg-neutral-800'
                      }`}
                      onClick={() => setCurrentMoveIndex(i)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-neutral-500 font-mono text-sm w-8">
                            {Math.floor(i / 2) + 1}.
                          </span>
                          <span className="text-white font-bold">{move.san}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-xs ${getQualityColor(move.quality)}`}>
                            {getQualityIcon(move.quality)}
                          </Badge>
                          <span className={`text-xs font-mono ${
                            move.evaluation > 0 ? 'text-green-500' :
                            move.evaluation < 0 ? 'text-red-500' :
                            'text-neutral-500'
                          }`}>
                            {move.evaluation > 0 ? '+' : ''}{move.evaluation.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          </Card>
        </div>
      </div>
    </div>
  );
}
