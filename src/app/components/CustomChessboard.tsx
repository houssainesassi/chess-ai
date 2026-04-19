import { useState } from 'react';
import { Chess, Square, PieceSymbol, Color } from 'chess.js';

interface CustomChessboardProps {
  position: string;
  onPieceDrop?: (sourceSquare: Square, targetSquare: Square) => boolean;
  onSquareClick?: (square: Square) => void;
  customSquareStyles?: { [key: string]: React.CSSProperties };
  boardOrientation?: 'white' | 'black';
  arePiecesDraggable?: boolean;
}

const pieceUnicode: { [key: string]: string } = {
  wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
  bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟'
};

export function CustomChessboard({
  position,
  onPieceDrop,
  onSquareClick,
  customSquareStyles = {},
  boardOrientation = 'white',
  arePiecesDraggable = true
}: CustomChessboardProps) {
  const [draggedPiece, setDraggedPiece] = useState<{ square: Square; piece: string } | null>(null);
  const [dragOverSquare, setDragOverSquare] = useState<Square | null>(null);

  const game = new Chess(position);
  const board = game.board();

  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

  if (boardOrientation === 'black') {
    files.reverse();
    ranks.reverse();
  }

  const getSquareName = (fileIndex: number, rankIndex: number): Square => {
    return `${files[fileIndex]}${ranks[rankIndex]}` as Square;
  };

  const handleDragStart = (square: Square, piece: string) => {
    if (!arePiecesDraggable) return;
    setDraggedPiece({ square, piece });
  };

  const handleDragOver = (e: React.DragEvent, square: Square) => {
    e.preventDefault();
    setDragOverSquare(square);
  };

  const handleDrop = (e: React.DragEvent, targetSquare: Square) => {
    e.preventDefault();
    setDragOverSquare(null);

    if (draggedPiece && onPieceDrop) {
      onPieceDrop(draggedPiece.square, targetSquare);
    }
    setDraggedPiece(null);
  };

  const handleSquareClickInternal = (square: Square) => {
    if (onSquareClick) {
      onSquareClick(square);
    }
  };

  const getPiece = (square: Square) => {
    const file = square.charCodeAt(0) - 97;
    const rank = 8 - parseInt(square[1]);
    return board[rank][file];
  };

  return (
    <div className="inline-block" style={{ width: '600px', height: '600px' }}>
      <div className="grid grid-cols-8 grid-rows-8 w-full h-full border-4 border-neutral-800 rounded-xl overflow-hidden shadow-2xl">
        {ranks.map((rank, rankIndex) =>
          files.map((file, fileIndex) => {
            const square = getSquareName(fileIndex, rankIndex);
            const piece = getPiece(square);
            const isLight = (fileIndex + rankIndex) % 2 === 0;
            const squareStyle = customSquareStyles[square] || {};
            const isDragOver = dragOverSquare === square;

            return (
              <div
                key={square}
                className={`relative flex items-center justify-center cursor-pointer transition-all ${
                  isLight ? 'bg-[#edeed1]' : 'bg-[#779952]'
                } ${isDragOver ? 'ring-4 ring-green-500 ring-inset' : ''}`}
                style={squareStyle}
                onClick={() => handleSquareClickInternal(square)}
                onDragOver={(e) => handleDragOver(e, square)}
                onDrop={(e) => handleDrop(e, square)}
              >
                {/* Coordinate Labels */}
                {fileIndex === 0 && (
                  <span className={`absolute left-1 top-1 text-xs font-bold ${
                    isLight ? 'text-[#779952]' : 'text-[#edeed1]'
                  }`}>
                    {rank}
                  </span>
                )}
                {rankIndex === 7 && (
                  <span className={`absolute right-1 bottom-1 text-xs font-bold ${
                    isLight ? 'text-[#779952]' : 'text-[#edeed1]'
                  }`}>
                    {file}
                  </span>
                )}

                {/* Chess Piece */}
                {piece && (
                  <div
                    className={`text-6xl select-none ${
                      arePiecesDraggable ? 'cursor-grab active:cursor-grabbing' : ''
                    } ${draggedPiece?.square === square ? 'opacity-50' : ''}`}
                    draggable={arePiecesDraggable}
                    onDragStart={() => handleDragStart(square, `${piece.color}${piece.type.toUpperCase()}`)}
                  >
                    {pieceUnicode[`${piece.color}${piece.type.toUpperCase()}`]}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
