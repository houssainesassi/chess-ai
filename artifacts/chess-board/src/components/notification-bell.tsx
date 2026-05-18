import { useState, useRef, useEffect } from "react";
import { Bell, UserPlus, UserCheck, Swords, MessageCircle, Check, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { api, type NotificationItem } from "@/lib/api";
import { useNotifications } from "@/hooks/use-socket-notifications";
import { useLocation } from "wouter";

const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  friend_request: { icon: UserPlus, color: "text-blue-400", label: "Friend request" },
  friend_accepted: { icon: UserCheck, color: "text-green-400", label: "Friend accepted" },
  game_invite: { icon: Swords, color: "text-yellow-400", label: "Game invite" },
  direct_message: { icon: MessageCircle, color: "text-purple-400", label: "Message" },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export function NotificationBell() {
  const { token } = useAuth();
  const { unreadCount, clearUnread } = useNotifications();
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchAndOpen = async () => {
    if (!token) return;
    if (!open) {
      setOpen(true);
      setLoading(true);
      try {
        const data = await api.getNotifications(token);
        setNotifications(data.notifications);
        clearUnread();
        await api.markAllNotificationsRead(token);
      } catch (_) {}
      setLoading(false);
    } else {
      setOpen(false);
    }
  };

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleNotifClick = (n: NotificationItem) => {
    if (n.type === "direct_message" && n.fromUserId) setLocation(`/messages/${n.fromUserId}`);
    else if (n.type === "game_invite" && n.refId) setLocation(`/game/${n.refId}`);
    else if (n.type === "friend_request" || n.type === "friend_accepted") setLocation("/lobby");
    setOpen(false);
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={fetchAndOpen}
        className="relative flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-80 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="font-semibold text-sm">Notifications</span>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                Loading…
              </div>
            )}
            {!loading && notifications.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Bell className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm">No notifications yet</p>
              </div>
            )}
            {!loading && notifications.map((n) => {
              const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.friend_request;
              const Icon = cfg.icon;
              return (
                <button
                  key={n.id}
                  onClick={() => handleNotifClick(n)}
                  className={`w-full flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left border-b border-border/50 last:border-0 ${!n.readAt ? "bg-primary/5" : ""}`}
                >
                  <div className={`mt-0.5 shrink-0 ${cfg.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground leading-snug line-clamp-2">{n.message}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.readAt && (
                    <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
