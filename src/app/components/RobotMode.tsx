import { useState, useEffect } from 'react';
import { Chess } from 'chess.js';
import { ChessBoard } from './ChessBoard';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { Card } from './ui/card';
import { ArrowLeft, Lightbulb, RotateCcw, Flag } from 'lucide-react';
import { motion } from 'motion/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';

interface RobotModeProps {
  onBack: () => void;
  playerName: string;
}

export function RobotMode({ onBack, playerName }: RobotModeProps) {
  const [game, setGame] = useState(new Chess());
  const [difficulty, setDifficulty] = useState(10);
  const [showHint, setShowHint] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [result, setResult] = useState('');

  const makeAiMove = () => {
    const gameCopy = new Chess(game.fen());
    const moves = gameCopy.moves({ verbose: true });

    if (moves.length === 0) return;

    // Simple AI: random move, but weighted by difficulty
    // Higher difficulty = more likely to pick "better" moves
    let selectedMove;
    if (difficulty > 15) {
      // Advanced: prefer captures and checks
      const captures = moves.filter(m => m.captured);
      const checks = moves.filter(m => {
        const testGame = new Chess(game.fen());
        testGame.move(m);
        return testGame.isCheck();
      });

      if (captures.length > 0 && Math.random() > 0.3) {
        selectedMove = captures[Math.floor(Math.random() * captures.length)];
      } else if (checks.length > 0 && Math.random() > 0.5) {
        selectedMove = checks[Math.floor(Math.random() * checks.length)];
      } else {
        selectedMove = moves[Math.floor(Math.random() * moves.length)];
      }
    } else {
      selectedMove = moves[Math.floor(Math.random() * moves.length)];
    }

    setTimeout(() => {
      const newGame = new Chess(game.fen());
      newGame.move(selectedMove);
      setGame(newGame);
      checkGameStatus(newGame);
    }, 500);
  };

  const checkGameStatus = (currentGame: Chess) => {
    if (currentGame.isCheckmate()) {
      setGameOver(true);
      setResult(currentGame.turn() === 'w' ? 'Black wins by checkmate!' : 'White wins by checkmate!');
    } else if (currentGame.isDraw()) {
      setGameOver(true);
      setResult('Game drawn');
    } else if (currentGame.isStalemate()) {
      setGameOver(true);
      setResult('Stalemate');
    }
  };

  const handleMove = (move: any) => {
    const newGame = new Chess(game.fen());
    checkGameStatus(newGame);

    if (!newGame.isGameOver()) {
      makeAiMove();
    }
  };

  const startGame = () => {
    setGameStarted(true);
    setGame(new Chess());
    setGameOver(false);
  };

  const resetGame = () => {
    setGame(new Chess());
    setGameOver(false);
    setGameStarted(false);
  };

  const resign = () => {
    setGameOver(true);
    setResult('You resigned. Black wins!');
  };

  const getBestMove = () => {
    const moves = game.moves({ verbose: true });
    if (moves.length === 0) return null;

    // Simple heuristic: prefer captures, then checks
    const captures = moves.filter(m => m.captured);
    if (captures.length > 0) return captures[0];

    return moves[0];
  };

  return (
    <div className="min-h-screen w-full bg-[#121212] flex flex-col p-6" style={{ height: '100dvh' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Button
          variant="ghost"
          className="text-white hover:text-green-500 hover:bg-neutral-800"
          onClick={onBack}
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Lobby
        </Button>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="bg-yellow-500/20 border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/30"
            onClick={() => setShowHint(!showHint)}
            disabled={!gameStarted || gameOver}
          >
            <Lightbulb className="w-4 h-4 mr-2" />
            {showHint ? 'Hide Hint' : 'Show Hint'}
          </Button>

          <Button
            variant="outline"
            className="bg-neutral-800 border-neutral-700 hover:bg-neutral-700"
            onClick={resetGame}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            New Game
          </Button>

          <Button
            variant="outline"
            className="bg-red-500/20 border-red-500/50 text-red-500 hover:bg-red-500/30"
            onClick={resign}
            disabled={!gameStarted || gameOver}
          >
            <Flag className="w-4 h-4 mr-2" />
            Resign
          </Button>
        </div>
      </div>

      {/* Setup Screen */}
      {!gameStarted ? (
        <div className="flex-1 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Card className="bg-neutral-900/80 backdrop-blur-xl border-neutral-800 p-12 max-w-2xl">
              <h2 className="text-3xl font-bold text-white mb-6 text-center">Configure AI Opponent</h2>

              <div className="space-y-8">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <label className="text-white font-medium">Difficulty Level</label>
                    <span className="text-2xl font-bold text-green-500">{difficulty}</span>
                  </div>

                  <Slider
                    value={[difficulty]}
                    onValueChange={(value) => setDifficulty(value[0])}
                    min={1}
                    max={20}
                    step={1}
                    className="mb-4"
                  />

                  <div className="flex justify-between text-sm text-neutral-400">
                    <span>Beginner (1)</span>
                    <span>Intermediate (10)</span>
                    <span>Grandmaster (20)</span>
                  </div>
                </div>

                <div className="bg-neutral-800/50 rounded-lg p-6">
                  <h3 className="font-bold text-white mb-3">Features</h3>
                  <ul className="space-y-2 text-neutral-300 text-sm">
                    <li className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      AI "Ghost" move preview
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      Hint system with best move suggestions
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      Material advantage tracking
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      Voice announcements for checks
                    </li>
                  </ul>
                </div>

                <Button
                  className="w-full h-14 text-lg bg-gradient-to-r from-green-500 to-green-700 hover:from-green-600 hover:to-green-800"
                  onClick={startGame}
                >
                  Start Game
                </Button>
              </div>
            </Card>
          </motion.div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <ChessBoard
            game={game}
            onMove={handleMove}
            playerColor="w"
            opponentName={`Robot (Level ${difficulty})`}
            playerName={playerName}
            mode="robot"
            showHint={showHint}
            aiDifficulty={difficulty}
          />
        </div>
      )}

      {/* Hint Display */}
      {showHint && gameStarted && !gameOver && (
        <motion.div
          className="fixed bottom-8 left-1/2 -translate-x-1/2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="bg-yellow-500/20 backdrop-blur-xl border-yellow-500/50 px-6 py-3">
            <p className="text-yellow-300 font-medium">
              {getBestMove() ? `Hint: Try ${getBestMove()?.san}` : 'No hints available'}
            </p>
          </Card>
        </motion.div>
      )}

      {/* Game Over Dialog */}
      <Dialog open={gameOver} onOpenChange={setGameOver}>
        <DialogContent className="bg-neutral-900 border-neutral-800">
          <DialogHeader>
            <DialogTitle className="text-2xl text-white">Game Over</DialogTitle>
            <DialogDescription className="text-lg text-neutral-300 mt-4">
              {result}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className="bg-neutral-800 border-neutral-700"
              onClick={onBack}
            >
              Back to Lobby
            </Button>
            <Button
              className="bg-gradient-to-r from-green-500 to-green-700"
              onClick={resetGame}
            >
              Play Again
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
