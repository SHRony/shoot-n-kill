import { Player, Vector2D, Projectile } from '@/types/game';

export const PLAYER_RADIUS = 20;
export const PROJECTILE_RADIUS = 5;
export const PLAYER_SPEED = 200; // pixels per second
export const PROJECTILE_SPEED = 400; // pixels per second
export const FIRE_RATE = 100; // milliseconds between shots
export const MAP_WIDTH = 800;
export const MAP_HEIGHT = 600;

// Physics utilities
export const vectorAdd = (a: Vector2D, b: Vector2D): Vector2D => ({
  x: a.x + b.x,
  y: a.y + b.y
});

export const vectorSubtract = (a: Vector2D, b: Vector2D): Vector2D => ({
  x: a.x - b.x,
  y: a.y - b.y
});

export const vectorMultiply = (v: Vector2D, scalar: number): Vector2D => ({
  x: v.x * scalar,
  y: v.y * scalar
});

export const vectorNormalize = (v: Vector2D): Vector2D => {
  const magnitude = Math.sqrt(v.x * v.x + v.y * v.y);
  return magnitude === 0 ? { x: 0, y: 0 } : {
    x: v.x / magnitude,
    y: v.y / magnitude
  };
};

export const vectorDistance = (a: Vector2D, b: Vector2D): number => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
};

// Collision detection
export const checkCircleCollision = (
  pos1: Vector2D,
  radius1: number,
  pos2: Vector2D,
  radius2: number
): boolean => {
  const distance = vectorDistance(pos1, pos2);
  return distance < radius1 + radius2;
};

export const checkWallCollision = (pos: Vector2D, radius: number): boolean => {
  return pos.x - radius < 0 ||
         pos.x + radius > MAP_WIDTH ||
         pos.y - radius < 0 ||
         pos.y + radius > MAP_HEIGHT;
};

// Movement with collision detection
export const movePlayer = (
  currentPos: Vector2D,
  movement: Vector2D,
  players: Player[],
  playerId: string
): Vector2D => {
  const newPos = vectorAdd(currentPos, movement);

  // Check wall collisions
  const adjustedPos = {
    x: Math.max(PLAYER_RADIUS, Math.min(MAP_WIDTH - PLAYER_RADIUS, newPos.x)),
    y: Math.max(PLAYER_RADIUS, Math.min(MAP_HEIGHT - PLAYER_RADIUS, newPos.y))
  };

  // Check player collisions
  for (const player of players) {
    if (player.id === playerId) continue;
    
    if (checkCircleCollision(adjustedPos, PLAYER_RADIUS, player.position, PLAYER_RADIUS)) {
      // Push players apart
      const collisionVector = vectorSubtract(adjustedPos, player.position);
      const normalized = vectorNormalize(collisionVector);
      const pushDistance = PLAYER_RADIUS * 2 - vectorDistance(adjustedPos, player.position);
      return vectorAdd(adjustedPos, vectorMultiply(normalized, pushDistance));
    }
  }

  return adjustedPos;
};

// Projectile system
export const createProjectile = (
  position: Vector2D,
  angle: number,
  playerId: string
): Projectile => {
  const velocity = {
    x: Math.cos(angle) * PROJECTILE_SPEED,
    y: Math.sin(angle) * PROJECTILE_SPEED
  };

  return {
    id: Math.random().toString(36).substr(2, 9),
    position: { ...position },
    velocity,
    playerId
  };
};

export const updateProjectile = (projectile: Projectile): Projectile => {
  return {
    ...projectile,
    position: vectorAdd(projectile.position, projectile.velocity)
  };
};

export const checkProjectileCollision = (
  projectile: Projectile,
  players: Player[],
  damage: number = 10
): { hit: boolean; playerId?: string } => {
  // Check wall collision
  if (checkWallCollision(projectile.position, PROJECTILE_RADIUS)) {
    return { hit: true };
  }

  // Check player collision
  for (const player of players) {
    if (player.id === projectile.playerId) continue;

    if (checkCircleCollision(
      projectile.position,
      PROJECTILE_RADIUS,
      player.position,
      PLAYER_RADIUS
    )) {
      return { hit: true, playerId: player.id };
    }
  }

  return { hit: false };
};

// Game state updates
export const applyDamage = (player: Player, damage: number): Player => ({
  ...player,
  health: Math.max(0, player.health - damage)
});

export const isPlayerAlive = (player: Player): boolean => {
  return player.health > 0;
};

// Helper functions for game rendering
export const calculateGunPosition = (
  playerPos: Vector2D,
  rotation: number,
  gunLength: number = 35
): Vector2D => {
  return {
    x: playerPos.x + Math.cos(rotation) * gunLength,
    y: playerPos.y + Math.sin(rotation) * gunLength
  };
};
