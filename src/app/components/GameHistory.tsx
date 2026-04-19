import { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Clock, Trophy, Target, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';

interface GameHistoryProps {
  onBack: () => void;
  onAnalyzeGame: (gameId: string) => void;
  playerName: string;
}

interface HistoricalGame {
  id: string;
  opponent: string;
  result: 'win' | 'loss' | 'draw';
  mode: 'online' | 'robot';
  duration: string;
  moves: number;
  accuracy: number;
  date: string;
  rating: number;
  ratingChange: number;
}

const mockGames: HistoricalGame[] = [
  {
    id: '1',
    opponent: 'ChessMaster99',
    result: 'win',
    mode: 'online',
    duration: '15:42',
    moves: 42,
    accuracy: 94,
    date: '2026-04-18',
    rating: 1650,
    ratingChange: 12
  },
  {
    id: '2',
    opponent: 'Robot Level 15',
    result: 'loss',
    mode: 'robot',
    duration: '22:18',
    moves: 56,
    accuracy: 78,
    date: '2026-04-18',
    rating: 1638,
    ratingChange: -8
  },
  {
    id: '3',
    opponent: 'QueenSlayer',
    result: 'draw',
    mode: 'online',
    duration: '31:05',
    moves: 68,
    accuracy: 86,
    date: '2026-04-17',
    rating: 1646,
    ratingChange: 0
  },
  {
    id: '4',
    opponent: 'PawnStorm',
    result: 'win',
    mode: 'online',
    duration: '18:33',
    moves: 48,
    accuracy: 91,
    date: '2026-04-17',
    rating: 1646,
    ratingChange: 15
  },
  {
    id: '5',
    opponent: 'Robot Level 10',
    result: 'win',
    mode: 'robot',
    duration: '12:45',
    moves: 35,
    accuracy: 96,
    date: '2026-04-16',
    rating: 1631,
    ratingChange: 0
  }
];

export function GameHistory({ onBack, onAnalyzeGame, playerName }: GameHistoryProps) {
  const [filter, setFilter] = useState<'all' | 'online' | 'robot'>('all');

  const filteredGames = filter === 'all'
    ? mockGames
    : mockGames.filter(g => g.mode === filter);

  const stats = {
    totalGames: mockGames.length,
    wins: mockGames.filter(g => g.result === 'win').length,
    losses: mockGames.filter(g => g.result === 'loss').length,
    draws: mockGames.filter(g => g.result === 'draw').length,
    avgAccuracy: Math.round(mockGames.reduce((acc, g) => acc + g.accuracy, 0) / mockGames.length)
  };

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
            Back to Lobby
          </Button>
          <h1 className="text-4xl font-bold text-white">Game History</h1>
          <p className="text-neutral-400 mt-1">Review and analyze your past games</p>
        </div>

        <div className="flex gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            className={filter === 'all'
              ? 'bg-green-500 hover:bg-green-600'
              : 'bg-neutral-800 border-neutral-700 hover:bg-neutral-700'
            }
            onClick={() => setFilter('all')}
          >
            All
          </Button>
          <Button
            variant={filter === 'online' ? 'default' : 'outline'}
            className={filter === 'online'
              ? 'bg-green-500 hover:bg-green-600'
              : 'bg-neutral-800 border-neutral-700 hover:bg-neutral-700'
            }
            onClick={() => setFilter('online')}
          >
            Online
          </Button>
          <Button
            variant={filter === 'robot' ? 'default' : 'outline'}
            className={filter === 'robot'
              ? 'bg-green-500 hover:bg-green-600'
              : 'bg-neutral-800 border-neutral-700 hover:bg-neutral-700'
            }
            onClick={() => setFilter('robot')}
          >
            Robot
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="bg-neutral-900/60 backdrop-blur-xl border-neutral-800 p-6">
            <p className="text-neutral-400 text-sm mb-2">Total Games</p>
            <p className="text-3xl font-bold text-white">{stats.totalGames}</p>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="bg-green-500/10 backdrop-blur-xl border-green-500/30 p-6">
            <p className="text-green-400 text-sm mb-2">Wins</p>
            <p className="text-3xl font-bold text-green-500">{stats.wins}</p>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="bg-red-500/10 backdrop-blur-xl border-red-500/30 p-6">
            <p className="text-red-400 text-sm mb-2">Losses</p>
            <p className="text-3xl font-bold text-red-500">{stats.losses}</p>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="bg-yellow-500/10 backdrop-blur-xl border-yellow-500/30 p-6">
            <p className="text-yellow-400 text-sm mb-2">Draws</p>
            <p className="text-3xl font-bold text-yellow-500">{stats.draws}</p>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card className="bg-blue-500/10 backdrop-blur-xl border-blue-500/30 p-6">
            <p className="text-blue-400 text-sm mb-2">Avg Accuracy</p>
            <p className="text-3xl font-bold text-blue-500">{stats.avgAccuracy}%</p>
          </Card>
        </motion.div>
      </div>

      {/* Games List */}
      <Card className="flex-1 bg-neutral-900/60 backdrop-blur-xl border-neutral-800 p-6 overflow-hidden flex flex-col">
        <h2 className="text-xl font-bold text-white mb-4">Recent Games</h2>
        <ScrollArea className="flex-1">
          <div className="space-y-3">
            {filteredGames.map((game, i) => (
              <motion.div
                key={game.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className={`p-4 cursor-pointer transition-all hover:scale-[1.02] ${
                  game.result === 'win'
                    ? 'bg-green-500/5 border-green-500/30 hover:bg-green-500/10'
                    : game.result === 'loss'
                    ? 'bg-red-500/5 border-red-500/30 hover:bg-red-500/10'
                    : 'bg-yellow-500/5 border-yellow-500/30 hover:bg-yellow-500/10'
                }`}
                onClick={() => onAnalyzeGame(game.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${
                        game.result === 'win'
                          ? 'bg-gradient-to-br from-green-500 to-green-700'
                          : game.result === 'loss'
                          ? 'bg-gradient-to-br from-red-500 to-red-700'
                          : 'bg-gradient-to-br from-yellow-500 to-yellow-700'
                      }`}>
                        <Trophy className="w-8 h-8 text-white" />
                      </div>

                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-lg font-bold text-white">{game.opponent}</h3>
                          <Badge variant="outline" className="bg-neutral-800/50 border-neutral-700">
                            {game.mode === 'online' ? '🌐 Online' : '🤖 Robot'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-neutral-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {game.duration}
                          </span>
                          <span>{game.moves} moves</span>
                          <span className="flex items-center gap-1">
                            <Target className="w-3 h-3" />
                            {game.accuracy}% accuracy
                          </span>
                          <span>{new Date(game.date).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className={`text-2xl font-bold ${
                          game.result === 'win' ? 'text-green-500' :
                          game.result === 'loss' ? 'text-red-500' :
                          'text-yellow-500'
                        }`}>
                          {game.result === 'win' ? 'WIN' : game.result === 'loss' ? 'LOSS' : 'DRAW'}
                        </p>
                        {game.mode === 'online' && (
                          <div className="flex items-center justify-end gap-1 mt-1">
                            {game.ratingChange > 0 && <TrendingUp className="w-4 h-4 text-green-500" />}
                            {game.ratingChange < 0 && <TrendingDown className="w-4 h-4 text-red-500" />}
                            {game.ratingChange === 0 && <Minus className="w-4 h-4 text-neutral-500" />}
                            <span className={`text-sm ${
                              game.ratingChange > 0 ? 'text-green-500' :
                              game.ratingChange < 0 ? 'text-red-500' :
                              'text-neutral-500'
                            }`}>
                              {game.ratingChange > 0 ? '+' : ''}{game.ratingChange}
                            </span>
                          </div>
                        )}
                      </div>

                      <Button
                        className="bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800"
                      >
                        Analyze
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </ScrollArea>
      </Card>
    </div>
  );
}
