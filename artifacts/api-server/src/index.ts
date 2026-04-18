import { createServer } from "http";
import app from "./app";
import { logger } from "./lib/logger";
import { initSocketServer } from "./lib/socket-server";
import { arduinoSerial } from "./lib/arduino-serial";
import { chessEngine } from "./lib/chess-engine";
import { broadcastGameUpdate, broadcastArduinoStatus } from "./lib/socket-server";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const httpServer = createServer(app);

initSocketServer(httpServer);

arduinoSerial.onMove((move) => {
  logger.info({ move }, "Arduino move received");
  const result = chessEngine.makeMove(move);
  if (result.success) {
    broadcastGameUpdate();
  }
});

arduinoSerial.onStatusChange((connected) => {
  chessEngine.setArduinoConnected(connected);
  broadcastArduinoStatus(connected);
  broadcastGameUpdate();
});

arduinoSerial.connect().catch((err) => {
  logger.warn({ err }, "Arduino connection attempt failed");
});

httpServer.listen(port, (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
