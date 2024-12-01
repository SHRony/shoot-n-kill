'use client';

import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { useRouter } from 'next/navigation';

export default function JoinRoom() {
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');
  const [error, setError] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const router = useRouter();

  useEffect(() => {
    const newSocket = io('http://localhost:3001', {
      transports: ['websocket'],
      reconnection: true
    });
    
    console.log('[JoinRoom] Connecting to server...');
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('[JoinRoom] Connected to server with socket ID:', newSocket.id);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('[JoinRoom] Disconnected from server. Reason:', reason);
    });

    return () => {
      console.log('[JoinRoom] Cleaning up socket connection');
      newSocket.close();
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleError = (message: string) => {
      console.error('[JoinRoom] Socket error:', message);
      setError(message);
    };

    socket.on('error', handleError);
    socket.on('roomNotFound', () => handleError('Room not found'));
    socket.on('roomFull', () => handleError('Room is full'));

    return () => {
      socket.off('error');
      socket.off('roomNotFound');
      socket.off('roomFull');
    };
  }, [socket]);

  const handleJoinRoom = async () => {
    if (!socket) {
      setError('Connection to server failed');
      return;
    }

    if (!username.trim()) {
      setError('Username is required');
      return;
    }

    if (!roomId.trim()) {
      setError('Room ID is required');
      return;
    }

    const trimmedRoomId = roomId.trim();
    const trimmedUsername = username.trim();

    console.log('[JoinRoom] Attempting to join room:', trimmedRoomId, 'with username:', trimmedUsername);
    
    try {
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          socket.off('roomJoined');
          setError('Connection timeout - please try again');
          resolve();
        }, 5000);

        socket.once('roomJoined', () => {
          clearTimeout(timeout);
          console.log('[JoinRoom] Successfully joined room. Redirecting...');
          router.push(`/game/${trimmedRoomId}?username=${encodeURIComponent(trimmedUsername)}`);
          resolve();
        });

        socket.emit('joinRoom', { 
          roomId: trimmedRoomId, 
          username: trimmedUsername 
        });
      });
    } catch (error) {
      console.error('[JoinRoom] Error joining room:', error);
      setError('Failed to join room - please try again');
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2">Join Room</h1>
          <p className="text-gray-400">Enter your details to join an existing game room</p>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-400 mb-1">
              Username
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your username"
            />
          </div>

          <div>
            <label htmlFor="roomId" className="block text-sm font-medium text-gray-400 mb-1">
              Room ID
            </label>
            <input
              type="text"
              id="roomId"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter room ID"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          <button
            onClick={handleJoinRoom}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
          >
            Join Room
          </button>

          <button
            onClick={() => router.push('/')}
            className="w-full py-3 px-4 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    </main>
  );
}
