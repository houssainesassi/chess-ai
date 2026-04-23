import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { Layout } from "@/components/layout";
import NotFound from "@/pages/not-found";

import AuthPage from "@/pages/auth";
import LobbyPage from "@/pages/lobby";
import GamePage from "@/pages/game";
import MultiplayerGamePage from "@/pages/multiplayer-game";
import SpectatePage from "@/pages/spectate";
import HistoryPage from "@/pages/history";
import HistoryReplayPage from "@/pages/history-replay";
import SettingsPage from "@/pages/settings";
import ProfilePage from "@/pages/profile";
import { SocketNotificationProvider } from "@/hooks/use-socket-notifications";

const queryClient = new QueryClient();

function ProtectedRoute({ component: Component, ...rest }: any) {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background text-foreground">Loading...</div>;
  }
  
  if (!user) {
    window.location.href = "/";
    return null;
  }
  
  return <Component {...rest} />;
}

function Router() {
  const { user } = useAuth();

  return (
    <Layout>
      <Switch>
        <Route path="/" component={user ? () => { window.location.href = "/lobby"; return null; } : AuthPage} />
        <Route path="/lobby" component={() => <ProtectedRoute component={LobbyPage} />} />
        <Route path="/game" component={() => <ProtectedRoute component={GamePage} />} />
        <Route path="/game/:id" component={() => <ProtectedRoute component={MultiplayerGamePage} />} />
        <Route path="/spectate/:id" component={() => <ProtectedRoute component={SpectatePage} />} />
        <Route path="/history" component={() => <ProtectedRoute component={HistoryPage} />} />
        <Route path="/history/:id" component={() => <ProtectedRoute component={HistoryReplayPage} />} />
        <Route path="/settings" component={() => <ProtectedRoute component={SettingsPage} />} />
        <Route path="/profile/:userId" component={() => <ProtectedRoute component={ProfilePage} />} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <SocketNotificationProvider>
              <Router />
            </SocketNotificationProvider>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
