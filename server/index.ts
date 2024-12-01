import { Server } from 'socket.io';
import { createServer } from 'http';
import { v4 as uuidv4 } from 'uuid';

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
  status: 'waiting' | 'playing';
  creatorId: string;
}

interface Player {
  id: string;
  position: { x: number; y: number };
  rotation: number;
  health: number;
  username: string;
}

const rooms = new Map<string, GameRoom>();

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('createRoom', (username: string) => {
    const roomId = uuidv4().substring(0, 6);
    const player: Player = {
      id: socket.id,
      position: { x: 100, y: 100 },
      rotation: 0,
      health: 100,
      username
    };

    const room: GameRoom = {
      id: roomId,
      players: new Map([[socket.id, player]]),
      status: 'waiting',
      creatorId: socket.id
    };

    rooms.set(roomId, room);
    socket.join(roomId);
    socket.emit('roomCreated', { roomId, playerId: socket.id });
  });

  socket.on('joinRoom', ({ roomId, username }: { roomId: string; username: string }) => {
    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('error', 'Room not found');
      return;
    }

    if (room.status === 'playing') {
      socket.emit('error', 'Game already in progress');
      return;
    }

    const player: Player = {
      id: socket.id,
      position: { x: 300, y: 300 },
      rotation: 0,
      health: 100,
      username
    };

    room.players.set(socket.id, player);
    socket.join(roomId);
    
    const players = Array.from(room.players.values());
    io.to(roomId).emit('playerJoined', players);
  });

  socket.on('startGame', (roomId: string) => {
    const room = rooms.get(roomId);
    if (!room || room.creatorId !== socket.id) return;

    room.status = 'playing';
    io.to(roomId).emit('gameStarted');
  });

  socket.on('updatePlayer', ({ roomId, position, rotation }: { roomId: string; position: { x: number; y: number }; rotation: number }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const player = room.players.get(socket.id);
    if (!player) return;

    player.position = position;
    player.rotation = rotation;

    socket.to(roomId).emit('playerMoved', {
      id: socket.id,
      position,
      rotation
    });
  });

  socket.on('shoot', ({ roomId, position, angle }: { roomId: string; position: { x: number; y: number }; angle: number }) => {
    socket.to(roomId).emit('playerShot', {
      id: socket.id,
      position,
      angle
    });
  });

  socket.on('disconnect', () => {
    for (const [roomId, room] of rooms.entries()) {
      if (room.players.has(socket.id)) {
        room.players.delete(socket.id);
        
        if (room.players.size === 0) {
          rooms.delete(roomId);
        } else {
          if (room.creatorId === socket.id) {
            room.creatorId = room.players.values().next().value.id;
          }
          io.to(roomId).emit('playerLeft', socket.id);
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Game server running on port ${PORT}`);
});
