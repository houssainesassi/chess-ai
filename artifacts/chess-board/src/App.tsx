import { useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ClerkProvider, Show, useClerk, useAuth, useUser } from "@clerk/react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { queryClient } from "@/lib/queryClient";
import { setAuthTokenGetter } from "@workspace/api-client-react";
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

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const hasClerk = !!clerkPubKey;

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

function ClerkAuthSetup() {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  useEffect(() => {
    setAuthTokenGetter(() => getTokenRef.current());
    return () => setAuthTokenGetter(null);
  }, []);

  return null;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function HomeRoute() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/lobby" />
      </Show>
      <Show when="signed-out">
        <HomePage />
      </Show>
    </>
  );
}

function LobbyRoute() {
  return (
    <>
      <Show when="signed-in">
        <LobbyPage />
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function MultiplayerRoute({ id }: { id: string }) {
  return (
    <>
      <Show when="signed-in">
        <MultiplayerGamePage gameId={id} />
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function SettingsRoute() {
  return (
    <>
      <Show when="signed-in">
        <SettingsPage />
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function HistoryRoute() {
  return (
    <>
      <Show when="signed-in">
        <GameHistoryPage />
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function ReplayRoute({ id }: { id: string }) {
  return (
    <>
      <Show when="signed-in">
        <GameReplayPage gameId={id} />
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function AdminRoute() {
  return (
    <>
      <Show when="signed-in">
        <AdminUsersPage />
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function FullRouter() {
  return (
    <Switch>
      <Route path="/" component={HomeRoute} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/lobby" component={LobbyRoute} />
      <Route path="/settings" component={SettingsRoute} />
      <Route path="/history" component={HistoryRoute} />
      <Route path="/history/:id">
        {(params) => <ReplayRoute id={params.id} />}
      </Route>
      <Route path="/admin/users" component={AdminRoute} />
      <Route path="/game" component={GamePage} />
      <Route path="/game/:id">
        {(params) => <MultiplayerRoute id={params.id} />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function LocalRouter() {
  return (
    <Switch>
      <Route path="/" component={GamePage} />
      <Route path="/game" component={GamePage} />
      <Route component={GamePage} />
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

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey!}
      proxyUrl={clerkProxyUrl}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <NotificationProvider>
            <ClerkAuthSetup />
            <ClerkQueryClientCacheInvalidator />
            <UserSocketRegistrar />
            <OnboardingGate />
            <FullRouter />
            <Toaster />
          </NotificationProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function LocalProviderWithRoutes() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <LocalRouter />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      {hasClerk ? <ClerkProviderWithRoutes /> : <LocalProviderWithRoutes />}
    </WouterRouter>
  );
}

export default App;
