export interface Player {
  id: string;
  position: Vector2D;
  rotation: number;
  health: number;
  username: string;
}

export interface Vector2D {
  x: number;
  y: number;
}

export interface Projectile {
  id: string;
  position: Vector2D;
  velocity: Vector2D;
  playerId: string;
}

export interface GameState {
  players: Map<string, Player>;
  projectiles: Projectile[];
  status: 'waiting' | 'playing' | 'finished';
}

export interface RoomInfo {
  id: string;
  players: Player[];
  status: 'waiting' | 'playing';
  creatorId: string;
}
