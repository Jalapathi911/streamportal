require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const authRouter = require('./auth');
const verifyToken = require('./middleware/verifyToken');
const { createRoom, getRooms, getRoom, deleteRoom, updateRoom } = require('./roomManager');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth routes
app.use('/api', authRouter);

// Room routes (protected)
app.post('/api/rooms', verifyToken, (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Room name is required' });
  }
  const room = createRoom(name.trim());
  res.status(201).json(room);
});

app.get('/api/rooms', verifyToken, (req, res) => {
  res.json(getRooms());
});

app.get('/api/rooms/:id', (req, res) => {
  const room = getRoom(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json(room);
});

app.delete('/api/rooms/:id', verifyToken, (req, res) => {
  const deleted = deleteRoom(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Room not found' });
  res.json({ success: true });
});

// Signaling: per-room socket IDs { roomId: { sender: socketId, receiver: socketId } }
const roomSockets = {};

io.on('connection', (socket) => {
  console.log(`[socket] connected: ${socket.id}`);

  socket.on('webrtc-stats', ({ roomId, deltaBytes }) => {
    if (roomId && deltaBytes > 0) updateRoom(roomId, {
      bytesUsed: (getRoom(roomId)?.bytesUsed || 0) + deltaBytes,
    });
  });

  socket.on('join-room', ({ roomId, role }) => {
    console.log(`[socket] join-room roomId=${roomId} role=${role} socket=${socket.id}`);

    if (!roomSockets[roomId]) {
      roomSockets[roomId] = { sender: null, receiver: null };
    }

    const slots = roomSockets[roomId];

    if (slots[role]) {
      socket.emit('role-taken', { role });
      console.log(`[socket] role-taken roomId=${roomId} role=${role}`);
      return;
    }

    slots[role] = socket.id;
    socket.join(roomId);
    updateRoom(roomId, { [`${role}Joined`]: true });

    const otherRole = role === 'sender' ? 'receiver' : 'sender';
    if (slots[otherRole]) {
      // Both peers present — notify both
      io.to(slots[otherRole]).emit('peer-joined', { role });
      socket.emit('peer-joined', { role: otherRole });
      console.log(`[socket] peer-joined both present in room ${roomId}`);
    }
  });

  socket.on('offer', ({ roomId, sdp }) => {
    console.log(`[socket] offer from ${socket.id} in room ${roomId}`);
    const slots = roomSockets[roomId];
    if (slots && slots.receiver) {
      io.to(slots.receiver).emit('offer', { sdp });
    }
  });

  socket.on('answer', ({ roomId, sdp }) => {
    console.log(`[socket] answer from ${socket.id} in room ${roomId}`);
    const slots = roomSockets[roomId];
    if (slots && slots.sender) {
      io.to(slots.sender).emit('answer', { sdp });
    }
  });

  socket.on('ice-candidate', ({ roomId, candidate }) => {
    console.log(`[socket] ice-candidate from ${socket.id} in room ${roomId}`);
    const slots = roomSockets[roomId];
    if (!slots) return;
    const targetId = slots.sender === socket.id ? slots.receiver : slots.sender;
    if (targetId) {
      io.to(targetId).emit('ice-candidate', { candidate });
    }
  });

  socket.on('disconnect', () => {
    console.log(`[socket] disconnected: ${socket.id}`);
    for (const [roomId, slots] of Object.entries(roomSockets)) {
      if (slots.sender === socket.id) {
        slots.sender = null;
        updateRoom(roomId, { senderJoined: false });
        if (slots.receiver) {
          io.to(slots.receiver).emit('peer-disconnected', { role: 'sender' });
        }
        console.log(`[socket] sender left room ${roomId}`);
      } else if (slots.receiver === socket.id) {
        slots.receiver = null;
        updateRoom(roomId, { receiverJoined: false });
        if (slots.sender) {
          io.to(slots.sender).emit('peer-disconnected', { role: 'receiver' });
        }
        console.log(`[socket] receiver left room ${roomId}`);
      }
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`StreamPortal server running on port ${PORT}`);
});
