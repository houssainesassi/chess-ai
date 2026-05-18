import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { api, type DirectMessage, type Conversation } from "@/lib/api";
import { io, Socket } from "socket.io-client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Smile, ArrowLeft, MessageSquare, Search } from "lucide-react";

const EMOJIS = ["😀","😂","🥲","😍","🤔","👍","👎","❤️","🔥","✅","❌","🏆","♟️","💪","🎉","😎","🤝","👋","💬","⚡","🎯","🙏","😤","😅","🤣","😭","😡","🥳","🤩","👀","💡","🚀","⭐","🌙","💎","🎮"];

function timeStr(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function dateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getDate() - d.getDate();
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function Avatar({ name, color, size = "sm" }: { name: string; color: string | null; size?: "sm" | "md" }) {
  const sz = size === "md" ? "w-10 h-10 text-sm" : "w-9 h-9 text-xs";
  return (
    <div
      className={`${sz} rounded-full flex items-center justify-center font-bold text-white shrink-0`}
      style={{ background: color || "#3b82f6" }}
    >
      {(name || "?").charAt(0).toUpperCase()}
    </div>
  );
}

export default function MessagesPage() {
  const { userId: paramUserId } = useParams<{ userId?: string }>();
  const { token, user } = useAuth();
  const [, setLocation] = useLocation();
  const myId = user?.id || "";

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(paramUserId || null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [partnerInfo, setPartnerInfo] = useState<Conversation["partner"] | null>(null);
  const [inputText, setInputText] = useState("");
  const [showEmojis, setShowEmojis] = useState(false);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [search, setSearch] = useState("");
  const [convsLoading, setConvsLoading] = useState(true);
  const [msgsLoading, setMsgsLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Socket connection
  useEffect(() => {
    if (!token || !user) return;
    const socket = io({ path: "/api/socket.io", reconnectionDelay: 2000 });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("registerUser", { userId: user.id });
    });

    socket.on("dmReceived", (data: { id: string; fromUserId: string; message: string; createdAt: string }) => {
      setConversations((prev) => {
        const updated = prev.map((c) =>
          c.partnerId === data.fromUserId
            ? { ...c, lastMessage: data.message, lastSenderId: data.fromUserId, lastMessageAt: new Date(data.createdAt), unreadCount: selectedUserId === data.fromUserId ? 0 : c.unreadCount + 1 }
            : c
        );
        if (!updated.find((c) => c.partnerId === data.fromUserId)) fetchConversations();
        return updated;
      });

      if (selectedUserId === data.fromUserId) {
        setMessages((prev) => [...prev, {
          id: data.id, fromUserId: data.fromUserId, toUserId: myId,
          message: data.message, seenAt: null, createdAt: new Date(data.createdAt),
        } as DirectMessage]);
        api.markMessagesSeen(token!, data.fromUserId).catch(() => {});
      }
    });

    socket.on("dmTyping", (data: { fromUserId: string; isTyping: boolean }) => {
      if (data.fromUserId === selectedUserId) setIsPartnerTyping(data.isTyping);
    });

    socket.on("dmSeen", (data: { byUserId: string }) => {
      if (data.byUserId === selectedUserId) {
        setMessages((prev) =>
          prev.map((m) => m.fromUserId === myId && !m.seenAt ? { ...m, seenAt: new Date() as any } : m)
        );
      }
    });

    return () => { socket.disconnect(); };
  }, [token, user?.id, selectedUserId]);

  // Sync selectedUserId from URL param
  useEffect(() => {
    if (paramUserId && paramUserId !== selectedUserId) setSelectedUserId(paramUserId);
  }, [paramUserId]);

  const fetchConversations = async () => {
    if (!token) return;
    try {
      const data = await api.getConversations(token);
      setConversations(data.conversations);
    } catch (_) {}
    setConvsLoading(false);
  };

  useEffect(() => { fetchConversations(); }, [token]);

  useEffect(() => {
    if (!selectedUserId || !token) return;
    setMsgsLoading(true);
    setIsPartnerTyping(false);
    api.getMessagesWithUser(token, selectedUserId)
      .then((data) => {
        setMessages(data.messages);
        setPartnerInfo(data.partner);
        api.markMessagesSeen(token, selectedUserId).catch(() => {});
        setConversations((prev) =>
          prev.map((c) => c.partnerId === selectedUserId ? { ...c, unreadCount: 0 } : c)
        );
      })
      .catch(() => {})
      .finally(() => setMsgsLoading(false));
  }, [selectedUserId, token]);

  useEffect(() => { scrollToBottom(); }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim() || !selectedUserId || !token || sending) return;
    const text = inputText.trim();
    setInputText("");
    setSending(true);

    // Optimistic
    const optimistic: DirectMessage = {
      id: `temp-${Date.now()}`,
      fromUserId: myId,
      toUserId: selectedUserId,
      message: text,
      seenAt: null,
      createdAt: new Date(),
    } as any;
    setMessages((prev) => [...prev, optimistic]);

    socketRef.current?.emit("dmSend", { toUserId: selectedUserId, message: text });

    try {
      const saved = await api.sendMessage(token, selectedUserId, text);
      setMessages((prev) => prev.map((m) => m.id === optimistic.id ? saved : m));
      setConversations((prev) => {
        const updated = prev.map((c) =>
          c.partnerId === selectedUserId
            ? { ...c, lastMessage: text, lastSenderId: myId, lastMessageAt: new Date() }
            : c
        );
        if (!updated.find((c) => c.partnerId === selectedUserId)) fetchConversations();
        return updated;
      });
    } catch (_) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    }
    setSending(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleTyping = (val: string) => {
    setInputText(val);
    if (!selectedUserId) return;
    socketRef.current?.emit("dmTyping", { toUserId: selectedUserId, isTyping: val.length > 0 });
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      socketRef.current?.emit("dmTyping", { toUserId: selectedUserId, isTyping: false });
    }, 2000);
  };

  const selectConversation = (partnerId: string) => {
    setSelectedUserId(partnerId);
    setLocation(`/messages/${partnerId}`);
  };

  const filteredConversations = conversations.filter((c) =>
    !search || (c.partner?.nickname || c.partner?.username || "").toLowerCase().includes(search.toLowerCase())
  );

  // Group messages by date
  const groupedMessages: { label: string; msgs: DirectMessage[] }[] = [];
  for (const msg of messages) {
    const label = dateLabel(msg.createdAt as any as string);
    const last = groupedMessages[groupedMessages.length - 1];
    if (last && last.label === label) last.msgs.push(msg);
    else groupedMessages.push({ label, msgs: [msg] });
  }

  const chatPartner = partnerInfo || conversations.find((c) => c.partnerId === selectedUserId)?.partner;

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* ── Conversation list ── */}
      <div className={`w-full md:w-80 border-r border-border flex flex-col shrink-0 ${selectedUserId ? "hidden md:flex" : "flex"}`}>
        <div className="p-4 border-b border-border">
          <h1 className="text-xl font-bold mb-3">Messages</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations…"
              className="pl-9 bg-background h-9"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {convsLoading && (
            <div className="space-y-1 p-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
                  <div className="w-9 h-9 rounded-full bg-muted shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 bg-muted rounded w-24" />
                    <div className="h-3 bg-muted rounded w-40" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {!convsLoading && filteredConversations.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground text-sm text-center px-6">
              <MessageSquare className="w-10 h-10 mb-3 opacity-30" />
              <p className="font-medium">No conversations yet</p>
              <p className="text-xs mt-1 opacity-70">Visit the Players page to message someone</p>
            </div>
          )}
          {filteredConversations.map((conv) => {
            const name = conv.partner?.nickname || conv.partner?.username || "Unknown";
            const isSelected = conv.partnerId === selectedUserId;
            return (
              <button
                key={conv.partnerId}
                onClick={() => selectConversation(conv.partnerId)}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left border-b border-border/40 last:border-0 ${isSelected ? "bg-primary/10" : ""}`}
              >
                <div className="relative">
                  <Avatar name={name} color={conv.partner?.avatarColor || null} />
                  {conv.partner?.isOnline && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-card" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm truncate">{name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {conv.lastMessageAt ? timeAgo(conv.lastMessageAt as any as string) : ""}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground truncate">
                      {conv.lastSenderId === myId ? "You: " : ""}{conv.lastMessage}
                    </p>
                    {conv.unreadCount > 0 && (
                      <span className="shrink-0 min-w-[18px] h-[18px] bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Chat panel ── */}
      <div className={`flex-1 flex flex-col min-h-0 ${selectedUserId ? "flex" : "hidden md:flex"}`}>
        {!selectedUserId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <MessageSquare className="w-16 h-16 mb-4 opacity-20" />
            <p className="font-medium">Select a conversation</p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
              <button
                className="md:hidden text-muted-foreground hover:text-foreground mr-1"
                onClick={() => { setSelectedUserId(null); setLocation("/messages"); }}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              {chatPartner && (
                <>
                  <div className="relative">
                    <Avatar name={chatPartner.nickname || chatPartner.username} color={chatPartner.avatarColor} size="md" />
                    {chatPartner.isOnline && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-card" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{chatPartner.nickname || chatPartner.username}</p>
                    <p className="text-xs text-muted-foreground">{chatPartner.isOnline ? "Online" : "Offline"}</p>
                  </div>
                </>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
              {msgsLoading && (
                <div className="flex justify-center text-muted-foreground text-sm py-8">Loading…</div>
              )}

              {!msgsLoading && groupedMessages.map(({ label, msgs }) => (
                <div key={label}>
                  <div className="flex items-center gap-3 my-3">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                  {msgs.map((msg) => {
                    const isMine = msg.fromUserId === myId;
                    return (
                      <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"} mb-1`}>
                        <div className={`max-w-[75%] ${isMine ? "items-end" : "items-start"} flex flex-col`}>
                          <div
                            className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed break-words ${
                              isMine
                                ? "bg-primary text-primary-foreground rounded-br-sm"
                                : "bg-muted text-foreground rounded-bl-sm"
                            }`}
                          >
                            {msg.message}
                          </div>
                          <div className={`flex items-center gap-1 mt-0.5 ${isMine ? "flex-row-reverse" : ""}`}>
                            <span className="text-[10px] text-muted-foreground">{timeStr(msg.createdAt as any as string)}</span>
                            {isMine && (
                              <span className="text-[10px] text-muted-foreground">
                                {msg.seenAt ? "✓✓" : "✓"}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

              {isPartnerTyping && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-2.5">
                    <div className="flex gap-1 items-center">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Emoji picker */}
            {showEmojis && (
              <div className="border-t border-border bg-card px-4 py-2">
                <div className="flex flex-wrap gap-1">
                  {EMOJIS.map((em) => (
                    <button
                      key={em}
                      className="w-8 h-8 flex items-center justify-center text-lg hover:bg-muted rounded transition-colors"
                      onClick={() => { setInputText((t) => t + em); setShowEmojis(false); inputRef.current?.focus(); }}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input bar */}
            <div className="flex items-center gap-2 px-4 py-3 border-t border-border shrink-0">
              <button
                className={`text-muted-foreground hover:text-foreground transition-colors p-1 rounded ${showEmojis ? "text-primary" : ""}`}
                onClick={() => setShowEmojis((v) => !v)}
              >
                <Smile className="w-5 h-5" />
              </button>
              <Input
                ref={inputRef}
                value={inputText}
                onChange={(e) => handleTyping(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message…"
                className="flex-1 bg-background"
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!inputText.trim() || sending}
                className="shrink-0"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
