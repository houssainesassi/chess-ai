import { Chess, Square, Move } from 'chess.js';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, Trophy } from 'lucide-react';
import { CustomChessboard } from './CustomChessboard';

interface ChessBoardProps {
  game: Chess;
  onMove: (move: Move) => void;
  playerColor: 'w' | 'b';
  opponentName?: string;
  playerName?: string;
  mode: 'online' | 'robot' | 'analysis';
  showHint?: boolean;
  aiDifficulty?: number;
  timeControl?: { white: number; black: number };
  onTimeUpdate?: (color: 'white' | 'black', time: number) => void;
}

const pieceValues: { [key: string]: number } = {
  p: 1, n: 3, b: 3, r: 5, q: 9, k: 0
};

export function ChessBoard({
  game,
  onMove,
  playerColor,
  opponentName = 'Opponent',
  playerName = 'You',
  mode,
  showHint = false,
  aiDifficulty = 10,
  timeControl,
  onTimeUpdate
}: ChessBoardProps) {
  const [moveFrom, setMoveFrom] = useState<Square | null>(null);
  const [optionSquares, setOptionSquares] = useState<{ [key: string]: any }>({});
  const [ghostMove, setGhostMove] = useState<{ from: Square; to: Square } | null>(null);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [whiteClock, setWhiteClock] = useState(timeControl?.white || 600);
  const [blackClock, setBlackClock] = useState(timeControl?.black || 600);
  const clockIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Material advantage calculation
  const getMaterialAdvantage = () => {
    const board = game.board();
    let whiteValue = 0;
    let blackValue = 0;
    const whiteCaptured: string[] = [];
    const blackCaptured: string[] = [];

    board.forEach(row => {
      row.forEach(piece => {
        if (piece) {
          const value = pieceValues[piece.type];
          if (piece.color === 'w') whiteValue += value;
          else blackValue += value;
        }
      });
    });

    // Initial material is 39 for each side (8p + 2n + 2b + 2r + 1q)
    const initialMaterial = 39;
    const whiteLost = initialMaterial - whiteValue;
    const blackLost = initialMaterial - blackValue;

    // Captured pieces
    ['p', 'n', 'b', 'r', 'q'].forEach(type => {
      const count = Math.floor(whiteLost / pieceValues[type]);
      for (let i = 0; i < count; i++) blackCaptured.push(type);
    });

    ['p', 'n', 'b', 'r', 'q'].forEach(type => {
      const count = Math.floor(blackLost / pieceValues[type]);
      for (let i = 0; i < count; i++) whiteCaptured.push(type);
    });

    return {
      advantage: whiteValue - blackValue,
      whiteCaptured,
      blackCaptured
    };
  };

  // Evaluation bar calculation (simplified)
  const getEvaluation = () => {
    const material = getMaterialAdvantage();
    return Math.max(-10, Math.min(10, material.advantage));
  };

  // Clock management
  useEffect(() => {
    if (mode === 'online' && timeControl) {
      clockIntervalRef.current = setInterval(() => {
        if (game.turn() === 'w') {
          setWhiteClock(prev => {
            const newTime = Math.max(0, prev - 1);
            onTimeUpdate?.('white', newTime);
            return newTime;
          });
        } else {
          setBlackClock(prev => {
            const newTime = Math.max(0, prev - 1);
            onTimeUpdate?.('black', newTime);
            return newTime;
          });
        }
      }, 1000);

      return () => {
        if (clockIntervalRef.current) clearInterval(clockIntervalRef.current);
      };
    }
  }, [game.turn(), mode, timeControl, onTimeUpdate]);

  const playSound = (type: 'move' | 'capture' | 'check') => {
    // In a real implementation, load actual sound files
    if (audioRef.current) {
      audioRef.current.play().catch(() => {});
    }
  };

  const speakAnnouncement = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
    }
  };

  const onDrop = (sourceSquare: Square, targetSquare: Square) => {
    try {
      const move = game.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q'
      });

      if (move) {
        setLastMove({ from: sourceSquare, to: targetSquare });
        onMove(move);

        if (move.captured) {
          playSound('capture');
        } else {
          playSound('move');
        }

        if (game.isCheck()) {
          playSound('check');
          speakAnnouncement('Check');
        }

        if (game.isCheckmate()) {
          speakAnnouncement('Checkmate');
        }

        setMoveFrom(null);
        setOptionSquares({});
        return true;
      }
    } catch (e) {
      return false;
    }
    return false;
  };

  const onSquareClick = (square: Square) => {
    if (!moveFrom) {
      const piece = game.get(square);
      if (piece && piece.color === game.turn()) {
        setMoveFrom(square);
        const moves = game.moves({ square, verbose: true });
        const newSquares: { [key: string]: any } = {};
        moves.forEach((move) => {
          newSquares[move.to] = {
            background: 'radial-gradient(circle, rgba(129, 182, 76, 0.3) 25%, transparent 25%)',
            borderRadius: '50%'
          };
        });
        setOptionSquares(newSquares);
      }
    } else {
      const success = onDrop(moveFrom, square);
      if (!success) {
        setMoveFrom(null);
        setOptionSquares({});
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const material = getMaterialAdvantage();
  const evaluation = getEvaluation();

  const customSquareStyles: { [key: string]: React.CSSProperties } = {
    ...optionSquares,
    ...(lastMove ? {
      [lastMove.from]: { backgroundColor: 'rgba(129, 182, 76, 0.4)' },
      [lastMove.to]: { backgroundColor: 'rgba(129, 182, 76, 0.4)' }
    } : {})
  };

  return (
    <div className="flex items-center justify-center gap-6 h-full w-full">
      {/* Evaluation Bar */}
      <div className="flex flex-col h-[600px] w-8 bg-neutral-800 rounded-lg overflow-hidden relative border border-neutral-700">
        <motion.div
          className="bg-white"
          initial={false}
          animate={{
            height: `${50 - (evaluation * 5)}%`,
          }}
          transition={{ type: 'spring', stiffness: 100, damping: 20 }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs rotate-90 font-mono">
            {evaluation > 0 ? `+${evaluation}` : evaluation}
          </span>
        </div>
      </div>

      {/* Main Board Container */}
      <div className="flex flex-col gap-4">
        {/* Opponent Info */}
        <div className="flex items-center justify-between px-4 py-3 bg-neutral-900/60 backdrop-blur-xl rounded-xl border border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white">
              {opponentName[0].toUpperCase()}
            </div>
            <div>
              <p className="text-white font-medium">{opponentName}</p>
              {material.advantage < 0 && (
                <div className="flex gap-1 mt-1">
                  {material.blackCaptured.map((piece, i) => (
                    <span key={i} className="text-xs opacity-70">
                      {piece === 'p' && '♟'}
                      {piece === 'n' && '♞'}
                      {piece === 'b' && '♝'}
                      {piece === 'r' && '♜'}
                      {piece === 'q' && '♛'}
                    </span>
                  ))}
                  <span className="text-xs text-green-400 ml-1">+{Math.abs(material.advantage)}</span>
                </div>
              )}
            </div>
          </div>
          {mode === 'online' && (
            <motion.div
              className={`px-4 py-2 rounded-lg font-mono text-xl ${
                game.turn() === (playerColor === 'w' ? 'b' : 'w')
                  ? 'bg-green-500/20 text-green-400 ring-2 ring-green-500/50'
                  : 'bg-neutral-800 text-neutral-400'
              }`}
              animate={game.turn() === (playerColor === 'w' ? 'b' : 'w') ? {
                scale: [1, 1.05, 1],
              } : {}}
              transition={{ repeat: Infinity, duration: 1 }}
            >
              {formatTime(playerColor === 'w' ? blackClock : whiteClock)}
            </motion.div>
          )}
        </div>

        {/* Chess Board */}
        <div className="relative">
          <AnimatePresence>
            {ghostMove && (
              <motion.div
                className="absolute inset-0 pointer-events-none z-50"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                exit={{ opacity: 0 }}
              >
                <div className="w-full h-full bg-blue-500/30 rounded-lg" />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex justify-center">
            <CustomChessboard
              position={game.fen()}
              onPieceDrop={onDrop}
              onSquareClick={onSquareClick}
              customSquareStyles={customSquareStyles}
              boardOrientation={playerColor === 'w' ? 'white' : 'black'}
            />
          </div>
        </div>

        {/* Player Info */}
        <div className="flex items-center justify-between px-4 py-3 bg-neutral-900/60 backdrop-blur-xl rounded-xl border border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center text-white">
              {playerName[0].toUpperCase()}
            </div>
            <div>
              <p className="text-white font-medium">{playerName}</p>
              {material.advantage > 0 && (
                <div className="flex gap-1 mt-1">
                  {material.whiteCaptured.map((piece, i) => (
                    <span key={i} className="text-xs opacity-70">
                      {piece === 'p' && '♙'}
                      {piece === 'n' && '♘'}
                      {piece === 'b' && '♗'}
                      {piece === 'r' && '♖'}
                      {piece === 'q' && '♕'}
                    </span>
                  ))}
                  <span className="text-xs text-green-400 ml-1">+{material.advantage}</span>
                </div>
              )}
            </div>
          </div>
          {mode === 'online' && (
            <motion.div
              className={`px-4 py-2 rounded-lg font-mono text-xl ${
                game.turn() === playerColor
                  ? 'bg-green-500/20 text-green-400 ring-2 ring-green-500/50'
                  : 'bg-neutral-800 text-neutral-400'
              }`}
              animate={game.turn() === playerColor ? {
                scale: [1, 1.05, 1],
              } : {}}
              transition={{ repeat: Infinity, duration: 1 }}
            >
              {formatTime(playerColor === 'w' ? whiteClock : blackClock)}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
