import { Player, Vector2D, Projectile } from '../../src/types/game';

interface CollisionResult {
  hit: boolean;
  playerId?: string;
}

// Game constants
export const PROJECTILE_SPEED = 10;
export const MAP_WIDTH = 800;
export const MAP_HEIGHT = 600;
export const PLAYER_RADIUS = 20;
export const PROJECTILE_RADIUS = 5;
export const PLAYER_SPEED = 300;
export const FIRE_RATE = 250; // milliseconds between shots

// Vector math utilities
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

export const vectorNormalize = (vector: Vector2D): Vector2D => {
  const magnitude = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
  if (magnitude === 0) return { x: 0, y: 0 };
  return {
    x: vector.x / magnitude,
    y: vector.y / magnitude
  };
};

export const vectorFromAngle = (angle: number): Vector2D => ({
  x: Math.cos(angle),
  y: Math.sin(angle)
});

export const distance = (a: Vector2D, b: Vector2D): number => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
};

// Player movement
export const movePlayer = (
  currentPos: Vector2D,
  movement: Vector2D,
  players: Player[],
  currentPlayerId: string
): Vector2D => {
  const newPos = vectorAdd(currentPos, movement);

  // Check wall collisions
  newPos.x = Math.max(PLAYER_RADIUS, Math.min(MAP_WIDTH - PLAYER_RADIUS, newPos.x));
  newPos.y = Math.max(PLAYER_RADIUS, Math.min(MAP_HEIGHT - PLAYER_RADIUS, newPos.y));

  // Check player collisions
  for (const other of players) {
    if (other.id === currentPlayerId) continue;
    const dist = distance(newPos, other.position);
    if (dist < PLAYER_RADIUS * 2) {
      // Simple collision resolution - move back to current position
      return currentPos;
    }
  }

  return newPos;
};

// Gun position calculation
export const calculateGunPosition = (playerPos: Vector2D, rotation: number): Vector2D => {
  const gunOffset = PLAYER_RADIUS * 1.5;
  return {
    x: playerPos.x + Math.cos(rotation) * gunOffset,
    y: playerPos.y + Math.sin(rotation) * gunOffset
  };
};

// Collision detection
export const checkWallCollision = (pos: Vector2D, radius: number): boolean => {
  return pos.x - radius < 0 ||
         pos.x + radius > MAP_WIDTH ||
         pos.y - radius < 0 ||
         pos.y + radius > MAP_HEIGHT;
};

// Projectile functions
export const createProjectile = (position: Vector2D, angle: number, playerId: string): Projectile => {
  const direction = vectorFromAngle(angle);
  return {
    id: Math.random().toString(36).substring(7),
    position: { ...position },
    velocity: vectorMultiply(direction, PROJECTILE_SPEED),
    playerId
  };
};

export const updateProjectile = (projectile: Projectile): Projectile => ({
  ...projectile,
  position: vectorAdd(projectile.position, projectile.velocity)
});

export const checkProjectileCollision = (
  projectile: Projectile,
  players: Player[]
): CollisionResult => {
  // Check if projectile is out of bounds
  if (checkWallCollision(projectile.position, PROJECTILE_RADIUS)) {
    return { hit: true };
  }

  // Check collision with players
  for (const player of players) {
    // Don't check collision with the player who shot the projectile
    if (player.id === projectile.playerId) continue;

    const dist = distance(projectile.position, player.position);
    if (dist < PLAYER_RADIUS + PROJECTILE_RADIUS) {
      return { hit: true, playerId: player.id };
    }
  }

  return { hit: false };
};

export const applyDamage = (player: Player, damage: number): Player => ({
  ...player,
  health: Math.max(0, player.health - damage)
});

export const isPlayerAlive = (player: Player): boolean => player.health > 0;
