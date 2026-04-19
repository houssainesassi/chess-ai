import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lobby } from './components/Lobby';
import { OnlineGame } from './components/OnlineGame';
import { RobotMode } from './components/RobotMode';
import { GameHistory } from './components/GameHistory';
import { AnalysisBoard } from './components/AnalysisBoard';
import { AccountSettings } from './components/AccountSettings';
import { Button } from './components/ui/button';
import { Settings, Trophy } from 'lucide-react';

type Screen = 'lobby' | 'online' | 'robot' | 'history' | 'analysis' | 'settings';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('lobby');
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [playerName] = useState('ChessPlayer');

  const handleStartGame = (mode: 'online' | 'robot') => {
    setCurrentScreen(mode);
  };

  const handleViewHistory = () => {
    setCurrentScreen('history');
  };

  const handleAnalyzeGame = (gameId: string) => {
    setSelectedGameId(gameId);
    setCurrentScreen('analysis');
  };

  const handleBackToLobby = () => {
    setCurrentScreen('lobby');
    setSelectedGameId(null);
  };

  const handleBackToHistory = () => {
    setCurrentScreen('history');
  };

  const handleOpenSettings = () => {
    setCurrentScreen('settings');
  };

  return (
    <div className="relative w-full min-h-screen bg-[#121212]">
      {/* Floating Action Buttons - Only show on lobby */}
      {currentScreen === 'lobby' && (
        <div className="fixed top-6 right-6 z-50 flex gap-3">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
          >
            <Button
              variant="outline"
              size="icon"
              className="w-12 h-12 bg-neutral-900/80 backdrop-blur-xl border-neutral-700 hover:bg-neutral-800"
              onClick={handleOpenSettings}
            >
              <Settings className="w-5 h-5 text-neutral-300" />
            </Button>
          </motion.div>
        </div>
      )}

      {/* Screen Transitions */}
      <AnimatePresence mode="wait">
        {currentScreen === 'lobby' && (
          <motion.div
            key="lobby"
            initial={{ opacity: 0, x: -100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          >
            <Lobby
              onStartGame={handleStartGame}
              onViewHistory={handleViewHistory}
              playerName={playerName}
            />
          </motion.div>
        )}

        {currentScreen === 'online' && (
          <motion.div
            key="online"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          >
            <OnlineGame
              onBack={handleBackToLobby}
              playerName={playerName}
            />
          </motion.div>
        )}

        {currentScreen === 'robot' && (
          <motion.div
            key="robot"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          >
            <RobotMode
              onBack={handleBackToLobby}
              playerName={playerName}
            />
          </motion.div>
        )}

        {currentScreen === 'history' && (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          >
            <GameHistory
              onBack={handleBackToLobby}
              onAnalyzeGame={handleAnalyzeGame}
              playerName={playerName}
            />
          </motion.div>
        )}

        {currentScreen === 'analysis' && selectedGameId && (
          <motion.div
            key="analysis"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          >
            <AnalysisBoard
              onBack={handleBackToHistory}
              gameId={selectedGameId}
            />
          </motion.div>
        )}

        {currentScreen === 'settings' && (
          <motion.div
            key="settings"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          >
            <AccountSettings
              onBack={handleBackToLobby}
              playerName={playerName}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Welcome Voice Announcement (Simulated) */}
      <audio id="welcome-audio" style={{ display: 'none' }}>
        <source src="data:audio/wav;base64,..." type="audio/wav" />
      </audio>
    </div>
  );
}