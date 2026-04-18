import { ChessEngine } from "./chess-engine";

class GameRoomManager {
  private rooms = new Map<string, ChessEngine>();

  getOrCreate(gameId: string, initialFen?: string, initialPgn?: string): ChessEngine {
    if (!this.rooms.has(gameId)) {
      const engine = new ChessEngine(initialFen, initialPgn);
      this.rooms.set(gameId, engine);
    }
    return this.rooms.get(gameId)!;
  }

  get(gameId: string): ChessEngine | undefined {
    return this.rooms.get(gameId);
  }

  remove(gameId: string): void {
    this.rooms.delete(gameId);
  }

  has(gameId: string): boolean {
    return this.rooms.has(gameId);
  }
}

export const gameRoomManager = new GameRoomManager();
