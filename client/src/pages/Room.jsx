import { useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api.js';
import socket from '../utils/socket.js';
import SenderView from '../components/SenderView.jsx';
import ReceiverView from '../components/ReceiverView.jsx';
import MeetingView from '../components/MeetingView.jsx';

export default function Room() {
  const { roomId } = useParams();
  const [room,      setRoom]      = useState(null);
  const [notFound,  setNotFound]  = useState(false);
  const [mode,      setMode]      = useState(null); // 'broadcast' | 'meeting'
  const [role,      setRole]      = useState(null); // 'sender' | 'receiver'
  const [roleError, setRoleError] = useState('');

  useEffect(() => {
    apiFetch(`/api/rooms/${roomId}`)
      .then((res) => {
        if (!res.ok) { setNotFound(true); return null; }
        return res.json();
      })
      .then((data) => { if (data) setRoom(data); });

    socket.on('role-taken', ({ role: takenRole }) => {
      if (takenRole === 'participant') {
        setRoleError('This meeting is full (max 2 participants).');
        setMode(null);
      } else {
        setRoleError(`The ${takenRole} role is already taken. Try the other role.`);
      }
    });

    return () => { socket.off('role-taken'); };
  }, [roomId]);

  function joinAs(chosenRole) {
    setRoleError('');
    setRole(chosenRole);
    socket.emit('join-room', { roomId, role: chosenRole });
  }

  function reset() {
    setMode(null);
    setRole(null);
    setRoleError('');
  }

  // ── Not found ──────────────────────────────────────────────────────────────
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

  // ── Active views ───────────────────────────────────────────────────────────
  if (mode === 'meeting') return <MeetingView roomId={roomId} onLeave={reset} />;
  if (role === 'sender')   return <SenderView   roomId={roomId} />;
  if (role === 'receiver') return <ReceiverView roomId={roomId} />;

  // ── Broadcast role selector ────────────────────────────────────────────────
  if (mode === 'broadcast') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0a] p-8 relative">
        <button
          onClick={reset}
          className="absolute top-6 left-6 text-[#888] hover:text-white text-sm transition-colors"
        >
          ← Back
        </button>

        <h1 className="text-2xl font-bold text-white mb-2">{room.name}</h1>
        <p className="text-[#888] mb-10">Choose your role</p>

        <div className="flex gap-6 flex-wrap justify-center">
          <button
            onClick={() => joinAs('sender')}
            className="w-52 bg-[#141414] border border-[#2a2a2a] hover:border-[#7c3aed] rounded-2xl p-8 text-left transition-all group"
          >
            <div className="text-3xl mb-3">📡</div>
            <div className="text-white font-semibold text-lg mb-1 group-hover:text-[#a78bfa]">Sender</div>
            <div className="text-[#888] text-sm">Broadcast your camera</div>
          </button>

          <button
            onClick={() => joinAs('receiver')}
            className="w-52 bg-[#141414] border border-[#2a2a2a] hover:border-[#7c3aed] rounded-2xl p-8 text-left transition-all group"
          >
            <div className="text-3xl mb-3">📺</div>
            <div className="text-white font-semibold text-lg mb-1 group-hover:text-[#a78bfa]">Receiver</div>
            <div className="text-[#888] text-sm">Watch the live stream</div>
          </button>
        </div>

        {roleError && <p className="mt-6 text-red-400 text-sm">{roleError}</p>}
      </div>
    );
  }

  // ── Mode selector (default) ────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0a] p-8">
      <h1 className="text-2xl font-bold text-white mb-2">{room.name}</h1>
      <p className="text-[#888] mb-10">How would you like to join?</p>

      <div className="flex gap-6 flex-wrap justify-center">
        <button
          onClick={() => setMode('broadcast')}
          className="w-56 bg-[#141414] border border-[#2a2a2a] hover:border-[#7c3aed] rounded-2xl p-8 text-left transition-all group"
        >
          <div className="text-3xl mb-3">📡</div>
          <div className="text-white font-semibold text-lg mb-1 group-hover:text-[#a78bfa]">Broadcast</div>
          <div className="text-[#888] text-sm">One sender streams to multiple viewers</div>
        </button>

        <button
          onClick={() => setMode('meeting')}
          className="w-56 bg-[#141414] border border-[#2a2a2a] hover:border-[#7c3aed] rounded-2xl p-8 text-left transition-all group"
        >
          <div className="text-3xl mb-3">🤝</div>
          <div className="text-white font-semibold text-lg mb-1 group-hover:text-[#a78bfa]">Virtual Meeting</div>
          <div className="text-[#888] text-sm">1-on-1 video call with full audio</div>
        </button>
      </div>

      {roleError && <p className="mt-6 text-red-400 text-sm">{roleError}</p>}
    </div>
  );
}
