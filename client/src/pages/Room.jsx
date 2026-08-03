import { useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api.js';
import socket from '../utils/socket.js';
import MeetingView from '../components/MeetingView.jsx';
import SenderView from '../components/SenderView.jsx';
import ReceiverView from '../components/ReceiverView.jsx';
import SpectatorView from '../components/SpectatorView.jsx';


function IconStreamer() {
  return (
    <svg width="38" height="38" viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="5" fill="white" />
      <path d="M15 33 Q9 24 15 15" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M33 15 Q39 24 33 33" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M9 39 Q2 24 9 9"   stroke="white" strokeWidth="2"   strokeLinecap="round" opacity="0.55" />
      <path d="M39 9 Q46 24 39 39" stroke="white" strokeWidth="2"   strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}

function IconViewer() {
  return (
    <svg width="38" height="38" viewBox="0 0 48 48" fill="none">
      <rect x="4" y="10" width="40" height="28" rx="3" stroke="white" strokeWidth="2.5" />
      <line x1="16" y1="38" x2="32" y2="38" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="24" y1="38" x2="24" y2="44" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <polygon points="20,17 20,31 34,24" fill="white" />
    </svg>
  );
}

function IconSpectator() {
  return (
    <svg width="38" height="38" viewBox="0 0 48 48" fill="none">
      <path d="M24 10 C10 10 2 24 2 24 C2 24 10 38 24 38 C38 38 46 24 46 24 C46 24 38 10 24 10 Z"
            stroke="white" strokeWidth="2.5" fill="none" strokeLinejoin="round"/>
      <circle cx="24" cy="24" r="7" stroke="white" strokeWidth="2.5" fill="none"/>
      <circle cx="24" cy="24" r="3" fill="white"/>
    </svg>
  );
}

function IconFaceToFace() {
  return (
    <svg width="38" height="38" viewBox="0 0 48 48" fill="none">
      <circle cx="14" cy="16" r="6" stroke="white" strokeWidth="2.5" />
      <path d="M3 40 C3 31 8 27 14 27 C20 27 25 31 25 40" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="34" cy="16" r="6" stroke="white" strokeWidth="2.5" />
      <path d="M23 40 C23 31 28 27 34 27 C40 27 45 31 45 40" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function RoundButton({ onClick, icon, label }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-3 group">
      <div className="w-[104px] h-[104px] rounded-full bg-[#8B2BE2] flex items-center justify-center shadow-xl shadow-[#8B2BE2]/25 group-hover:bg-[#7B1BD2] group-active:scale-95 transition-all duration-150">
        {icon}
      </div>
      <span className="text-gray-900 font-semibold text-xs tracking-widest uppercase">{label}</span>
    </button>
  );
}

export default function Room() {
  const { roomId } = useParams();
  const [room,          setRoom]          = useState(null);
  const [notFound,      setNotFound]      = useState(false);
  const [inMeeting,     setInMeeting]     = useState(false);
  const [broadcastRole, setBroadcastRole] = useState(null);
  const [joinError,          setJoinError]          = useState('');
  const [showSpectatorModal, setShowSpectatorModal] = useState(false);
  const [spectatorPassword,  setSpectatorPassword]  = useState('');
  const [spectatorError,     setSpectatorError]     = useState('');

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

    socket.on('spectator-auth-failed', () => {
      setSpectatorError('Wrong password. Try again.');
    });

    socket.on('spectator-joined', () => {
      setShowSpectatorModal(false);
      setBroadcastRole('spectator');
    });

    return () => {
      socket.off('role-taken');
      socket.off('room-full');
      socket.off('spectator-auth-failed');
      socket.off('spectator-joined');
    };
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

  function handleSpectatorSubmit(e) {
    e.preventDefault();
    setSpectatorError('');
    socket.emit('join-room', { roomId, role: 'spectator', password: spectatorPassword });
  }

  if (notFound) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f5ff] px-6">
      <div className="text-center">
        <p className="text-xl font-bold text-gray-900 mb-2">Room not found</p>
        <p className="text-gray-500 text-sm">This room may have been deleted or the link is invalid.</p>
      </div>
    </div>
  );

  if (!room) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f5ff]">
      <div className="flex items-center gap-2 text-gray-500 text-sm">
        <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
        Loading…
      </div>
    </div>
  );

  if (inMeeting)
    return <MeetingView roomId={roomId} onLeave={() => setInMeeting(false)} />;

  if (broadcastRole === 'sender')
    return <SenderView roomId={roomId} onLeave={handleLeaveBroadcast} />;

  if (broadcastRole === 'receiver')
    return <ReceiverView roomId={roomId} onLeave={handleLeaveBroadcast} />;

  if (broadcastRole === 'spectator')
    return <SpectatorView roomId={roomId} onLeave={handleLeaveBroadcast} />;

  return (
    <div className="min-h-screen flex flex-col items-center bg-[#f8f5ff] px-6 pt-14 pb-10">

      {/* Logo */}
      <div className="flex flex-col items-center mb-10">
        <img src="/holobox911-logo.png" alt="HoloBox911" className="w-56 object-contain mb-2" />
        <p className="text-[#8B2BE2] text-xs font-semibold tracking-widest uppercase mb-4">Live stream</p>

        <p className="text-gray-500 text-sm font-medium">Let's Explore</p>
        <div className="flex items-center gap-2 mt-2">
          <span className="w-2 h-2 rounded-full bg-green-500 shadow-sm shadow-green-400" />
          <span className="text-gray-500 text-xs">{room.name}</span>
        </div>
      </div>

      {/* Buttons — 2×2 grid */}
      <div className="grid grid-cols-2 gap-8 w-full max-w-xs">
        <RoundButton
          onClick={() => handleJoinBroadcast('sender')}
          icon={<IconStreamer />}
          label="Streamer"
        />
        <RoundButton
          onClick={() => handleJoinBroadcast('receiver')}
          icon={<IconViewer />}
          label="Viewer"
        />
        <RoundButton
          onClick={() => { setJoinError(''); setInMeeting(true); }}
          icon={<IconFaceToFace />}
          label="Face to Face"
        />
        <RoundButton
          onClick={() => { setJoinError(''); setSpectatorError(''); setSpectatorPassword(''); setShowSpectatorModal(true); }}
          icon={<IconSpectator />}
          label="Admin View"
        />
      </div>

      {joinError && (
        <p className="mt-8 text-red-500 text-sm text-center max-w-xs">{joinError}</p>
      )}

      {/* Spectator password modal */}
      {showSpectatorModal && (
        <>
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
            onClick={() => setShowSpectatorModal(false)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm px-4">
            <div className="bg-white border border-[#e8e0f5] rounded-2xl p-8">
              <div className="flex flex-col items-center mb-6">
                <IconSpectator />
                <p className="text-gray-900 font-semibold text-lg mt-4">Admin View</p>
                <p className="text-gray-500 text-sm mt-1 text-center">Enter the password to access admin view</p>
              </div>
              <form onSubmit={handleSpectatorSubmit} className="space-y-4">
                <input
                  type="password"
                  value={spectatorPassword}
                  onChange={(e) => setSpectatorPassword(e.target.value)}
                  placeholder="Password"
                  autoFocus
                  className="w-full bg-[#faf8ff] border border-[#e8e0f5] rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#8B2BE2] focus:ring-2 focus:ring-[#8B2BE2]/10 transition-all"
                />
                {spectatorError && (
                  <p className="text-red-500 text-sm text-center">{spectatorError}</p>
                )}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowSpectatorModal(false)}
                    className="flex-1 py-2.5 rounded-xl border border-[#e8e0f5] text-gray-500 text-sm font-semibold hover:text-white hover:border-[#555] transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-[#8B2BE2] hover:bg-[#7B1BD2] text-white font-semibold text-sm transition-all shadow-lg shadow-[#8B2BE2]/20"
                  >
                    Join
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
