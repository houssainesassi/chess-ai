import { useState, useEffect } from 'react';
import { Chess } from 'chess.js';
import { ChessBoard } from './ChessBoard';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { ArrowLeft, MessageSquare, Send, Flag, Smile } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';

interface OnlineGameProps {
  onBack: () => void;
  playerName: string;
}

const quickEmojis = ['👍', '🎯', '🔥', '😮', '🤔', '😊'];

export function OnlineGame({ onBack, playerName }: OnlineGameProps) {
  const [game, setGame] = useState(new Chess());
  const [playerColor] = useState<'w' | 'b'>(Math.random() > 0.5 ? 'w' : 'b');
  const [opponentName] = useState('ChessMaster99');
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<Array<{ sender: string; text: string; time: string }>>([
    { sender: 'System', text: 'Game started. Good luck!', time: '0:00' }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [gameOver, setGameOver] = useState(false);
  const [result, setResult] = useState('');
  const [timeControl, setTimeControl] = useState({ white: 600, black: 600 });

  const handleMove = (move: any) => {
    const newGame = new Chess(game.fen());
    checkGameStatus(newGame);

    // Simulate opponent move in online mode
    if (!newGame.isGameOver()) {
      setTimeout(() => {
        makeOpponentMove(newGame);
      }, 1000);
    }
  };

  const makeOpponentMove = (currentGame: Chess) => {
    const moves = currentGame.moves({ verbose: true });
    if (moves.length === 0) return;

    const randomMove = moves[Math.floor(Math.random() * moves.length)];
    currentGame.move(randomMove);
    setGame(new Chess(currentGame.fen()));
    checkGameStatus(currentGame);
  };

  const checkGameStatus = (currentGame: Chess) => {
    if (currentGame.isCheckmate()) {
      setGameOver(true);
      setResult(currentGame.turn() === playerColor ? 'You lost by checkmate' : 'You won by checkmate!');
    } else if (currentGame.isDraw()) {
      setGameOver(true);
      setResult('Game drawn');
    } else if (currentGame.isStalemate()) {
      setGameOver(true);
      setResult('Stalemate');
    }
  };

  const sendMessage = () => {
    if (inputMessage.trim()) {
      const newMessage = {
        sender: playerName,
        text: inputMessage,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages([...messages, newMessage]);
      setInputMessage('');

      // Simulate opponent response
      setTimeout(() => {
        const responses = ['Nice move!', 'Interesting...', 'Good game so far', 'Let me think...'];
        setMessages(prev => [...prev, {
          sender: opponentName,
          text: responses[Math.floor(Math.random() * responses.length)],
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
      }, 2000);
    }
  };

  const sendQuickEmoji = (emoji: string) => {
    const newMessage = {
      sender: playerName,
      text: emoji,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages([...messages, newMessage]);
  };

  const resign = () => {
    setGameOver(true);
    setResult('You resigned');
  };

  const handleTimeUpdate = (color: 'white' | 'black', time: number) => {
    setTimeControl(prev => ({ ...prev, [color]: time }));

    if (time === 0) {
      setGameOver(true);
      setResult(color === (playerColor === 'w' ? 'white' : 'black') ? 'You lost on time' : 'You won on time!');
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#121212] flex p-6 gap-6" style={{ height: '100dvh' }}>
      {/* Main Game Area */}
      <div className="flex-1 flex flex-col">
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
              className="bg-neutral-800 border-neutral-700 hover:bg-neutral-700"
              onClick={() => setChatOpen(!chatOpen)}
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Chat {messages.length > 1 && `(${messages.length - 1})`}
            </Button>

            <Button
              variant="outline"
              className="bg-red-500/20 border-red-500/50 text-red-500 hover:bg-red-500/30"
              onClick={resign}
              disabled={gameOver}
            >
              <Flag className="w-4 h-4 mr-2" />
              Resign
            </Button>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <ChessBoard
            game={game}
            onMove={handleMove}
            playerColor={playerColor}
            opponentName={opponentName}
            playerName={playerName}
            mode="online"
            timeControl={timeControl}
            onTimeUpdate={handleTimeUpdate}
          />
        </div>
      </div>

      {/* Collapsible Chat Sidebar */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 350, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="overflow-hidden"
          >
            <Card className="bg-neutral-900/80 backdrop-blur-xl border-neutral-800 h-full flex flex-col">
              <div className="p-4 border-b border-neutral-800">
                <h3 className="text-white font-bold">Game Chat</h3>
                <p className="text-xs text-neutral-400 mt-1">Playing against {opponentName}</p>
              </div>

              <ScrollArea className="flex-1 p-4">
                <div className="space-y-3">
                  {messages.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`${
                        msg.sender === 'System'
                          ? 'text-center text-xs text-neutral-500 italic'
                          : msg.sender === playerName
                          ? 'text-right'
                          : 'text-left'
                      }`}
                    >
                      {msg.sender !== 'System' && (
                        <div className={`inline-block max-w-[80%] ${
                          msg.sender === playerName
                            ? 'bg-green-500/20 text-green-100'
                            : 'bg-neutral-800 text-neutral-100'
                        } rounded-lg px-3 py-2`}>
                          <p className="text-xs font-medium opacity-70">{msg.sender}</p>
                          <p className="text-sm">{msg.text}</p>
                          <p className="text-xs opacity-50 mt-1">{msg.time}</p>
                        </div>
                      )}
                      {msg.sender === 'System' && <p>{msg.text}</p>}
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>

              <div className="p-4 border-t border-neutral-800 space-y-3">
                <div className="flex gap-2">
                  {quickEmojis.map((emoji, i) => (
                    <Button
                      key={i}
                      variant="ghost"
                      size="sm"
                      className="hover:bg-neutral-800 text-lg"
                      onClick={() => sendQuickEmoji(emoji)}
                    >
                      {emoji}
                    </Button>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Input
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Type a message..."
                    className="bg-neutral-800 border-neutral-700 text-white"
                  />
                  <Button
                    onClick={sendMessage}
                    className="bg-green-500 hover:bg-green-600"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

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
              onClick={() => {
                setGame(new Chess());
                setGameOver(false);
                setMessages([{ sender: 'System', text: 'New game started. Good luck!', time: '0:00' }]);
                setTimeControl({ white: 600, black: 600 });
              }}
            >
              Rematch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
