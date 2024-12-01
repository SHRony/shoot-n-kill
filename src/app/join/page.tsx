'use client';

import { useState } from 'react';
import { io } from 'socket.io-client';

export default function JoinRoom() {
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');
  const [error, setError] = useState('');

  const handleJoinRoom = async () => {
    if (!username.trim()) {
      setError('Username is required');
      return;
    }

    if (!roomId.trim()) {
      setError('Room ID is required');
      return;
    }

    const socket = io('http://localhost:3001');
    
    socket.on('connect', () => {
      socket.emit('joinRoom', { roomId, username });
    });

    socket.on('playerJoined', () => {
      window.location.href = `/game/${roomId}?username=${encodeURIComponent(username)}`;
    });

    socket.on('error', (message) => {
      setError(message);
    });
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
            onClick={() => window.location.href = '/'}
            className="w-full py-3 px-4 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    </main>
  );
}
