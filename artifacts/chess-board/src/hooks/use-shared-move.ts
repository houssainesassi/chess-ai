import { useRef, useCallback } from "react";
import { useMakeMove } from "@workspace/api-client-react";

export type MoveSource = "mouse" | "camera" | "hand" | "eye" | "voice";

const MOVE_COOLDOWN_MS = 1800;

export function useSharedMove() {
  const makeMove = useMakeMove();
  const lastMoveTimeRef = useRef<number>(0);
  const pendingRef = useRef<boolean>(false);

  const submitMove = useCallback(
    (uciMove: string, source: MoveSource): boolean => {
      const now = Date.now();
      if (pendingRef.current) return false;
      if (now - lastMoveTimeRef.current < MOVE_COOLDOWN_MS) return false;

      pendingRef.current = true;
      lastMoveTimeRef.current = now;

      makeMove.mutate(
        { data: { move: uciMove, source: "ui" } },
        {
          onSuccess: () => {
            pendingRef.current = false;
          },
          onError: () => {
            pendingRef.current = false;
            lastMoveTimeRef.current = 0;
          },
        }
      );

      return true;
    },
    [makeMove]
  );

  const isLocked = useCallback(() => {
    return pendingRef.current || Date.now() - lastMoveTimeRef.current < MOVE_COOLDOWN_MS;
  }, []);

  return { submitMove, isLocked };
}
