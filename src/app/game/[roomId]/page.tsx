'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSearchParams } from 'next/navigation';
import GameCanvas from '@/components/GameCanvas';
import { Player, Vector2D } from '@/types/game';

export default function GameRoom({ params }: { params: { roomId: string } }) {
  const searchParams = useSearchParams();
  const username = searchParams.get('username');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [isCreator, setIsCreator] = useState(false);

  useEffect(() => {
    if (!username) {
      window.location.href = '/';
      return;
    }

    const newSocket = io('http://localhost:3001');
    setSocket(newSocket);

    newSocket.on('connect', () => {
      if (window.location.pathname.includes('/create')) {
        newSocket.emit('createRoom', username);
      } else {
        newSocket.emit('joinRoom', { roomId: params.roomId, username });
      }
    });

    newSocket.on('roomCreated', ({ playerId }) => {
      setIsCreator(true);
    });

    newSocket.on('playerJoined', (updatedPlayers: Player[]) => {
      setPlayers(updatedPlayers);
    });

    newSocket.on('playerLeft', (playerId: string) => {
      setPlayers(prev => prev.filter(p => p.id !== playerId));
    });

    newSocket.on('gameStarted', () => {
      setGameStarted(true);
    });

    newSocket.on('playerMoved', ({ id, position, rotation }: { id: string, position: Vector2D, rotation: number }) => {
      setPlayers(prev => prev.map(p => {
        if (p.id === id) {
          return { ...p, position, rotation };
        }
        return p;
      }));
    });

    return () => {
      newSocket.close();
    };
  }, [username, params.roomId]);

  const handleUpdatePlayer = (position: Vector2D, rotation: number) => {
    if (socket) {
      socket.emit('updatePlayer', {
        roomId: params.roomId,
        position,
        rotation
      });
    }
  };

  const handleShoot = (position: Vector2D, angle: number) => {
    if (socket) {
      socket.emit('shoot', {
        roomId: params.roomId,
        position,
        angle
      });
    }
  };

  if (!gameStarted) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-2">Game Lobby</h1>
            <p className="text-gray-400">Room ID: {params.roomId}</p>
          </div>

          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-4">Players</h2>
            <ul className="space-y-2">
              {players.map(player => (
                <li key={player.id} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span>{player.username}</span>
                  {isCreator && player.id === socket?.id && <span className="text-sm text-gray-400">(Host)</span>}
                </li>
              ))}
            </ul>
          </div>

          {isCreator && (
            <button
              onClick={() => socket?.emit('startGame', params.roomId)}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
              disabled={players.length < 2}
            >
              {players.length < 2 ? 'Waiting for players...' : 'Start Game'}
            </button>
          )}

          <button
            onClick={() => window.location.href = '/'}
            className="w-full py-3 px-4 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
          >
            Leave Room
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-900 p-4">
      {socket && (
        <GameCanvas
          players={players}
          currentPlayerId={socket.id}
          onUpdatePlayer={handleUpdatePlayer}
          onShoot={handleShoot}
        />
      )}
    </main>
  );
}
