import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { LogOut, Swords, History, Users, Settings, Globe2, MessageCircle, Trophy } from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";

function isFullscreenRoute(path: string) {
  return path === "/game" || path.startsWith("/game/");
}

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  if (!user) return <>{children}</>;

  if (isFullscreenRoute(location)) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-background text-foreground flex flex-col">
        {children}
      </div>
    );
  }

  const isMessages = location.startsWith("/messages");

  const navItems = [
    { href: "/lobby", label: "Play", icon: Swords },
    { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
    { href: "/players", label: "Players", icon: Globe2 },
    { href: "/messages", label: "Messages", icon: MessageCircle },
    { href: "/history", label: "History", icon: History },
    { href: `/profile/${user?.id}`, label: "My Profile", icon: Users },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      <aside className="w-full md:w-64 bg-card border-b md:border-b-0 md:border-r border-border p-4 flex flex-col shrink-0">
        {/* Logo + notification bell */}
        <div className="flex items-center gap-3 mb-8 px-2">
          <img src="/icon.png" alt="Smart Chess Board" className="w-10 h-10 rounded-xl object-cover" />
          <span className="font-bold text-xl tracking-tight hidden md:block flex-1">Smart Chess</span>
          <div className="hidden md:block ml-auto">
            <NotificationBell />
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-visible">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === "/messages"
              ? location.startsWith("/messages")
              : item.href.startsWith("/profile")
              ? location.startsWith("/profile")
              : item.href === "/leaderboard"
              ? location === "/leaderboard"
              : location.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors whitespace-nowrap
                  ${isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="font-medium hidden md:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Mobile: notification bell */}
        <div className="md:hidden flex justify-center py-2">
          <NotificationBell />
        </div>

        {/* User info + logout */}
        <div className="mt-auto pt-4 border-t border-border hidden md:block">
          <div className="flex items-center gap-3 px-2 mb-3">
            <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-bold text-sm shrink-0">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold truncate">{user.username}</span>
              <span className="text-xs text-muted-foreground">Rating: {(user as any).rating || 1200}</span>
            </div>
          </div>
          <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground" onClick={logout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </aside>

      <main className={`flex-1 ${isMessages ? "overflow-hidden flex flex-col" : "overflow-auto"}`}>
        {children}
      </main>
    </div>
  );
}
