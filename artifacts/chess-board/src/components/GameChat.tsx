import { useState, useEffect, useRef } from "react";
import { Send, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/hooks/use-socket";

interface GameChatProps {
  messages: ChatMessage[];
  currentUserId: string;
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function GameChat({ messages, currentUserId, onSend, disabled }: GameChatProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40">
        <MessageSquare size={14} className="text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Game Chat
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0">
        {messages.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center pt-4 italic">
            No messages yet. Say hi!
          </p>
        ) : (
          messages.map((msg) => {
            const isMe = msg.userId === currentUserId;
            return (
              <div
                key={msg.id}
                className={cn(
                  "flex flex-col gap-0.5",
                  isMe ? "items-end" : "items-start"
                )}
              >
                <div className="flex items-baseline gap-1.5">
                  {!isMe && (
                    <span className="text-[10px] font-semibold text-muted-foreground truncate max-w-[80px]">
                      {msg.username}
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground/60">
                    {formatTime(msg.createdAt)}
                  </span>
                </div>
                <div
                  className={cn(
                    "px-3 py-1.5 rounded-2xl text-sm max-w-[85%] break-words leading-snug",
                    isMe
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-secondary/60 text-foreground rounded-bl-sm border border-border/30"
                  )}
                >
                  {msg.message}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-3 py-2 border-t border-border/40">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={disabled ? "Join the game to chat" : "Message…"}
            maxLength={200}
            className="flex-1 bg-secondary/30 border border-border/40 rounded-full px-3 py-1.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSend}
            disabled={disabled || !input.trim()}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          >
            <Send size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
