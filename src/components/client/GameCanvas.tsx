'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Player, Vector2D, Projectile, Socket } from '@/types/game';
import {
  PLAYER_RADIUS,
  PROJECTILE_RADIUS,
  PLAYER_SPEED,
  MAP_WIDTH,
  MAP_HEIGHT,
  FIRE_RATE,
  movePlayer,
  calculateGunPosition,
  vectorAdd,
  vectorMultiply,
  vectorNormalize
} from '@/game/engine';

const MOVEMENT_THRESHOLD = 0.1;

interface GameCanvasProps {
  socket: Socket;
  players: Player[];
  projectiles: Projectile[];
  roomId: string;
  currentPlayerId: string;
  onUpdatePlayer: (position: Vector2D, rotation: number) => void;
  onShoot: (position: Vector2D, angle: number) => void;
}

export default function GameCanvas({ 
  socket, 
  players, 
  projectiles = [], 
  roomId, 
  currentPlayerId, 
  onUpdatePlayer, 
  onShoot 
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keysPressed = useRef<Set<string>>(new Set());
  const mousePosition = useRef<Vector2D>({ x: 0, y: 0 });
  const shooting = useRef(false);
  const lastShot = useRef(0);
  const projectilesRef = useRef<Projectile[]>([]);
  const lastUpdateTime = useRef(0);
  const previousState = useRef<{ position: Vector2D; rotation: number } | null>(null);
  const playersRef = useRef<Player[]>(players);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<string>('');

  // Helper function to check if enough time has passed since last update
  const canUpdate = useCallback(() => {
    const now = performance.now();
    const timeSinceLastUpdate = now - lastUpdateTime.current;
    if (timeSinceLastUpdate > 50) {  // 20 updates per second
      lastUpdateTime.current = now;
      return true;
    }
    return false;
  }, []);

  // Helper function to check if state has changed significantly
  const hasStateChanged = useCallback((newPos: Vector2D, newRot: number) => {
    if (!previousState.current) return true;
    
    const posChanged = Math.abs(newPos.x - previousState.current.position.x) > 1 ||
                      Math.abs(newPos.y - previousState.current.position.y) > 1;
    const rotChanged = Math.abs(newRot - previousState.current.rotation) > 0.1;
    
    return posChanged || rotChanged;
  }, []);

  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas size
    canvas.width = MAP_WIDTH;
    canvas.height = MAP_HEIGHT;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Listen for player updates
    socket.on('playerUpdated', ({ playerId, position, rotation, health }: { 
      playerId: string, 
      position?: Vector2D, 
      rotation?: number, 
      health?: number 
    }) => {
      // Ignore position/rotation updates for our own player (we handle these locally)
      if (playerId === currentPlayerId && !health) {
        return;
      }

      // Find the player to update
      const playerIndex = playersRef.current.findIndex(p => p.id === playerId);
      if (playerIndex === -1) return;

      // Create updated player object
      const updatedPlayer = { ...playersRef.current[playerIndex] };
      let hasChanges = false;

      // Only apply position/rotation updates for other players
      if (playerId !== currentPlayerId) {
        if (position) {
          updatedPlayer.position = position;
          hasChanges = true;
        }
        if (typeof rotation === 'number') {
          updatedPlayer.rotation = rotation;
          hasChanges = true;
        }
      }

      // Always apply health updates
      if (typeof health === 'number') {
        updatedPlayer.health = health;
        hasChanges = true;
      }

      if (hasChanges) {
        const updatedPlayers = [...playersRef.current];
        updatedPlayers[playerIndex] = updatedPlayer;
        playersRef.current = updatedPlayers;

        // Only call onUpdatePlayer for health changes to our own player
        if (playerId === currentPlayerId && typeof health === 'number') {
          onUpdatePlayer(updatedPlayer.position, updatedPlayer.rotation);
        }
      }
    });

    // Listen for player death
    socket.on('playerDied', ({ playerId, killerUsername }: { playerId: string, killerUsername: string }) => {
      console.log('Player died:', { playerId, killerUsername });
      if (playerId === currentPlayerId) {
        setGameOver(true);
        setWinner(killerUsername);
      }
    });

    // Listen for game over
    socket.on('gameOver', ({ winnerUsername, winnerId }: { winnerUsername: string, winnerId: string }) => {
      console.log('Game over:', { winnerUsername, winnerId });
      setGameOver(true);
      setWinner(winnerUsername);
    });

    // Listen for projectile hits
    socket.on('projectileHit', ({ projectileId, playerId, damage }: { projectileId: string; playerId?: string; damage?: number }) => {
      console.log('Projectile hit:', { projectileId, playerId, damage });
      projectilesRef.current = projectilesRef.current.filter(p => p.id !== projectileId);
    });

    // Listen for projectile updates
    socket.on('projectilesUpdate', (updatedProjectiles: Projectile[]) => {
      console.log('Received projectile update:', updatedProjectiles);
      projectilesRef.current = updatedProjectiles;
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keysPressed.current.add(key);
      if (key === ' ') {
        shooting.current = true;
        console.log('Space pressed - shooting enabled');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keysPressed.current.delete(key);
      if (key === ' ') {
        shooting.current = false;
        lastShot.current = 0; // Reset last shot time when releasing space
        console.log('Space released - shooting disabled');
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const newMousePos = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
      mousePosition.current = newMousePos;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    canvas.addEventListener('mousemove', handleMouseMove);

    let lastTime = performance.now();
    const gameLoop = () => {
      const currentTime = performance.now();
      const deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
      lastTime = currentTime;

      const currentPlayer = playersRef.current.find(p => p.id === currentPlayerId);
      if (!currentPlayer || gameOver) return;

      let dx = 0;
      let dy = 0;

      // Check movement keys
      if (keysPressed.current.has('w')) dy -= 1;
      if (keysPressed.current.has('s')) dy += 1;
      if (keysPressed.current.has('a')) dx -= 1;
      if (keysPressed.current.has('d')) dx += 1;

      // Calculate current rotation regardless of movement
      const mouseX = mousePosition.current.x;
      const mouseY = mousePosition.current.y;
      const currentRotation = Math.atan2(
        mouseY - currentPlayer.position.y,
        mouseX - currentPlayer.position.x
      );

      // Update local rotation immediately for rendering
      const updatedPlayers = [...playersRef.current];
      const currentPlayerIndex = updatedPlayers.findIndex(p => p.id === currentPlayerId);
      if (currentPlayerIndex !== -1) {
        updatedPlayers[currentPlayerIndex] = {
          ...updatedPlayers[currentPlayerIndex],
          rotation: currentRotation
        };
        playersRef.current = updatedPlayers;
      }

      // Process movement if there's input
      if (dx !== 0 || dy !== 0) {
        // Normalize diagonal movement
        const movement = vectorNormalize({ x: dx, y: dy });
        
        // Apply constant movement speed
        const scaledMovement = vectorMultiply(movement, PLAYER_SPEED / 60);

        // Calculate new position with collision detection
        const newPosition = movePlayer(
          currentPlayer.position,
          scaledMovement,
          playersRef.current,
          currentPlayerId
        );

        // Update local position immediately
        if (currentPlayerIndex !== -1) {
          updatedPlayers[currentPlayerIndex] = {
            ...updatedPlayers[currentPlayerIndex],
            position: newPosition
          };
          playersRef.current = updatedPlayers;
        }

        // Only send update if position or rotation has changed significantly
        if (canUpdate() && hasStateChanged(newPosition, currentRotation)) {
          previousState.current = {
            position: { ...newPosition },
            rotation: currentRotation
          };

          socket.emit('updatePlayer', {
            roomId,
            position: newPosition,
            rotation: currentRotation
          });
        }
      } else if (canUpdate() && hasStateChanged(currentPlayer.position, currentRotation)) {
        // If not moving but rotation changed significantly, send rotation update
        previousState.current = {
          position: { ...currentPlayer.position },
          rotation: currentRotation
        };

        socket.emit('updatePlayer', {
          roomId,
          position: currentPlayer.position,
          rotation: currentRotation
        });
      }

      // Handle shooting
      if (shooting.current && currentTime - lastShot.current >= FIRE_RATE) {
        lastShot.current = currentTime;
        const gunPos = calculateGunPosition(currentPlayer.position, currentPlayer.rotation);
        onShoot(gunPos, currentPlayer.rotation);
      }

      // Render game
      render();

      // Request next frame
      requestAnimationFrame(gameLoop);
    };

    // Start the game loop
    const animationFrameId = requestAnimationFrame(gameLoop);

    // Cleanup function
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      canvas.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
      socket.off('playerUpdated');
      socket.off('playerDied');
      socket.off('gameOver');
      socket.off('projectileHit');
      socket.off('projectilesUpdate');
    };
  }, [players, currentPlayerId, gameOver, onUpdatePlayer, onShoot]);

  const render = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    const gridSize = 50;
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw all players
    playersRef.current.forEach(player => {
      const isCurrentPlayer = player.id === currentPlayerId;
      
      // Draw player body
      ctx.beginPath();
      ctx.fillStyle = isCurrentPlayer ? '#4CAF50' : '#f44336';
      ctx.arc(player.position.x, player.position.y, PLAYER_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      // Draw health bar background
      const healthBarWidth = PLAYER_RADIUS * 2;
      const healthBarHeight = 4;
      const healthBarY = player.position.y - PLAYER_RADIUS - 15;
      
      ctx.fillStyle = '#333';
      ctx.fillRect(
        player.position.x - healthBarWidth / 2,
        healthBarY,
        healthBarWidth,
        healthBarHeight
      );

      // Draw health bar
      const healthPercentage = Math.max(0, Math.min(1, player.health / 100));
      ctx.fillStyle = healthPercentage > 0.5 ? '#4CAF50' : healthPercentage > 0.2 ? '#FFA500' : '#f44336';
      ctx.fillRect(
        player.position.x - healthBarWidth / 2,
        healthBarY,
        healthBarWidth * healthPercentage,
        healthBarHeight
      );

      // Draw gun
      const gunLength = PLAYER_RADIUS * 1.5;
      const gunEnd = {
        x: player.position.x + Math.cos(player.rotation) * gunLength,
        y: player.position.y + Math.sin(player.rotation) * gunLength
      };

      ctx.beginPath();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.moveTo(player.position.x, player.position.y);
      ctx.lineTo(gunEnd.x, gunEnd.y);
      ctx.stroke();

      // Draw player name and health
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.font = '14px Arial';
      ctx.fillText(
        `${player.username} (${Math.max(0, Math.round(player.health))}HP)`,
        player.position.x,
        player.position.y - PLAYER_RADIUS - 20
      );
    });

    // Draw projectiles
    ctx.fillStyle = '#ff0000';
    ctx.lineWidth = 2;
    projectilesRef.current.forEach(projectile => {
      ctx.beginPath();
      ctx.arc(projectile.position.x, projectile.position.y, PROJECTILE_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ff6666';
      ctx.stroke();
      
      // Draw projectile trail
      ctx.beginPath();
      ctx.strokeStyle = '#ff000066';
      ctx.moveTo(
        projectile.position.x - projectile.velocity.x * 2,
        projectile.position.y - projectile.velocity.y * 2
      );
      ctx.lineTo(projectile.position.x, projectile.position.y);
      ctx.stroke();
    });
  };

  return (
    <div className="relative">
      {gameOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-center text-white p-8 bg-gray-800 rounded-lg">
            <h2 className="text-2xl font-bold mb-4">Game Over!</h2>
            <p className="mb-4">
              {currentPlayerId === winner ? 
                'You won the game!' : 
                winner ? `${winner} won the game!` : 
                'You were eliminated!'}
            </p>
            <button
              onClick={() => window.location.href = '/'}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Back to Home
            </button>
          </div>
        </div>
      )}
      <div className="absolute top-4 left-4 bg-black/50 p-2 rounded text-white text-sm">
        <p>Controls:</p>
        <p>WASD - Move</p>
        <p>Mouse - Aim</p>
        <p>Space - Shoot</p>
      </div>
      <canvas
        ref={canvasRef}
        className="border border-gray-700"
      />
    </div>
  );
}
