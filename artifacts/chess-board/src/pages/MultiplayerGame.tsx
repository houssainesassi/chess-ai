import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { useUser } from "@/context/AuthContext";
import { ChessBoard } from "@/components/ChessBoard";
import { Sidebar } from "@/components/Sidebar";
import { GameChat } from "@/components/GameChat";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { HandCursorInput } from "@/components/HandCursorInput";
import { EyeTrackingInput } from "@/components/EyeTrackingInput";
import { VoiceInput } from "@/components/VoiceInput";
import { DraggableCameraWindow } from "@/components/DraggableCameraWindow";
import { useMultiplayerGameSocket } from "@/hooks/use-socket";
import type { ChatMessage } from "@/hooks/use-socket";
import { useProfiles } from "@/hooks/use-profile";
import { getCountryByCode } from "@/lib/countries";
import {
  useGetGame,
  useMakeGameMove,
  useAnalyzePosition,
  getGetGameQueryKey,
} from "@workspace/api-client-react";
import type { AnalysisResult, GameSessionWithState } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Clock, Crown, Link, Mouse, Hand, Wifi, Eye, Mic, History } from "lucide-react";
import { useSettings } from "@/hooks/use-settings";

interface MultiplayerGamePageProps {
  gameId: string;
}

export default function MultiplayerGamePage({ gameId }: MultiplayerGamePageProps) {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  const [, navigate] = useLocation();
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showBestMove, setShowBestMove] = useState(false);
  const { settings, boardThemeObj } = useSettings();
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // Input mode toggles
  const [mouseEnabled, setMouseEnabled] = useState(true);
  const [handEnabled, setHandEnabled] = useState(false);
  const [eyeEnabled, setEyeEnabled] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);

  // Hand cursor state
  const [handHoveredSquare, setHandHoveredSquare] = useState<string | null>(null);
  const [handSelectedSquare, setHandSelectedSquare] = useState<string | null>(null);

  // Eye tracking state
  const [eyeHoveredSquare, setEyeHoveredSquare] = useState<string | null>(null);
  const [eyeSelectedSquare, setEyeSelectedSquare] = useState<string | null>(null);

  const prevFenRef = useRef<string | null>(null);
  const analyzeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: game, isLoading } = useGetGame(gameId, {
    query: { refetchInterval: 5000 } as any,
  });
  const analyzePosition = useAnalyzePosition();
  const makeMove = useMakeGameMove({
    mutation: {
      onSuccess: (result) => {
        queryClient.setQueryData(getGetGameQueryKey(gameId), (old: GameSessionWithState | undefined) => {
          if (!old) return old;
          return { ...old, ...result.gameState };
        });
        queryClient.invalidateQueries({ queryKey: getGetGameQueryKey(gameId) });
      },
      onError: (err: any) => {
        const msg = err?.message ?? "Invalid move";
        toast({ title: msg, variant: "destructive" });
      },
    },
  });

  const isLocked = makeMove.isPending;

  const handleChatMessage = useCallback((msg: ChatMessage) => {
    setChatMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
  }, []);

  const { sendMessage } = useMultiplayerGameSocket(gameId, handleChatMessage);

  useEffect(() => {
    if (!gameId) return;
    fetch(`/api/games/${gameId}/messages`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.messages)) setChatMessages(data.messages);
      })
      .catch(() => {});
  }, [gameId]);

  const userId = user?.id ?? "";
  const username =
    user?.username ?? user?.email ?? user?.id ?? "Player";

  const playerIds = useMemo(() => {
    const ids: string[] = [];
    if (game?.whitePlayerId) ids.push(game.whitePlayerId);
    if (game?.blackPlayerId) ids.push(game.blackPlayerId);
    return ids;
  }, [game?.whitePlayerId, game?.blackPlayerId]);

  const { data: profileList } = useProfiles(playerIds);
  const profileMap = useMemo(() => {
    const map: Record<string, NonNullable<typeof profileList>[number]> = {};
    profileList?.forEach((p) => { map[p.userId] = p; });
    return map;
  }, [profileList]);

  const isWhite = game?.whitePlayerId === userId;
  const isBlack = game?.blackPlayerId === userId;
  const isPlayer = isWhite || isBlack;
  const myColor = isWhite ? "w" : isBlack ? "b" : null;
  const canMove =
    isPlayer &&
    game?.status === "active" &&
    !game?.isGameOver &&
    game?.turn === myColor;

  const runAnalysis = useCallback(
    (fen: string, previousFen?: string, lastMove?: string) => {
      if (analyzeTimeoutRef.current) clearTimeout(analyzeTimeoutRef.current);
      analyzeTimeoutRef.current = setTimeout(() => {
        setIsAnalyzing(true);
        analyzePosition.mutate(
          { data: { fen, depth: 15, previousFen: previousFen ?? null, lastMove: lastMove ?? null } },
          {
            onSuccess: (result: AnalysisResult) => { setAnalysis(result); setIsAnalyzing(false); },
            onError: () => setIsAnalyzing(false),
          }
        );
      }, 400);
    },
    [analyzePosition]
  );

  useEffect(() => {
    if (!game?.fen || !game?.moveHistory) return;
    const currentFen = game.fen;
    const previousFen = prevFenRef.current;
    if (currentFen === previousFen) return;
    const history = game.moveHistory;
    let lastMoveUci: string | undefined;
    if (history.length > 0) {
      const lm = history[history.length - 1];
      lastMoveUci = lm.from + lm.to + (lm.promotion ?? "");
    }
    runAnalysis(currentFen, previousFen ?? undefined, lastMoveUci);
    prevFenRef.current = currentFen;
  }, [game?.fen, game?.moveHistory, runAnalysis]);

  const handleMove = useCallback(
    (uciMove: string, _source: "mouse" | "camera" | "hand" | "eye" | "voice") => {
      if (!canMove || isLocked) return;
      makeMove.mutate({ id: gameId, data: { move: uciMove } });
    },
    [canMove, isLocked, gameId, makeMove]
  );

  const handleSendMessage = useCallback(
    (message: string) => {
      if (!userId) return;
      sendMessage(userId, username, message);
    },
    [userId, username, sendMessage]
  );

  const copyInviteLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      toast({ title: "Invite link copied!" });
    });
  };

  const currentFen = game?.fen ?? "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

  const gameOverAction = game?.isGameOver ? (
    <button
      type="button"
      onClick={() => navigate(`/history/${gameId}`)}
      className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-primary/10 border border-primary/30 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors"
    >
      <History size={15} />
      Review in History
    </button>
  ) : null;

  const inputStatusBar = (
    <div className="flex items-center gap-1.5 px-1 py-1 bg-secondary/20 border border-border/40 rounded-xl flex-wrap">
      <button
        onClick={() => setMouseEnabled((v) => !v)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
          mouseEnabled
            ? "bg-blue-500/20 border border-blue-500/50 text-blue-400"
            : "bg-transparent border border-transparent text-muted-foreground hover:text-foreground"
        }`}
      >
        <Mouse size={12} />
        Mouse {mouseEnabled ? "Active" : "OFF"}
      </button>

      <button
        onClick={() => setHandEnabled((v) => !v)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
          handEnabled
            ? "bg-purple-500/20 border border-purple-500/50 text-purple-400"
            : "bg-transparent border border-transparent text-muted-foreground hover:text-foreground"
        }`}
      >
        <Hand size={12} />
        Hand {handEnabled ? "Active" : "OFF"}
      </button>

      <button
        onClick={() => setEyeEnabled((v) => !v)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
          eyeEnabled
            ? "bg-cyan-500/20 border border-cyan-500/50 text-cyan-400"
            : "bg-transparent border border-transparent text-muted-foreground hover:text-foreground"
        }`}
      >
        <Eye size={12} />
        Eye {eyeEnabled ? "Active" : "OFF"}
      </button>

      <button
        onClick={() => setVoiceEnabled((v) => !v)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
          voiceEnabled
            ? "bg-rose-500/20 border border-rose-500/50 text-rose-400"
            : "bg-transparent border border-transparent text-muted-foreground hover:text-foreground"
        }`}
      >
        <Mic size={12} />
        Voice {voiceEnabled ? "Active" : "OFF"}
      </button>

      <div className="ml-auto flex items-center gap-1 px-2 py-1">
        <Wifi size={10} className="text-emerald-400" />
        <span className="text-[10px] text-emerald-400 font-semibold">Live Sync</span>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-foreground">
        <div className="text-center space-y-3">
          <div className="text-3xl">♟️</div>
          <p className="text-muted-foreground">Loading game…</p>
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-foreground">
        <div className="text-center space-y-4">
          <p className="text-xl">Game not found</p>
          <button onClick={() => navigate("/lobby")} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg">
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  const whiteProfile = profileMap[game.whitePlayerId];
  const blackProfile = game.blackPlayerId ? profileMap[game.blackPlayerId] : undefined;
  const whiteCountry = whiteProfile ? getCountryByCode(whiteProfile.country) : undefined;
  const blackCountry = blackProfile ? getCountryByCode(blackProfile.country) : undefined;

  const whiteName = game.whitePlayerId === userId
    ? `You${whiteProfile ? ` (${whiteProfile.nickname})` : ""}`
    : whiteProfile?.nickname ?? `${game.whitePlayerId.slice(0, 8)}…`;
  const blackName = game.blackPlayerId
    ? game.blackPlayerId === userId
      ? `You${blackProfile ? ` (${blackProfile.nickname})` : ""}`
      : blackProfile?.nickname ?? `${game.blackPlayerId.slice(0, 8)}…`
    : "Waiting for opponent…";

  const statusBanner = (() => {
    if (game.status === "waiting") {
      return (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-500 text-sm">
          <Clock size={14} />
          Waiting for opponent —
          <button onClick={copyInviteLink} className="flex items-center gap-1 underline hover:no-underline">
            <Link size={12} />
            Copy invite link
          </button>
        </div>
      );
    }
    if (game.isCheckmate) {
      const winner = game.turn === "w" ? "Black" : "White";
      return (
        <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-lg text-primary text-sm">
          <Crown size={14} />
          {winner} wins by checkmate!
        </div>
      );
    }
    if (game.isDraw || game.isStalemate) {
      return (
        <div className="flex items-center gap-2 px-4 py-2 bg-secondary/40 border border-border/40 rounded-lg text-muted-foreground text-sm">
          Draw!
        </div>
      );
    }
    if (canMove) {
      return (
        <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm">
          Your turn {game.isCheck ? "— You are in check!" : ""}
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-secondary/30 border border-border/30 rounded-lg text-muted-foreground text-sm">
        {game.isCheck ? "Opponent is in check — " : ""}Waiting for opponent's move…
      </div>
    );
  })();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-3 md:p-4 text-foreground">
      <div className="w-full max-w-7xl mx-auto flex flex-col xl:flex-row gap-4 items-start justify-center">

        {/* Board column */}
        <div className="flex-1 w-full flex flex-col gap-3 justify-center min-w-0 max-w-2xl mx-auto xl:mx-0">
          <div className="flex items-center gap-3 px-1">
            <button
              onClick={() => navigate("/lobby")}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm"
            >
              <ArrowLeft size={14} />
              Lobby
            </button>
            {statusBanner}
          </div>

          {/* Top player */}
          <div className="flex justify-between items-center px-1">
            <div className="font-semibold flex items-center gap-2 bg-secondary/40 px-3 py-1.5 rounded-full border border-border/50 shadow-md backdrop-blur-sm">
              {isBlack ? (
                <>
                  <PlayerAvatar profile={whiteProfile} size="md" showFlag={false} />
                  <div className="flex flex-col leading-tight">
                    <span className="text-sm font-bold flex items-center gap-1">
                      {whiteCountry && <span className="text-base leading-none">{whiteCountry.flag}</span>}
                      {whiteName}
                    </span>
                    <span className="text-[10px] opacity-60">White Pieces</span>
                  </div>
                </>
              ) : (
                <>
                  <PlayerAvatar profile={blackProfile} size="md" showFlag={false} />
                  <div className="flex flex-col leading-tight">
                    <span className="text-sm font-bold flex items-center gap-1">
                      {blackCountry && <span className="text-base leading-none">{blackCountry.flag}</span>}
                      {blackName}
                    </span>
                    <span className="text-[10px] opacity-60">Black Pieces</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <ChessBoard
            theme={boardThemeObj}
            pieceSet={settings.pieceSet}
            soundPack={settings.soundPack}
            showBestMove={showBestMove}
            bestMove={analysis?.bestMove}
            mouseEnabled={canMove && mouseEnabled}
            onMove={handleMove}
            handHoveredSquare={handEnabled && canMove ? handHoveredSquare : null}
            handSelectedSquare={handEnabled && canMove ? handSelectedSquare : null}
            eyeHoveredSquare={eyeEnabled && canMove ? eyeHoveredSquare : null}
            eyeSelectedSquare={eyeEnabled && canMove ? eyeSelectedSquare : null}
            externalGameState={game}
            flipped={isBlack}
          />

          {/* Bottom player */}
          <div className="flex justify-between items-center px-1">
            <div className="font-semibold flex items-center gap-2 bg-secondary/40 px-3 py-1.5 rounded-full border border-border/50 shadow-md backdrop-blur-sm">
              {isBlack ? (
                <>
                  <PlayerAvatar profile={blackProfile} size="md" showFlag={false} />
                  <div className="flex flex-col leading-tight">
                    <span className="text-sm font-bold flex items-center gap-1">
                      {blackCountry && <span className="text-base leading-none">{blackCountry.flag}</span>}
                      {blackName}
                    </span>
                    <span className="text-[10px] opacity-60">Black Pieces</span>
                  </div>
                </>
              ) : (
                <>
                  <PlayerAvatar profile={whiteProfile} size="md" showFlag={false} />
                  <div className="flex flex-col leading-tight">
                    <span className="text-sm font-bold flex items-center gap-1">
                      {whiteCountry && <span className="text-base leading-none">{whiteCountry.flag}</span>}
                      {whiteName}
                    </span>
                    <span className="text-[10px] opacity-60">White Pieces</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Input mode status bar */}
          {inputStatusBar}

          {/* Voice input (inline — no camera feed) */}
          {voiceEnabled && (
            <VoiceInput
              enabled={voiceEnabled}
              currentFen={currentFen}
              onMove={handleMove}
              isMoveLocked={() => isLocked || !canMove}
            />
          )}
        </div>

        {/* Right column: Sidebar + Chat */}
        <div className="flex flex-col gap-4 w-full xl:w-72 flex-shrink-0">
          <Sidebar
            analysis={analysis}
            isAnalyzing={isAnalyzing}
            showBestMove={showBestMove}
            onToggleBestMove={() => setShowBestMove((v) => !v)}
            gameState={game}
            hideReset
            hideRetry
            hideGameReview
            gameOverAction={gameOverAction}
          />

          {/* Chat panel */}
          <div className="bg-secondary/10 border border-border/40 rounded-xl overflow-hidden flex flex-col" style={{ height: "320px" }}>
            <GameChat
              messages={chatMessages}
              currentUserId={userId}
              onSend={handleSendMessage}
              disabled={!isPlayer}
            />
          </div>
        </div>
      </div>

      {/* Floating input windows */}
      {handEnabled && (
        <DraggableCameraWindow
          title="Hand Tracking"
          color="text-purple-400"
          onClose={() => setHandEnabled(false)}
          defaultX={20}
          defaultY={80}
        >
          <HandCursorInput
            enabled={handEnabled}
            currentFen={currentFen}
            onSquareHover={setHandHoveredSquare}
            onSquareSelect={setHandSelectedSquare}
            onMove={handleMove}
            isMoveLocked={() => isLocked || !canMove}
          />
        </DraggableCameraWindow>
      )}

      {eyeEnabled && (
        <DraggableCameraWindow
          title="Eye Tracking"
          color="text-cyan-400"
          onClose={() => setEyeEnabled(false)}
          defaultX={20}
          defaultY={80}
        >
          <EyeTrackingInput
            enabled={eyeEnabled}
            currentFen={currentFen}
            onSquareHover={setEyeHoveredSquare}
            onSquareSelect={setEyeSelectedSquare}
            onMove={handleMove}
            isMoveLocked={() => isLocked || !canMove}
          />
        </DraggableCameraWindow>
      )}
    </div>
  );
}
