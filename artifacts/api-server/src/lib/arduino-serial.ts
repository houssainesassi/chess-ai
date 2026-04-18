import { logger } from "./logger";

type MoveCallback = (move: string) => void;
type StatusCallback = (connected: boolean) => void;

class ArduinoSerial {
  private port: any = null;
  private parser: any = null;
  private moveCallbacks: MoveCallback[] = [];
  private statusCallbacks: StatusCallback[] = [];
  private buffer = "";

  onMove(cb: MoveCallback): void {
    this.moveCallbacks.push(cb);
  }

  onStatusChange(cb: StatusCallback): void {
    this.statusCallbacks.push(cb);
  }

  async connect(portPath?: string): Promise<boolean> {
    try {
      const { SerialPort } = await import("serialport");
      const { ReadlineParser } = await import("@serialport/parser-readline");

      const targetPort = portPath ?? (await this.detectArduinoPort());

      if (!targetPort) {
        logger.info("No Arduino serial port found");
        return false;
      }

      this.port = new SerialPort({
        path: targetPort,
        baudRate: 9600,
      });

      this.parser = this.port.pipe(new ReadlineParser({ delimiter: "\n" }));

      this.parser.on("data", (line: string) => {
        const trimmed = line.trim();
        logger.info({ data: trimmed }, "Arduino data received");

        if (/^[a-h][1-8][a-h][1-8][qrbn]?$/i.test(trimmed)) {
          this.moveCallbacks.forEach((cb) => cb(trimmed.toLowerCase()));
        }
      });

      this.port.on("open", () => {
        logger.info({ port: targetPort }, "Arduino connected");
        this.statusCallbacks.forEach((cb) => cb(true));
      });

      this.port.on("close", () => {
        logger.info("Arduino disconnected");
        this.statusCallbacks.forEach((cb) => cb(false));
        this.port = null;
        setTimeout(() => this.connect(portPath), 5000);
      });

      this.port.on("error", (err: Error) => {
        logger.warn({ err: err.message }, "Arduino serial error");
        this.statusCallbacks.forEach((cb) => cb(false));
      });

      return true;
    } catch (err) {
      logger.warn({ err: err instanceof Error ? err.message : err }, "Could not connect to Arduino (serialport not available or port not found)");
      return false;
    }
  }

  private async detectArduinoPort(): Promise<string | null> {
    try {
      const { SerialPort } = await import("serialport");
      const ports = await SerialPort.list();

      const arduino = ports.find(
        (p) =>
          p.manufacturer?.toLowerCase().includes("arduino") ||
          p.pnpId?.toLowerCase().includes("arduino") ||
          p.path.includes("ttyUSB") ||
          p.path.includes("ttyACM") ||
          p.path.includes("cu.usbmodem") ||
          p.path.includes("cu.usbserial"),
      );

      return arduino?.path ?? null;
    } catch {
      return null;
    }
  }

  isConnected(): boolean {
    return this.port !== null && this.port.isOpen;
  }
}

export const arduinoSerial = new ArduinoSerial();
