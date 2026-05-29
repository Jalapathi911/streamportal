import { useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api.js';
import socket from '../utils/socket.js';
import MeetingView from '../components/MeetingView.jsx';
import SenderView from '../components/SenderView.jsx';
import ReceiverView from '../components/ReceiverView.jsx';

export default function Room() {
  const { roomId } = useParams();
  const [room,          setRoom]          = useState(null);
  const [notFound,      setNotFound]      = useState(false);
  const [inMeeting,     setInMeeting]     = useState(false);
  const [broadcastRole, setBroadcastRole] = useState(null); // 'sender' | 'receiver' | null
  const [joinError,     setJoinError]     = useState('');

  useEffect(() => {
    apiFetch(`/api/rooms/${roomId}`)
      .then((res) => { if (!res.ok) { setNotFound(true); return null; } return res.json(); })
      .then((data) => { if (data) setRoom(data); });

    socket.on('role-taken', ({ role: takenRole }) => {
      if (takenRole === 'participant') {
        setJoinError('This meeting is full — only 2 participants allowed.');
        setInMeeting(false);
      } else if (takenRole === 'sender') {
        setJoinError('Someone is already broadcasting in this room.');
        setBroadcastRole(null);
      } else if (takenRole === 'receiver') {
        setJoinError('Viewer slot is already taken.');
        setBroadcastRole(null);
      }
    });

    socket.on('room-full', () => {
      setJoinError('This broadcast is full — sender and receiver are both connected.');
      setBroadcastRole(null);
      setInMeeting(false);
    });

    return () => { socket.off('role-taken'); socket.off('room-full'); };
  }, [roomId]);

  function handleJoinBroadcast(role) {
    setJoinError('');
    socket.emit('join-room', { roomId, role });
    setBroadcastRole(role);
  }

  function handleLeaveBroadcast() {
    socket.emit('leave-room');
    setBroadcastRole(null);
  }

  if (notFound) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
      <div className="text-center">
        <p className="text-2xl font-bold text-white mb-2">Room not found</p>
        <p className="text-[#888] text-sm">This room may have been deleted or the link is invalid.</p>
      </div>
    </div>
  );

  if (!room) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
      <p className="text-[#888]">Loading room…</p>
    </div>
  );

  if (inMeeting)
    return <MeetingView roomId={roomId} onLeave={() => setInMeeting(false)} />;

  if (broadcastRole === 'sender')
    return <SenderView roomId={roomId} onLeave={handleLeaveBroadcast} />;

  if (broadcastRole === 'receiver')
    return <ReceiverView roomId={roomId} onLeave={handleLeaveBroadcast} />;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0a] p-8">
      <h1 className="text-2xl font-bold text-white mb-2">{room.name}</h1>
      <p className="text-[#888] text-sm mb-10">Choose how you want to join</p>

      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-2xl">
        {/* Go Live — broadcast sender */}
        <button
          onClick={() => handleJoinBroadcast('sender')}
          className="flex-1 bg-[#141414] border border-[#2a2a2a] hover:border-[#7c3aed] rounded-2xl p-8 text-left transition-all group"
        >
          <div className="text-3xl mb-3">📡</div>
          <div className="text-white font-semibold text-lg mb-1 group-hover:text-[#a78bfa]">Go Live</div>
          <div className="text-[#888] text-sm">Broadcast your camera to a viewer</div>
        </button>

        {/* Watch — broadcast receiver */}
        <button
          onClick={() => handleJoinBroadcast('receiver')}
          className="flex-1 bg-[#141414] border border-[#2a2a2a] hover:border-[#7c3aed] rounded-2xl p-8 text-left transition-all group"
        >
          <div className="text-3xl mb-3">📺</div>
          <div className="text-white font-semibold text-lg mb-1 group-hover:text-[#a78bfa]">Watch</div>
          <div className="text-[#888] text-sm">View the live broadcast</div>
        </button>

        {/* Join Meeting — 1-on-1 */}
        <button
          onClick={() => { setJoinError(''); setInMeeting(true); }}
          className="flex-1 bg-[#141414] border border-[#2a2a2a] hover:border-[#7c3aed] rounded-2xl p-8 text-left transition-all group"
        >
          <div className="text-3xl mb-3">🎥</div>
          <div className="text-white font-semibold text-lg mb-1 group-hover:text-[#a78bfa]">Join Meeting</div>
          <div className="text-[#888] text-sm">1-on-1 video call · max 2 people</div>
        </button>
      </div>

      {joinError && <p className="mt-6 text-red-400 text-sm text-center">{joinError}</p>}
    </div>
  );
}
