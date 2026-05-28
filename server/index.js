require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const authRouter = require('./auth');
const verifyToken = require('./middleware/verifyToken');
const { createRoom, getRooms, getRoom, deleteRoom, updateRoom } = require('./roomManager');

let RtcTokenBuilder, RtcRole;
try {
  ({ RtcTokenBuilder, RtcRole } = require('agora-token'));
} catch {
  console.warn('[agora] agora-token package not installed — token endpoint disabled');
}

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

// Agora token — channel=roomId, role=sender|receiver
app.get('/api/agora-token', (req, res) => {
  const appId = process.env.AGORA_APP_ID;
  const certificate = process.env.AGORA_APP_CERTIFICATE;

  if (!appId) return res.status(503).json({ error: 'AGORA_APP_ID not configured on server' });

  // Without a certificate, return null token (works when Auth Mode = "No Auth" in Agora console)
  if (!certificate || !RtcTokenBuilder) {
    return res.json({ token: null, appId });
  }

  const { channel = '', role = 'receiver' } = req.query;
  const expire = 86400; // 24 hours in seconds
  const agoraRole = role === 'sender' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
  const token = RtcTokenBuilder.buildTokenWithUid(appId, certificate, channel, 0, agoraRole, expire, expire);

  res.json({ token, appId });
});

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

// Room presence tracking (no WebRTC signaling — Agora handles media)
const roomSockets = {};

io.on('connection', (socket) => {
  console.log(`[socket] connected: ${socket.id}`);

  // Approximate bandwidth tracking from Agora stats reported by client
  socket.on('webrtc-stats', ({ roomId, deltaBytes }) => {
    if (roomId && deltaBytes > 0) {
      updateRoom(roomId, {
        bytesUsed: (getRoom(roomId)?.bytesUsed || 0) + deltaBytes,
      });
    }
  });

  socket.on('join-room', ({ roomId, role }) => {
    console.log(`[socket] join-room roomId=${roomId} role=${role} socket=${socket.id}`);

    if (!roomSockets[roomId]) {
      roomSockets[roomId] = { sender: null, receiver: null, participant1: null, participant2: null };
    }
    const slots = roomSockets[roomId];

    if (role === 'participant') {
      if (!slots.participant1) {
        slots.participant1 = socket.id;
        socket.join(roomId);
      } else if (!slots.participant2) {
        slots.participant2 = socket.id;
        socket.join(roomId);
      } else {
        socket.emit('role-taken', { role: 'participant' });
        console.log(`[socket] meeting full roomId=${roomId}`);
      }
      return;
    }

    // Both broadcast slots occupied — block 3rd person entirely
    if (slots.sender && slots.receiver) {
      socket.emit('room-full');
      console.log(`[socket] room-full roomId=${roomId}`);
      return;
    }

    if (slots[role]) {
      socket.emit('role-taken', { role });
      console.log(`[socket] role-taken roomId=${roomId} role=${role}`);
      return;
    }

    slots[role] = socket.id;
    socket.join(roomId);
    updateRoom(roomId, { [`${role}Joined`]: true });
  });

  function clearSocketFromRooms(socketId) {
    for (const [roomId, slots] of Object.entries(roomSockets)) {
      if (slots.participant1 === socketId) {
        slots.participant1 = null;
        if (slots.participant2) io.to(slots.participant2).emit('peer-disconnected', { role: 'participant' });
        console.log(`[socket] participant1 left room ${roomId}`);
      } else if (slots.participant2 === socketId) {
        slots.participant2 = null;
        if (slots.participant1) io.to(slots.participant1).emit('peer-disconnected', { role: 'participant' });
        console.log(`[socket] participant2 left room ${roomId}`);
      } else if (slots.sender === socketId) {
        slots.sender = null;
        updateRoom(roomId, { senderJoined: false });
        if (slots.receiver) io.to(slots.receiver).emit('peer-disconnected', { role: 'sender' });
        console.log(`[socket] sender left room ${roomId}`);
      } else if (slots.receiver === socketId) {
        slots.receiver = null;
        updateRoom(roomId, { receiverJoined: false });
        if (slots.sender) io.to(slots.sender).emit('peer-disconnected', { role: 'receiver' });
        console.log(`[socket] receiver left room ${roomId}`);
      }
    }
  }

  socket.on('leave-room', () => {
    console.log(`[socket] leave-room socket=${socket.id}`);
    clearSocketFromRooms(socket.id);
    socket.rooms.forEach((r) => { if (r !== socket.id) socket.leave(r); });
  });

  socket.on('disconnect', () => {
    console.log(`[socket] disconnected: ${socket.id}`);
    clearSocketFromRooms(socket.id);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`StreamPortal server running on port ${PORT}`);
});
