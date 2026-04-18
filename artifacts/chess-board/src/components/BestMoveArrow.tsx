interface BestMoveArrowProps {
  bestMove: string;
  boardSize: number;
  flipped?: boolean;
}

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];

function squareToCoords(square: string, boardSize: number, flipped: boolean): { x: number; y: number } {
  const file = square[0];
  const rank = square[1];
  const col = flipped ? 7 - FILES.indexOf(file) : FILES.indexOf(file);
  const row = flipped ? 7 - RANKS.indexOf(rank) : RANKS.indexOf(rank);
  const cellSize = boardSize / 8;
  return {
    x: col * cellSize + cellSize / 2,
    y: row * cellSize + cellSize / 2,
  };
}

export function BestMoveArrow({ bestMove, boardSize, flipped = false }: BestMoveArrowProps) {
  if (!bestMove || bestMove.length < 4) return null;

  const from = bestMove.slice(0, 2);
  const to = bestMove.slice(2, 4);

  const fromCoords = squareToCoords(from, boardSize, flipped);
  const toCoords = squareToCoords(to, boardSize, flipped);

  const dx = toCoords.x - fromCoords.x;
  const dy = toCoords.y - fromCoords.y;
  const length = Math.sqrt(dx * dx + dy * dy);

  const arrowHeadSize = 12;
  const shortenBy = arrowHeadSize + 4;

  const unitX = dx / length;
  const unitY = dy / length;

  const lineEndX = toCoords.x - unitX * shortenBy;
  const lineEndY = toCoords.y - unitY * shortenBy;

  const arrowId = `arrow-${from}-${to}`;

  return (
    <svg
      className="absolute inset-0 pointer-events-none z-30"
      width={boardSize}
      height={boardSize}
      style={{ position: "absolute", top: 0, left: 0 }}
    >
      <defs>
        <marker
          id={arrowId}
          markerWidth="4"
          markerHeight="4"
          refX="2"
          refY="2"
          orient="auto"
        >
          <path d="M0,0 L4,2 L0,4 Z" fill="rgba(0,180,100,0.85)" />
        </marker>
      </defs>
      <line
        x1={fromCoords.x}
        y1={fromCoords.y}
        x2={lineEndX}
        y2={lineEndY}
        stroke="rgba(0,180,100,0.85)"
        strokeWidth="6"
        strokeLinecap="round"
        markerEnd={`url(#${arrowId})`}
        opacity="0.9"
      />
      <circle
        cx={fromCoords.x}
        cy={fromCoords.y}
        r="8"
        fill="rgba(0,180,100,0.3)"
        stroke="rgba(0,180,100,0.7)"
        strokeWidth="2"
      />
    </svg>
  );
}
