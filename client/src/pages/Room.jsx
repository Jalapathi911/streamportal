import { useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import socket from '../utils/socket.js';
import SenderView from '../components/SenderView.jsx';
import ReceiverView from '../components/ReceiverView.jsx';

export default function Room() {
  const { roomId } = useParams();
  const [room, setRoom] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [role, setRole] = useState(null);
  const [roleError, setRoleError] = useState('');

  useEffect(() => {
    fetch(`/api/rooms/${roomId}`)
      .then((res) => {
        if (!res.ok) { setNotFound(true); return null; }
        return res.json();
      })
      .then((data) => { if (data) setRoom(data); });

    socket.on('role-taken', ({ role: takenRole }) => {
      setRoleError(`The ${takenRole} role is already taken. Try the other role.`);
    });

    return () => {
      socket.off('role-taken');
    };
  }, [roomId]);

  function joinAs(chosenRole) {
    setRoleError('');
    setRole(chosenRole);
    socket.emit('join-room', { roomId, role: chosenRole });
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <p className="text-2xl font-bold text-white mb-2">Room not found</p>
          <p className="text-[#888] text-sm">This room may have been deleted or the link is invalid.</p>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <p className="text-[#888]">Loading room…</p>
      </div>
    );
  }

  if (role === 'sender') return <SenderView roomId={roomId} />;
  if (role === 'receiver') return <ReceiverView roomId={roomId} />;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0a] p-8">
      <h1 className="text-2xl font-bold text-white mb-2">{room.name}</h1>
      <p className="text-[#888] mb-10">Choose your role to join</p>

      <div className="flex gap-6">
        {/* Sender card */}
        <button
          onClick={() => joinAs('sender')}
          className="w-52 bg-[#141414] border border-[#2a2a2a] hover:border-[#7c3aed] rounded-2xl p-8 text-left transition-all group"
        >
          <div className="text-3xl mb-3">📡</div>
          <div className="text-white font-semibold text-lg mb-1 group-hover:text-[#a78bfa]">Sender</div>
          <div className="text-[#888] text-sm">Broadcast your camera</div>
        </button>

        {/* Receiver card */}
        <button
          onClick={() => joinAs('receiver')}
          className="w-52 bg-[#141414] border border-[#2a2a2a] hover:border-[#7c3aed] rounded-2xl p-8 text-left transition-all group"
        >
          <div className="text-3xl mb-3">📺</div>
          <div className="text-white font-semibold text-lg mb-1 group-hover:text-[#a78bfa]">Receiver</div>
          <div className="text-[#888] text-sm">Watch the live stream</div>
        </button>
      </div>

      {roleError && (
        <p className="mt-6 text-red-400 text-sm">{roleError}</p>
      )}
    </div>
  );
}
