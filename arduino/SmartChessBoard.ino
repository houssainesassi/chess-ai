/*
 * Smart Chess Board - Arduino Firmware
 * =====================================
 * Hardware:
 *   - Arduino Uno
 *   - 8x 74HC4051 Multiplexers (one per row)
 *   - 64x Reed switches (one per square, normally open)
 *   - Magnets embedded under each chess piece
 *
 * Wiring:
 *   74HC4051 Control pins (shared across all 8 muxes):
 *     S0 -> Arduino Pin 2
 *     S1 -> Arduino Pin 3
 *     S2 -> Arduino Pin 4
 *
 *   74HC4051 Enable pins (one per row, active LOW):
 *     Row A (rank 1) EN -> Arduino Pin 5
 *     Row B (rank 2) EN -> Arduino Pin 6
 *     Row C (rank 3) EN -> Arduino Pin 7
 *     Row D (rank 4) EN -> Arduino Pin 8
 *     Row E (rank 5) EN -> Arduino Pin 9
 *     Row F (rank 6) EN -> Arduino Pin 10
 *     Row G (rank 7) EN -> Arduino Pin 11
 *     Row H (rank 8) EN -> Arduino Pin 12
 *
 *   74HC4051 SIG (signal/output) -> Arduino A0 (all muxes share analog input)
 *
 *   Reed switches connect: GND <-> MUX_SIG
 *   A 10k pullup resistor on A0 ensures HIGH when no magnet present
 *
 * Protocol:
 *   Moves are sent as UCI strings over Serial at 9600 baud: e.g. "e2e4\n"
 */

// ---- Pin Definitions ----
const int MUX_S0 = 2;
const int MUX_S1 = 3;
const int MUX_S2 = 4;

const int ROW_EN[8] = {5, 6, 7, 8, 9, 10, 11, 12};

const int MUX_SIG = A0;

// ---- Board State ----
bool currentState[8][8];
bool previousState[8][8];
bool initialized = false;

// ---- Timing ----
const unsigned long DEBOUNCE_DELAY = 50;
const unsigned long SCAN_INTERVAL = 30;
unsigned long lastScan = 0;

// ---- Move Detection State Machine ----
String liftedSquare = "";
bool pieceLifted = false;

void setup() {
  Serial.begin(9600);

  // Set mux select pins as output
  pinMode(MUX_S0, OUTPUT);
  pinMode(MUX_S1, OUTPUT);
  pinMode(MUX_S2, OUTPUT);

  // Set all row enable pins as output, start disabled (HIGH = disabled for active-low EN)
  for (int i = 0; i < 8; i++) {
    pinMode(ROW_EN[i], OUTPUT);
    digitalWrite(ROW_EN[i], HIGH);
  }

  // Internal pullup on analog input
  pinMode(MUX_SIG, INPUT_PULLUP);

  // Initial board scan
  scanBoard(currentState);
  copyBoard(currentState, previousState);
  initialized = true;

  Serial.println("READY");
}

void loop() {
  unsigned long now = millis();
  if (now - lastScan < SCAN_INTERVAL) return;
  lastScan = now;

  scanBoard(currentState);
  detectMoves();
  copyBoard(currentState, previousState);
}

// ---- Scan all 64 squares ----
void scanBoard(bool state[8][8]) {
  for (int row = 0; row < 8; row++) {
    // Enable this row's mux
    digitalWrite(ROW_EN[row], LOW);
    delayMicroseconds(10);

    for (int col = 0; col < 8; col++) {
      // Set mux channel (col 0-7 maps to MUX channels 0-7)
      digitalWrite(MUX_S0, (col >> 0) & 1);
      digitalWrite(MUX_S1, (col >> 1) & 1);
      digitalWrite(MUX_S2, (col >> 2) & 1);
      delayMicroseconds(20);

      // Read: LOW = magnet present (piece on square), HIGH = empty
      int reading = analogRead(MUX_SIG);
      state[row][col] = (reading < 512); // LOW when magnet near reed switch
    }

    // Disable this row's mux
    digitalWrite(ROW_EN[row], HIGH);
  }
}

// ---- Detect and report moves ----
void detectMoves() {
  String lifted = "";
  String placed = "";

  for (int row = 0; row < 8; row++) {
    for (int col = 0; col < 8; col++) {
      bool wasOccupied = previousState[row][col];
      bool isOccupied = currentState[row][col];

      if (wasOccupied && !isOccupied) {
        lifted = squareName(col, row);
      } else if (!wasOccupied && isOccupied) {
        placed = squareName(col, row);
      }
    }
  }

  // State machine: detect lift then place
  if (lifted.length() > 0 && !pieceLifted) {
    liftedSquare = lifted;
    pieceLifted = true;
  }

  if (pieceLifted && placed.length() > 0) {
    // A piece was moved from liftedSquare to placed
    String move = liftedSquare + placed;
    Serial.println(move);
    pieceLifted = false;
    liftedSquare = "";
  }

  // Handle captures: opponent piece is lifted simultaneously
  if (lifted.length() > 0 && placed.length() > 0 && lifted != placed) {
    // Both lift and place happened in same scan: could be a capture
    // The piece that was lifted without being the "active" piece is the captured one
    if (!pieceLifted) {
      String move = lifted + placed;
      Serial.println(move);
    }
  }
}

// ---- Convert grid position to chess square name ----
String squareName(int col, int row) {
  // col 0=a, 1=b, ..., 7=h
  // row 0=rank1 (bottom), 7=rank8 (top)
  char file = 'a' + col;
  char rank = '1' + row;
  String s = "";
  s += file;
  s += rank;
  return s;
}

void copyBoard(bool src[8][8], bool dst[8][8]) {
  for (int r = 0; r < 8; r++) {
    for (int c = 0; c < 8; c++) {
      dst[r][c] = src[r][c];
    }
  }
}
