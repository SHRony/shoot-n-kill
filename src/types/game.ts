export interface Player {
  id: string;
  position: Vector2D;
  rotation: number;
  health: number;
  username: string;
  isCreator?: boolean;
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

export interface Socket<T = any> {
  emit: (event: string, ...args: any[]) => void;
  on: (event: string, callback: (...args: any[]) => void) => void;
  off: (event: string, callback?: (...args: any[]) => void) => void;
  id?: string;
}
