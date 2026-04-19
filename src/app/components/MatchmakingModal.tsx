import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Loader2, Users, Clock, Zap } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Progress } from './ui/progress';

interface MatchmakingModalProps {
  open: boolean;
  onClose: () => void;
  onMatchFound: () => void;
}

export function MatchmakingModal({ open, onClose, onMatchFound }: MatchmakingModalProps) {
  const [progress, setProgress] = useState(0);
  const [searchTime, setSearchTime] = useState(0);
  const [playersOnline] = useState(Math.floor(Math.random() * 500) + 200);

  useEffect(() => {
    if (!open) {
      setProgress(0);
      setSearchTime(0);
      return;
    }

    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          setTimeout(() => onMatchFound(), 500);
          return 100;
        }
        return prev + Math.random() * 15;
      });
    }, 500);

    const timeInterval = setInterval(() => {
      setSearchTime(prev => prev + 1);
    }, 1000);

    return () => {
      clearInterval(progressInterval);
      clearInterval(timeInterval);
    };
  }, [open, onMatchFound]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-neutral-900 border-neutral-800 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl text-white text-center">Finding Opponent</DialogTitle>
          <DialogDescription className="text-center text-neutral-400">
            Searching for a player with similar rating...
          </DialogDescription>
        </DialogHeader>

        <div className="py-8 space-y-6">
          {/* Animated Search Icon */}
          <div className="flex justify-center">
            <motion.div
              animate={{
                rotate: 360,
                scale: [1, 1.2, 1],
              }}
              transition={{
                rotate: { duration: 2, repeat: Infinity, ease: "linear" },
                scale: { duration: 1, repeat: Infinity },
              }}
              className="w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center"
            >
              <Users className="w-10 h-10 text-white" />
            </motion.div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-center text-sm text-neutral-500">
              {Math.round(progress)}% - Searching...
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-neutral-800/50 rounded-lg p-4 text-center">
              <div className="flex items-center justify-center gap-2 text-green-500 mb-2">
                <Clock className="w-4 h-4" />
              </div>
              <p className="text-2xl font-bold text-white">{searchTime}s</p>
              <p className="text-xs text-neutral-400">Search Time</p>
            </div>

            <div className="bg-neutral-800/50 rounded-lg p-4 text-center">
              <div className="flex items-center justify-center gap-2 text-blue-500 mb-2">
                <Zap className="w-4 h-4" />
              </div>
              <p className="text-2xl font-bold text-white">{playersOnline}</p>
              <p className="text-xs text-neutral-400">Players Online</p>
            </div>
          </div>

          {/* Loading Dots */}
          <div className="flex justify-center gap-2">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-3 h-3 bg-green-500 rounded-full"
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.3, 1, 0.3],
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: i * 0.2,
                }}
              />
            ))}
          </div>
        </div>

        <Button
          variant="outline"
          className="w-full bg-neutral-800 border-neutral-700 hover:bg-neutral-700"
          onClick={onClose}
        >
          Cancel Search
        </Button>
      </DialogContent>
    </Dialog>
  );
}
