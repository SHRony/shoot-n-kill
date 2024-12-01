'use client';

import { Socket } from 'socket.io-client';
import { Player } from '@/types/game';
import { useState, useEffect } from 'react';
import GameControls from './GameControls';

interface GameLobbyProps {
  roomId: string;
  socket: Socket | null;
  username: string;
  players: Player[];
  isCreator: boolean;
}

export default function GameLobby({ roomId, socket, username, players, isCreator }: GameLobbyProps) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!socket) return;

    socket.on('error', (error: string) => {
      setError(error);
    });

    return () => {
      socket.off('error');
    };
  }, [socket]);

  const handleStartGame = () => {
    if (socket) {
      socket.emit('startGame', roomId);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="flex flex-col items-center space-y-4 p-4">
          <h2 className="text-xl font-bold">Game Lobby</h2>
          <div className="flex items-center space-x-2">
            <span>Room ID: {roomId}</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(roomId);
              }}
              className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
            >
              Copy
            </button>
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg shadow-lg w-full max-w-md">
          <h3 className="text-lg font-semibold mb-4">Players:</h3>
          <ul className="space-y-2">
            {players.map(player => (
              <li key={player.id} className="flex items-center justify-between">
                <span>{player.username}</span>
                {player.isCreator && (
                  <span className="text-sm text-gray-400">(Creator)</span>
                )}
              </li>
            ))}
          </ul>
        </div>

        {error && (
          <div className="bg-red-500 text-white p-2 rounded">
            {error}
          </div>
        )}

        {isCreator && (
          <button
            onClick={handleStartGame}
            disabled={players.length < 2}
            className={`w-full py-2 px-4 rounded ${
              players.length < 2
                ? 'bg-gray-500 cursor-not-allowed'
                : 'bg-green-500 hover:bg-green-600'
            }`}
          >
            {players.length < 2 ? 'Waiting for Players...' : 'Start Game'}
          </button>
        )}
      </div>
    </main>
  );
}
