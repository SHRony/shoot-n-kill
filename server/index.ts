import { Server } from 'socket.io';
import { createServer } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { Player, Vector2D, Projectile, GameState } from '../src/types/game';
import {
  createProjectile,
  updateProjectile,
  checkProjectileCollision,
  applyDamage,
  isPlayerAlive,
  checkWallCollision,
  PROJECTILE_RADIUS,
  MAP_WIDTH,
  MAP_HEIGHT,
  PLAYER_RADIUS
} from './game/engine';

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

interface GameRoom {
  id: string;
  players: Map<string, Player>;
  projectiles: Projectile[];
  status: GameState['status'];
  creatorId: string;
  lastActivity: number;
  lastPlayerUpdates: Map<string, number>;
}

const rooms = new Map<string, GameRoom>();

// Room cleanup interval (5 minutes)
const ROOM_CLEANUP_INTERVAL = 5 * 60 * 1000;
// Room expiry time (2 minutes of inactivity)
const ROOM_EXPIRY_TIME = 2 * 60 * 1000;
// Room grace period (10 seconds)
const ROOM_GRACE_PERIOD = 10 * 1000;
// Minimum time between player updates (50ms = 20 updates per second)
const MIN_UPDATE_INTERVAL = 50;

// Game update interval (33ms = ~30fps)
const GAME_UPDATE_INTERVAL = 33;

// Keep track of recently disconnected players
const recentlyDisconnected = new Map<string, { 
  roomId: string; 
  timestamp: number;
  username: string;
  wasCreator: boolean;
}>();

// Cleanup inactive rooms periodically
setInterval(() => {
  const now = Date.now();
  
  // Clean up old entries from recentlyDisconnected
  for (const [playerId, data] of recentlyDisconnected.entries()) {
    if (now - data.timestamp > ROOM_GRACE_PERIOD) {
      recentlyDisconnected.delete(playerId);
    }
  }
  
  // Clean up inactive rooms
  for (const [roomId, room] of rooms.entries()) {
    if (now - room.lastActivity > ROOM_EXPIRY_TIME && room.players.size === 0) {
      console.log('[Server] Room expired due to inactivity:', {
        roomId,
        lastActivity: new Date(room.lastActivity).toISOString(),
        timestamp: new Date().toISOString()
      });
      rooms.delete(roomId);
    }
  }
}, ROOM_CLEANUP_INTERVAL);

// Game update loop
setInterval(() => {
  for (const [roomId, room] of rooms.entries()) {
    if (room.status !== 'playing') continue;

    // Update projectiles
    const updatedProjectiles: Projectile[] = [];
    room.projectiles = room.projectiles.filter(projectile => {
      // Update projectile position
      const updatedProjectile = updateProjectile(projectile);
      
      // Check for wall collision
      if (checkWallCollision(updatedProjectile.position, PROJECTILE_RADIUS)) {
        console.log('[Server] Projectile hit wall:', {
          id: projectile.id,
          position: updatedProjectile.position
        });
        io.to(roomId).emit('projectileHit', {
          projectileId: projectile.id
        });
        return false;
      }
      
      // Check for player collision
      const collision = checkProjectileCollision(
        updatedProjectile,
        Array.from(room.players.values())
      );

      if (collision.hit) {
        console.log('[Server] Projectile hit player:', {
          projectileId: projectile.id,
          playerId: collision.playerId
        });
        if (collision.playerId) {
          const hitPlayer = room.players.get(collision.playerId);
          const shooter = room.players.get(projectile.playerId);
          if (hitPlayer) {
            // Apply damage
            const damage = 20; // Each hit does 20 damage
            hitPlayer.health = Math.max(0, hitPlayer.health - damage);
            
            // Update the player in the room
            room.players.set(collision.playerId, hitPlayer);

            // Broadcast the updated player state to all clients
            io.to(roomId).emit('playerUpdated', {
              playerId: hitPlayer.id,
              health: hitPlayer.health
            });

            // Notify about the projectile hit
            io.to(roomId).emit('projectileHit', {
              projectileId: projectile.id,
              playerId: collision.playerId,
              damage: damage
            });

            // Check if player died
            if (hitPlayer.health <= 0) {
              console.log('[Server] Player died:', {
                playerId: hitPlayer.id,
                killerPlayerId: projectile.playerId
              });
              
              // Notify all clients about player death
              io.to(roomId).emit('playerDied', { 
                playerId: hitPlayer.id,
                killerUsername: shooter ? shooter.username : 'Unknown'
              });
              
              // Remove the dead player from the room
              room.players.delete(hitPlayer.id);
              
              // Check if game is over (only one player left)
              const remainingPlayers = Array.from(room.players.values());
              if (remainingPlayers.length === 1) {
                const winner = remainingPlayers[0];
                console.log('[Server] Game Over - Winner:', {
                  winnerUsername: winner.username,
                  winnerId: winner.id,
                  roomId
                });
                io.to(roomId).emit('gameOver', { 
                  winnerUsername: winner.username,
                  winnerId: winner.id
                });
                room.status = 'finished';
              }
            }
          }
        }
        return false;
      }

      // Update the projectile in the array and keep it
      Object.assign(projectile, updatedProjectile);
      updatedProjectiles.push(projectile);
      return true;
    });

    // Broadcast updated projectiles to all clients in the room
    if (updatedProjectiles.length > 0) {
      console.log('[Server] Broadcasting projectile updates:', {
        roomId,
        count: updatedProjectiles.length,
        positions: updatedProjectiles.map(p => ({ 
          id: p.id,
          x: Math.round(p.position.x), 
          y: Math.round(p.position.y)
        }))
      });
      io.to(roomId).emit('projectilesUpdate', updatedProjectiles);
    }

    // Update projectile positions for all clients
    io.to(roomId).emit('projectilesUpdated', room.projectiles);
  }
}, GAME_UPDATE_INTERVAL);

