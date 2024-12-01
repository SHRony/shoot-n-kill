'use client';

import { useEffect, useRef } from 'react';
import { Player, Vector2D } from '@/types/game';

interface GameCanvasProps {
  players: Player[];
  currentPlayerId: string;
  onUpdatePlayer: (position: Vector2D, rotation: number) => void;
  onShoot: (position: Vector2D, angle: number) => void;
}

export default function GameCanvas({ players, currentPlayerId, onUpdatePlayer, onShoot }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keysPressed = useRef<Set<string>>(new Set());
  const mousePosition = useRef<Vector2D>({ x: 0, y: 0 });
  const shooting = useRef(false);
  const lastShot = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current.add(e.key.toLowerCase());
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.key.toLowerCase());
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mousePosition.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    };

    const handleMouseDown = () => {
      shooting.current = true;
    };

    const handleMouseUp = () => {
      shooting.current = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);

    const gameLoop = () => {
      const currentPlayer = players.find(p => p.id === currentPlayerId);
      if (!currentPlayer) return;

      // Handle movement
      const speed = 5;
      let dx = 0;
      let dy = 0;

      if (keysPressed.current.has('w')) dy -= speed;
      if (keysPressed.current.has('s')) dy += speed;
      if (keysPressed.current.has('a')) dx -= speed;
      if (keysPressed.current.has('d')) dx += speed;

      if (dx !== 0 || dy !== 0) {
        const newPosition = {
          x: currentPlayer.position.x + dx,
          y: currentPlayer.position.y + dy
        };
        onUpdatePlayer(newPosition, currentPlayer.rotation);
      }

      // Handle rotation
      const angle = Math.atan2(
        mousePosition.current.y - currentPlayer.position.y,
        mousePosition.current.x - currentPlayer.position.x
      );
      onUpdatePlayer(currentPlayer.position, angle);

      // Handle shooting
      if (shooting.current) {
        const now = Date.now();
        if (now - lastShot.current >= 100) { // Fire rate limit
          onShoot(currentPlayer.position, angle);
          lastShot.current = now;
        }
      }

      // Render game
      render();
      requestAnimationFrame(gameLoop);
    };

    const render = () => {
      if (!ctx || !canvas) return;

      // Clear canvas
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw players
      players.forEach(player => {
        // Draw player body
        ctx.save();
        ctx.translate(player.position.x, player.position.y);
        ctx.rotate(player.rotation);

        ctx.fillStyle = player.id === currentPlayerId ? '#4CAF50' : '#F44336';
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
        ctx.fill();

        // Draw player gun
        ctx.fillStyle = '#333';
        ctx.fillRect(15, -5, 20, 10);

        ctx.restore();

        // Draw player health bar
        const healthBarWidth = 40;
        const healthBarHeight = 4;
        ctx.fillStyle = '#333';
        ctx.fillRect(
          player.position.x - healthBarWidth / 2,
          player.position.y - 30,
          healthBarWidth,
          healthBarHeight
        );
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(
          player.position.x - healthBarWidth / 2,
          player.position.y - 30,
          (healthBarWidth * player.health) / 100,
          healthBarHeight
        );

        // Draw player username
        ctx.fillStyle = '#fff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(
          player.username,
          player.position.x,
          player.position.y - 35
        );
      });
    };

    // Start game loop
    const animationFrame = requestAnimationFrame(gameLoop);

    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mouseup', handleMouseUp);
      cancelAnimationFrame(animationFrame);
    };
  }, [players, currentPlayerId, onUpdatePlayer, onShoot]);

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={600}
      className="border border-gray-700 rounded-lg shadow-lg"
    />
  );
}
