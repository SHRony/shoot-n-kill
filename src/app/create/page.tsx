'use client';

import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { useRouter } from 'next/navigation';

export default function CreateRoom() {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const router = useRouter();

  useEffect(() => {
    const newSocket = io('http://localhost:3001', {
      transports: ['websocket'],
      reconnection: true
    });
    
    console.log('[CreateRoom] Connecting to server...');
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('[CreateRoom] Connected to server with socket ID:', newSocket.id);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('[CreateRoom] Disconnected from server. Reason:', reason);
    });

    return () => {
      console.log('[CreateRoom] Cleaning up socket connection');
      newSocket.close();
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.on('roomCreated', (data) => {
      console.log('[CreateRoom] Room created successfully:', data);
      // Keep socket connection alive by not closing it immediately
      setTimeout(() => {
        router.push(`/game/${data.roomId}?username=${encodeURIComponent(username)}`);
      }, 100);
    });

    socket.on('error', (message) => {
      console.error('[CreateRoom] Socket error:', message);
      setError(message);
    });

    socket.on('roomExists', (roomId) => {
      console.warn('[CreateRoom] Attempted to create existing room:', roomId);
      setError('Room already exists');
    });

    return () => {
      console.log('[CreateRoom] Removing socket event listeners');
      socket.off('roomCreated');
      socket.off('error');
      socket.off('roomExists');
    };
  }, [socket, username, router]);

  const handleCreateRoom = async () => {
    if (!socket) {
      const error = 'Connection to server failed';
      console.error('[CreateRoom]', error);
      setError(error);
      return;
    }

    if (!username.trim()) {
      const error = 'Username is required';
      console.error('[CreateRoom]', error);
      setError(error);
      return;
    }

    console.log('[CreateRoom] Attempting to create room with username:', username);
    // Fix: Send username as a string, not an object
    socket.emit('createRoom', username.trim());
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2">Create Room</h1>
          <p className="text-gray-400">Create a new game room and invite others to join</p>
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

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          <button
            onClick={handleCreateRoom}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
          >
            Create Room
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
