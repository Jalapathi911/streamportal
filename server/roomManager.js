const { randomUUID } = require('crypto');

const rooms = new Map();

function createRoom(name) {
  const id = randomUUID().slice(0, 8);
  const room = {
    id,
    name,
    createdAt: new Date().toISOString(),
    senderJoined: false,
    receiverJoined: false,
    bytesUsed: 0,
  };
  rooms.set(id, room);
  return room;
}

function getRooms() {
  return Array.from(rooms.values());
}

function getRoom(id) {
  return rooms.get(id) || null;
}

function deleteRoom(id) {
  return rooms.delete(id);
}

function updateRoom(id, updates) {
  const room = rooms.get(id);
  if (!room) return null;
  Object.assign(room, updates);
  return room;
}

module.exports = { createRoom, getRooms, getRoom, deleteRoom, updateRoom };
