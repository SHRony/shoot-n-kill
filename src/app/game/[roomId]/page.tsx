'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSearchParams } from 'next/navigation';
import { Player, Projectile, Vector2D } from '@/types/game';
import GameCanvas from '@/components/client/GameCanvas';
import GameLobby from '@/components/client/GameLobby';

export default function Game({ params }: { params: { roomId: string } }) {
  const searchParams = useSearchParams();
  const username = searchParams.get('username');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPlayerId, setCurrentPlayerId] = useState<string>('');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [roomId, setRoomId] = useState<string>(params.roomId);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    if (!username) {
      window.location.href = '/';
      return;
    }

    if (isConnecting) return;
    setIsConnecting(true);

    const newSocket = io('http://localhost:3001', {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    setSocket(newSocket);

    const handleConnect = () => {
      console.log('[Game] Connected to server');
      if (params.roomId === 'create' && !isCreatingRoom) {
        console.log('[Game] Creating new room');
        setIsCreatingRoom(true);
        newSocket.emit('createRoom', username);
      } else if (params.roomId !== 'create') {
        console.log('[Game] Joining room:', params.roomId);
        setRoomId(params.roomId);
        newSocket.emit('joinRoom', { roomId: params.roomId, username });
      }
    };

    const handleRoomCreated = ({ roomId: newRoomId, playerId, isCreator }: { roomId: string, playerId: string, isCreator: boolean }) => {
      console.log('[Game] Room created:', { roomId: newRoomId, playerId, isCreator });
      setCurrentPlayerId(playerId);
      setIsCreator(isCreator);
      setRoomId(newRoomId);
      
      if (typeof window !== 'undefined' && window.history) {
        const newUrl = `/game/${newRoomId}?username=${encodeURIComponent(username || '')}`;
        window.history.replaceState({ roomId: newRoomId }, '', newUrl);
      }
    };

    const handleRoomJoined = ({ playerId, players: roomPlayers, isCreator }: { playerId: string, players: Player[], isCreator: boolean }) => {
      console.log('[Game] Joined room:', { playerId, players: roomPlayers, isCreator });
      setCurrentPlayerId(playerId);
      setPlayers(roomPlayers);
      setIsCreator(isCreator);
      setIsCreatingRoom(false);
      
      if (typeof window !== 'undefined' && window.history) {
        const newUrl = `/game/${roomId}?username=${encodeURIComponent(username || '')}`;
        window.history.replaceState({ roomId }, '', newUrl);
      }
    };

    const handleError = (error: string) => {
      console.error('[Game] Error:', error);
      setError(error);
      if (error === 'Room not found' && !isCreatingRoom) {
        // Redirect to home if room not found and we're not in the process of creating one
        window.location.href = '/?error=' + encodeURIComponent(error);
      }
    };

    newSocket.on('connect', handleConnect);
    newSocket.on('disconnect', () => {
      console.log('[Game] Disconnected from server');
      setIsConnecting(false);
    });
    newSocket.on('reconnect', () => {
      console.log('[Game] Reconnected to server');
      if (params.roomId !== 'create') {
        newSocket.emit('joinRoom', { roomId: params.roomId, username });
      }
    });
    newSocket.on('roomCreated', handleRoomCreated);
    newSocket.on('roomJoined', handleRoomJoined);
    newSocket.on('error', handleError);
    newSocket.on('playerJoined', (player: Player) => {
      console.log('[Game] Player joined:', player);
      setPlayers(prev => [...prev, player]);
    });
    newSocket.on('playerLeft', (playerId: string) => {
      console.log('[Game] Player left:', playerId);
      setPlayers(prev => prev.filter(p => p.id !== playerId));
    });
    newSocket.on('playerUpdated', ({ id, position, rotation }: { id: string, position: Vector2D, rotation: number }) => {
      console.log('[Game] Player updated:', { id, position, rotation });
      setPlayers(prev => prev.map(player => 
        player.id === id 
          ? { ...player, position, rotation }
          : player
      ));
    });
    newSocket.on('projectileCreated', (projectile: Projectile) => {
      setProjectiles(prev => [...prev, projectile]);
    });

    newSocket.on('projectileUpdated', (updatedProjectiles: Projectile[]) => {
      setProjectiles(updatedProjectiles);
    });

    newSocket.on('projectileRemoved', (projectileId: string) => {
      setProjectiles(prev => prev.filter(p => p.id !== projectileId));
    });

    newSocket.on('gameStarted', () => setGameStarted(true));

    return () => {
      console.log('[Game] Cleaning up socket connection');
      newSocket.off('connect');
      newSocket.off('disconnect');
      newSocket.off('reconnect');
      newSocket.off('roomCreated');
      newSocket.off('roomJoined');
      newSocket.off('error');
      newSocket.off('playerJoined');
      newSocket.off('playerLeft');
      newSocket.off('playerUpdated');
      newSocket.off('projectileCreated');
      newSocket.off('projectileUpdated');
      newSocket.off('projectileRemoved');
      newSocket.off('gameStarted');
      newSocket.close();
    };
  }, [username, params.roomId, isCreatingRoom]);

  if (!username) {
    return null;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="bg-red-500 p-4 rounded shadow">
          Error: {error}
        </div>
      </div>
    );
  }

  return gameStarted ? (
    <GameCanvas
      socket={socket}
      players={players}
      projectiles={projectiles}
      roomId={roomId}
      currentPlayerId={currentPlayerId}
      onUpdatePlayer={(position, rotation) => {
        socket?.emit('updatePlayer', { roomId, position, rotation });
      }}
      onShoot={(position, angle) => {
        socket?.emit('shoot', { roomId, position, angle });
      }}
    />
  ) : (
    <GameLobby
      roomId={roomId}
      socket={socket}
      username={username}
      players={players}
      isCreator={isCreator}
    />
  );
}
