import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { queryClient } from "@/lib/queryClient";
import NotFound from "@/pages/not-found";
import GamePage from "@/pages/Game";
import MultiplayerGamePage from "@/pages/MultiplayerGame";
import LobbyPage from "@/pages/Lobby";
import HomePage from "@/pages/Home";
import SignInPage from "@/pages/SignIn";
import SignUpPage from "@/pages/SignUp";
import OnboardingModal from "@/components/OnboardingModal";
import SettingsPage from "@/pages/Settings";
import GameHistoryPage from "@/pages/GameHistory";
import GameReplayPage from "@/pages/GameReplay";
import AdminUsersPage from "@/pages/AdminUsers";
import { useProfile } from "@/hooks/use-profile";
import { NotificationProvider, useNotifications } from "@/context/NotificationContext";
import { AuthProvider, useAuth, useUser } from "@/context/AuthContext";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function HomeRoute() {
  const { isSignedIn, isLoaded } = useAuth();
  if (!isLoaded) return null;
  return isSignedIn ? <Redirect to="/lobby" /> : <HomePage />;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();
  if (!isLoaded) return null;
  return isSignedIn ? <>{children}</> : <Redirect to="/" />;
}

function FullRouter() {
  return (
    <Switch>
      <Route path="/" component={HomeRoute} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/lobby">
        <ProtectedRoute><LobbyPage /></ProtectedRoute>
      </Route>
      <Route path="/settings">
        <ProtectedRoute><SettingsPage /></ProtectedRoute>
      </Route>
      <Route path="/history">
        <ProtectedRoute><GameHistoryPage /></ProtectedRoute>
      </Route>
      <Route path="/history/:id">
        {(params) => <ProtectedRoute><GameReplayPage gameId={params.id} /></ProtectedRoute>}
      </Route>
      <Route path="/admin/users">
        <ProtectedRoute><AdminUsersPage /></ProtectedRoute>
      </Route>
      <Route path="/game" component={GamePage} />
      <Route path="/game/:id">
        {(params) => <ProtectedRoute><MultiplayerGamePage gameId={params.id} /></ProtectedRoute>}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function OnboardingGate() {
  const { isSignedIn, isLoaded } = useAuth();
  const { data: profile, isLoading } = useProfile();

  if (!isLoaded || !isSignedIn) return null;
  if (isLoading) return null;

  return <OnboardingModal open={profile === null} />;
}

function UserSocketRegistrar() {
  const { user } = useUser();
  const { registerUser } = useNotifications();

  useEffect(() => {
    if (user?.id) registerUser(user.id);
  }, [user?.id, registerUser]);

  return null;
}

function AppProviders() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <NotificationProvider>
          <UserSocketRegistrar />
          <OnboardingGate />
          <FullRouter />
          <Toaster />
        </NotificationProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <AuthProvider>
        <AppProviders />
      </AuthProvider>
    </WouterRouter>
  );
}

export default App;
