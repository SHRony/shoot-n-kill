'use client';

import { useRouter } from 'next/navigation';

export default function GameMenu() {
  const router = useRouter();

  return (
    <div className="bg-gray-900 p-8 rounded-lg shadow-lg max-w-md mx-auto">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4">Shoot 'n Kill</h1>
        <p className="text-gray-400 mb-8">A multiplayer shooter game</p>
      </div>
      
      <div className="space-y-4">
        <button
          onClick={() => router.push('/create')}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
        >
          Create Room
        </button>
        
        <button
          onClick={() => router.push('/join')}
          className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
        >
          Join Room
        </button>
      </div>
    </div>
  );
}
