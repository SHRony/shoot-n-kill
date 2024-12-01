'use client';

import { Socket } from 'socket.io-client';
import { useCallback } from 'react';

interface GameControlsProps {
  isCreator: boolean;
  players: any[];
  socket: Socket | null;
  roomId: string;
}

export default function GameControls({ isCreator, players, socket, roomId }: GameControlsProps) {
  const handleStartGame = useCallback(() => {
    socket?.emit('startGame', roomId);
  }, [socket, roomId]);

  const handleLeaveRoom = useCallback(() => {
    window.location.href = '/';
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {isCreator && (
        <button
          onClick={handleStartGame}
          className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
          disabled={players.length < 2}
        >
          {players.length < 2 ? 'Waiting for players...' : 'Start Game'}
        </button>
      )}

      <button
        onClick={handleLeaveRoom}
        className="w-full py-3 px-4 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
      >
        Leave Room
      </button>
    </div>
  );
}