// Helper function to get room info for logging
const getRoomInfo = (room: GameRoom) => ({
  id: room.id,
  playerCount: room.players.size,
  status: room.status,
  lastActivity: new Date(room.lastActivity).toISOString(),
  players: Array.from(room.players.values()).map(p => ({
    id: p.id,
    username: p.username,
    isCreator: p.isCreator
  }))
});

io.on('connection', (socket) => {
  console.log('[Server] New client connected:', {
    socketId: socket.id,
    timestamp: new Date().toISOString(),
    activeRooms: rooms.size
  });

  socket.on('createRoom', (username: string) => {
    console.log('[Server] Room creation requested:', {
      socketId: socket.id,
      username,
      timestamp: new Date().toISOString()
    });

    // Check if user already has a room
    for (const [existingRoomId, room] of rooms.entries()) {
      const existingPlayer = Array.from(room.players.values()).find(p => p.username === username);
      if (existingPlayer) {
        console.log('[Server] User already has a room:', existingRoomId);
        socket.emit('error', 'You already have an active room');
        return;
      }
    }

    const roomId = uuidv4();
    const player: Player = {
      id: socket.id,
      username,
      position: { x: 400, y: 300 },
      rotation: 0,
      health: 100,
      isCreator: true
    };

    const room: GameRoom = {
      id: roomId,
      players: new Map([[socket.id, player]]),
      projectiles: [],
      status: 'waiting',
      creatorId: socket.id,
      lastActivity: Date.now(),
      lastPlayerUpdates: new Map()
    };

    // Set up room and join socket to room
    rooms.set(roomId, room);
    socket.join(roomId);
    socket.data.roomId = roomId;

    // Log room creation
    console.log('[Server] Room created:', getRoomInfo(room));

    // Emit room created event
    socket.emit('roomCreated', {
      roomId,
      playerId: socket.id,
      isCreator: true
    });

    // Also emit room joined event to ensure client has player data
    socket.emit('roomJoined', {
      playerId: socket.id,
      players: Array.from(room.players.values()),
      isCreator: true
    });
  });

  socket.on('joinRoom', ({ roomId, username }: { roomId: string; username: string }) => {
    console.log('[Server] Join room request:', { roomId, username, socketId: socket.id });
    
    // If roomId is 'create', treat it as a special case
    if (roomId === 'create') {
      socket.emit('error', 'Invalid room ID');
      return;
    }
    
    const room = rooms.get(roomId);
    if (!room) {
      console.log('[Server] Room not found:', roomId);
      socket.emit('error', 'Room not found');
      return;
    }

    // Check if this is a reconnecting player
    const disconnectedPlayer = recentlyDisconnected.get(username);
    const isReconnecting = disconnectedPlayer && disconnectedPlayer.roomId === roomId;
    
    // Check if username already exists in the room
    const existingPlayer = Array.from(room.players.values()).find(p => p.username === username);
    if (existingPlayer && existingPlayer.id !== socket.id && !isReconnecting) {
      socket.emit('error', 'Username already taken in this room');
      return;
    }

    // Join the Socket.IO room
    socket.join(roomId);
    socket.data.roomId = roomId;
    
    // Add player to the room
    const isCreatorStatus = isReconnecting ? disconnectedPlayer?.wasCreator : false;
    const newPlayer: Player = {
      id: socket.id,
      position: { x: Math.random() * (800 - 100) + 50, y: Math.random() * (600 - 100) + 50 },
      rotation: 0,
      health: 100,
      username: username,
      isCreator: isCreatorStatus
    };

    // If this is a reconnecting creator, update room's creatorId
    if (isReconnecting && disconnectedPlayer?.wasCreator) {
      room.creatorId = socket.id;
      // Remove previous creator status if someone else was temporary creator
      for (const [_, p] of room.players) {
        if (p.isCreator) {
          p.isCreator = false;
        }
      }
    }

    room.players.set(socket.id, newPlayer);
    room.lastActivity = Date.now();

    // Clean up from recentlyDisconnected if reconnecting
    if (isReconnecting) {
      recentlyDisconnected.delete(username);
    }

    // Get updated player list with correct creator status
    const updatedPlayers = Array.from(room.players.values()).map(p => ({
      ...p,
      isCreator: p.id === room.creatorId || p.isCreator
    }));

    // Emit join success to the joining player
    socket.emit('roomJoined', {
      playerId: socket.id,
      players: updatedPlayers,
      isCreator: newPlayer.isCreator
    });

    // Broadcast new player to others in the room
    socket.to(roomId).emit('playerJoined', newPlayer);

    console.log('[Server] Player joined room:', {
      socketId: socket.id,
      roomId,
      isReconnecting,
      isCreator: newPlayer.isCreator,
      playerCount: room.players.size,
      timestamp: new Date().toISOString()
    });
  });

  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    const player = room.players.get(socket.id);
    if (!player) return;

    // Store player info before removing them
    recentlyDisconnected.set(player.username, {
      roomId,
      timestamp: Date.now(),
      username: player.username,
      wasCreator: player.isCreator || socket.id === room.creatorId
    });

    // Remove player from room
    room.players.delete(socket.id);

    // If this was the creator and there are other players, assign creator to another player
    if (socket.id === room.creatorId && room.players.size > 0) {
      const newCreator = Array.from(room.players.values())[0];
      if (newCreator) {
        room.creatorId = newCreator.id;
        newCreator.isCreator = true;
      }
      
      // Notify all clients about the creator change
      io.to(roomId).emit('creatorChanged', {
        newCreatorId: newCreator?.id,
        players: Array.from(room.players.values())
      });
    }

    // Broadcast player left event
    io.to(roomId).emit('playerLeft', socket.id);

    // Don't delete room immediately if it's empty - grace period is handled by cleanup interval
    room.lastActivity = Date.now();

    console.log('[Server] Player disconnected:', {
      socketId: socket.id,
      roomId,
      remainingPlayers: room.players.size,
      timestamp: new Date().toISOString()
    });
  });

  // Handle player updates (movement, rotation)
  socket.on('updatePlayer', ({ roomId, position, rotation }: { roomId: string; position: Vector2D; rotation: number }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const now = Date.now();
    const lastUpdate = room.lastPlayerUpdates.get(socket.id) || 0;
    if (now - lastUpdate < MIN_UPDATE_INTERVAL) {
      return; // Too soon for another update
    }

    const player = room.players.get(socket.id);
    if (!player) return;

    // Update the player in the room
    const updatedPlayer = { ...player, position, rotation };
    room.players.set(socket.id, updatedPlayer);
    room.lastPlayerUpdates.set(socket.id, now);
    room.lastActivity = now;

    // Log the update
    console.log('[Server] Player update:', {
      roomId,
      position: { x: Math.round(position.x), y: Math.round(position.y) },
      rotation: Math.round(rotation * 100) / 100,
      playerId: socket.id
    });

    // Broadcast to other players only
    socket.to(roomId).emit('playerUpdated', {
      playerId: socket.id,
      position,
      rotation
    });
  });

  socket.on('startGame', (roomId: string) => {
    console.log('[Server] Start game requested:', { roomId });
    const room = rooms.get(roomId);
    
    if (!room) {
      console.log('[Server] Start game failed - Room not found:', { roomId });
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    if (socket.id !== room.creatorId) {
      console.log('[Server] Start game failed - Not room creator:', { roomId, socketId: socket.id });
      socket.emit('error', { message: 'Only the room creator can start the game' });
      return;
    }

    if (room.players.size < 2) {
      console.log('[Server] Start game failed - Not enough players:', { roomId, playerCount: room.players.size });
      socket.emit('error', { message: 'Need at least 2 players to start' });
      return;
    }

    room.status = 'playing';
    console.log('[Server] Game started:', getRoomInfo(room));
    io.to(roomId).emit('gameStarted');
  });

  socket.on('shoot', ({ roomId, position, angle }: { roomId: string; position: Vector2D; angle: number }) => {
    console.log('[Server] Shoot event received:', {
      roomId,
      position,
      angle,
      playerId: socket.id
    });

    const room = rooms.get(roomId);
    if (!room) {
      console.log('[Server] Room not found for shooting:', roomId);
      return;
    }

    if (room.status !== 'playing') {
      console.log('[Server] Cannot shoot - game not in playing state:', room.status);
      return;
    }

    const projectile = createProjectile(position, angle, socket.id);
    room.projectiles.push(projectile);
    console.log('[Server] Projectile created:', {
      id: projectile.id,
      position: projectile.position,
      velocity: projectile.velocity
    });

    io.to(roomId).emit('projectileCreated', projectile);
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log('[Server] Game server started:', {
    port: PORT,
    timestamp: new Date().toISOString()
  });
});
