import { Chess } from "chess.js";
import { logger } from "./logger";

export interface MoveEntry {
  from: string;
  to: string;
  san: string;
  piece: string;
  color: "w" | "b";
  captured?: string | null;
  promotion?: string | null;
  moveNumber: number;
}

export interface CapturedPieces {
  white: string[];
  black: string[];
}

export interface LastMove {
  from: string;
  to: string;
}

export interface GameState {
  fen: string;
  turn: "w" | "b";
  moveHistory: MoveEntry[];
  capturedPieces: CapturedPieces;
  isCheck: boolean;
  isCheckmate: boolean;
  isDraw: boolean;
  isStalemate: boolean;
  isGameOver: boolean;
  lastMove: LastMove | null;
  arduinoConnected: boolean;
}

export class ChessEngine {
  private chess: Chess;
  private moveHistory: MoveEntry[] = [];
  private capturedPieces: CapturedPieces = { white: [], black: [] };
  private lastMove: LastMove | null = null;
  private arduinoConnected = false;

  constructor(initialFen?: string, initialPgn?: string) {
    this.chess = new Chess();
    if (initialPgn) {
      try {
        this.chess.loadPgn(initialPgn);
        const history = this.chess.history({ verbose: true });
        let moveNum = 1;
        for (const m of history) {
          this.moveHistory.push({
            from: m.from,
            to: m.to,
            san: m.san,
            piece: m.piece,
            color: m.color as "w" | "b",
            captured: m.captured ?? null,
            promotion: m.promotion ?? null,
            moveNumber: Math.ceil(moveNum / 2),
          });
          if (m.captured) {
            const sym = this.pieceToSymbol(m.captured, m.color === "w" ? "b" : "w");
            if (m.color === "w") this.capturedPieces.white.push(sym);
            else this.capturedPieces.black.push(sym);
          }
          if (moveNum === history.length) {
            this.lastMove = { from: m.from, to: m.to };
          }
          moveNum++;
        }
      } catch {
        if (initialFen) this.chess = new Chess(initialFen);
      }
    } else if (initialFen) {
      this.chess = new Chess(initialFen);
    }
  }

  getPgn(): string {
    return this.chess.pgn();
  }

  getState(): GameState {
    return {
      fen: this.chess.fen(),
      turn: this.chess.turn() as "w" | "b",
      moveHistory: [...this.moveHistory],
      capturedPieces: {
        white: [...this.capturedPieces.white],
        black: [...this.capturedPieces.black],
      },
      isCheck: this.chess.inCheck(),
      isCheckmate: this.chess.isCheckmate(),
      isDraw: this.chess.isDraw(),
      isStalemate: this.chess.isStalemate(),
      isGameOver: this.chess.isGameOver(),
      lastMove: this.lastMove,
      arduinoConnected: this.arduinoConnected,
    };
  }

  makeMove(moveStr: string): { success: boolean; move?: MoveEntry; error?: string } {
    try {
      const moveNumber = Math.ceil((this.moveHistory.length + 1) / 2);

      let result;

      if (moveStr.length === 4 || moveStr.length === 5) {
        const from = moveStr.slice(0, 2);
        const to = moveStr.slice(2, 4);
        const promotion = moveStr.length === 5 ? moveStr[4] : undefined;
        result = this.chess.move({ from, to, promotion });
      } else {
        result = this.chess.move(moveStr);
      }

      if (!result) {
        return { success: false, error: "Invalid move" };
      }

      const entry: MoveEntry = {
        from: result.from,
        to: result.to,
        san: result.san,
        piece: result.piece,
        color: result.color as "w" | "b",
        captured: result.captured ?? null,
        promotion: result.promotion ?? null,
        moveNumber,
      };

      this.moveHistory.push(entry);
      this.lastMove = { from: result.from, to: result.to };

      if (result.captured) {
        const capturedSymbol = this.pieceToSymbol(result.captured, result.color === "w" ? "b" : "w");
        if (result.color === "w") {
          this.capturedPieces.white.push(capturedSymbol);
        } else {
          this.capturedPieces.black.push(capturedSymbol);
        }
      }

      logger.info({ move: entry }, "Move made");
      return { success: true, move: entry };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      logger.warn({ moveStr, message }, "Invalid move attempted");
      return { success: false, error: message };
    }
  }

  getLegalMoves(square: string): string[] {
    const moves = this.chess.moves({ square: square as any, verbose: true });
    return moves.map((m: any) => m.to);
  }

  reset(): void {
    this.chess = new Chess();
    this.moveHistory = [];
    this.capturedPieces = { white: [], black: [] };
    this.lastMove = null;
    logger.info("Game reset");
  }

  undoLastMove(): { success: boolean; error?: string } {
    const undone = this.chess.undo();
    if (!undone) {
      return { success: false, error: "No move to retry" };
    }

    const removed = this.moveHistory.pop();
    if (removed?.captured) {
      if (removed.color === "w") this.capturedPieces.white.pop();
      else this.capturedPieces.black.pop();
    }

    const previous = this.moveHistory[this.moveHistory.length - 1];
    this.lastMove = previous ? { from: previous.from, to: previous.to } : null;
    logger.info({ move: removed }, "Move undone");
    return { success: true };
  }

  setArduinoConnected(connected: boolean): void {
    this.arduinoConnected = connected;
  }

  isArduinoConnected(): boolean {
    return this.arduinoConnected;
  }

  private pieceToSymbol(piece: string, color: "w" | "b"): string {
    const symbols: Record<string, Record<string, string>> = {
      w: { p: "♙", n: "♘", b: "♗", r: "♖", q: "♕", k: "♔" },
      b: { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚" },
    };
    return symbols[color]?.[piece] ?? piece;
  }
}

export const chessEngine = new ChessEngine();
