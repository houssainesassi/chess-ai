import { useState } from 'react';
import { motion } from 'motion/react';
import { Bot, Users, Clock, TrendingUp, UserPlus, Trophy, Swords, Brain } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Separator } from './ui/separator';
import { ScrollArea } from './ui/scroll-area';
import { MatchmakingModal } from './MatchmakingModal';

interface LobbyProps {
  onStartGame: (mode: 'online' | 'robot') => void;
  onViewHistory: () => void;
  playerName: string;
}

const mockLeaderboard = [
  { rank: 1, name: 'GrandMaster_X', rating: 2847, wins: 342 },
  { rank: 2, name: 'ChessNinja', rating: 2801, wins: 298 },
  { rank: 3, name: 'QueenSlayer', rating: 2765, wins: 267 },
  { rank: 4, name: 'PawnStorm', rating: 2723, wins: 245 },
  { rank: 5, name: 'KnightRider', rating: 2689, wins: 221 },
];

const mockFriends = [
  { name: 'Alice', status: 'online', rating: 1650 },
  { name: 'Bob', status: 'playing', rating: 1520 },
  { name: 'Charlie', status: 'offline', rating: 1780 },
];

export function Lobby({ onStartGame, onViewHistory, playerName }: LobbyProps) {
  const [matchmakingOpen, setMatchmakingOpen] = useState(false);

  const handlePlayOnline = () => {
    setMatchmakingOpen(true);
  };

  const handleMatchFound = () => {
    setMatchmakingOpen(false);
    onStartGame('online');
  };

  return (
    <>
      <MatchmakingModal
        open={matchmakingOpen}
        onClose={() => setMatchmakingOpen(false)}
        onMatchFound={handleMatchFound}
      />

      <div className="min-h-screen w-full bg-[#121212] flex flex-col p-6 gap-6 overflow-hidden" style={{ height: '100dvh' }}>
      {/* Header */}
      <motion.div
        className="flex items-center justify-between"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <h1 className="text-4xl font-bold text-white">Welcome, {playerName}</h1>
          <p className="text-neutral-400 mt-1">Choose your game mode</p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="bg-neutral-900/60 backdrop-blur-xl border-neutral-800 hover:bg-neutral-800"
            onClick={onViewHistory}
          >
            <Clock className="w-4 h-4 mr-2" />
            History
          </Button>
        </div>
      </motion.div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden">
        {/* Game Modes - Takes 2 columns */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="bg-gradient-to-br from-neutral-900/80 to-neutral-800/80 backdrop-blur-xl border-neutral-700 p-8 hover:shadow-2xl hover:shadow-green-500/10 transition-all group cursor-pointer"
              onClick={handlePlayOnline}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center">
                      <Swords className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-white">Play Online</h3>
                      <p className="text-sm text-neutral-400">Challenge players worldwide</p>
                    </div>
                  </div>
                  <p className="text-neutral-300 mb-4">
                    Real-time multiplayer with ELO matchmaking. Compete against players of similar skill level.
                  </p>
                  <div className="flex gap-2">
                    <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs">Ranked</span>
                    <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs">Live Clock</span>
                    <span className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-xs">Chat</span>
                  </div>
                </div>
                <motion.div
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  animate={{ x: [0, 10, 0] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                >
                  <Users className="w-8 h-8 text-green-500" />
                </motion.div>
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-gradient-to-br from-neutral-900/80 to-neutral-800/80 backdrop-blur-xl border-neutral-700 p-8 hover:shadow-2xl hover:shadow-blue-500/10 transition-all group cursor-pointer"
              onClick={() => onStartGame('robot')}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
                      <Brain className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-white">Play vs Robot</h3>
                      <p className="text-sm text-neutral-400">Train against AI opponents</p>
                    </div>
                  </div>
                  <p className="text-neutral-300 mb-4">
                    Practice with AI opponents from beginner to grandmaster level. Perfect for learning and improvement.
                  </p>
                  <div className="flex gap-2">
                    <span className="px-3 py-1 bg-orange-500/20 text-orange-400 rounded-full text-xs">20 Levels</span>
                    <span className="px-3 py-1 bg-cyan-500/20 text-cyan-400 rounded-full text-xs">Hints</span>
                    <span className="px-3 py-1 bg-pink-500/20 text-pink-400 rounded-full text-xs">Analysis</span>
                  </div>
                </div>
                <motion.div
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  animate={{ rotate: [0, 360] }}
                  transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                >
                  <Bot className="w-8 h-8 text-blue-500" />
                </motion.div>
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Sidebar - Friends & Leaderboard */}
        <div className="flex flex-col gap-6 overflow-hidden">
          {/* Friends Widget */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-neutral-900/60 backdrop-blur-xl border-neutral-800 p-6 h-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-green-500" />
                  Friends
                </h3>
                <Button size="sm" variant="ghost" className="text-green-500 hover:text-green-400 hover:bg-green-500/10">
                  Add
                </Button>
              </div>
              <ScrollArea className="h-48">
                <div className="space-y-3">
                  {mockFriends.map((friend, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-neutral-800/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${
                          friend.status === 'online' ? 'bg-green-500' :
                          friend.status === 'playing' ? 'bg-yellow-500' : 'bg-neutral-600'
                        }`} />
                        <div>
                          <p className="text-sm text-white font-medium">{friend.name}</p>
                          <p className="text-xs text-neutral-500">{friend.rating}</p>
                        </div>
                      </div>
                      {friend.status === 'online' && (
                        <Button size="sm" variant="outline" className="h-7 text-xs border-green-500/50 text-green-500 hover:bg-green-500/10">
                          Challenge
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </Card>
          </motion.div>

          {/* Leaderboard Widget */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="flex-1"
          >
            <Card className="bg-neutral-900/60 backdrop-blur-xl border-neutral-800 p-6 h-full flex flex-col">
              <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
                <Trophy className="w-5 h-5 text-yellow-500" />
                Top Players
              </h3>
              <ScrollArea className="flex-1">
                <div className="space-y-2">
                  {mockLeaderboard.map((player, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-neutral-800/50 transition-colors">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        i === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-white' :
                        i === 1 ? 'bg-gradient-to-br from-neutral-300 to-neutral-500 text-white' :
                        i === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-white' :
                        'bg-neutral-800 text-neutral-400'
                      }`}>
                        {player.rank}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium truncate">{player.name}</p>
                        <p className="text-xs text-neutral-500">{player.wins} wins</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-green-400">{player.rating}</p>
                        <div className="flex items-center gap-1 text-xs text-green-500">
                          <TrendingUp className="w-3 h-3" />
                          +12
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </Card>
          </motion.div>
        </div>
      </div>
      </div>
    </>
  );
}
