import { useState, useEffect, useRef } from 'react';
import { useMeeting } from '../hooks/useMeeting.js';
import socket from '../utils/socket.js';

const MicOnIcon = () => (
  <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.49 6-3.31 6-6.72h-1.7z" />
  </svg>
);

const MicOffIcon = () => (
  <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
    <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3 3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
  </svg>
);

const SpeakerIcon = () => (
  <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
  </svg>
);

export default function MeetingView({ roomId, onLeave }) {
  const [rawStream,    setRawStream]    = useState(null);
  const [mediaError,   setMediaError]   = useState('');
  const [showPreview,  setShowPreview]  = useState(true);
  const [muted,        setMuted]        = useState(false);
  const [micVol,       setMicVolState]  = useState(100);
  const [speakerVol,   setSpeakerState] = useState(100);
  const [callEnded,    setCallEnded]    = useState(false);

  const localVideoRef  = useRef(null);
  const remoteVideoRef = useRef(null);

  // Start camera + mic
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
      audio: true,
    })
      .then((stream) => setRawStream(stream))
      .catch((err)  => setMediaError(`Camera error: ${err.message}`));

    return () => {
      setRawStream((prev) => { prev?.getTracks().forEach((t) => t.stop()); return null; });
    };
  }, []);

  // Wire local stream → PiP preview
  useEffect(() => {
    if (localVideoRef.current && rawStream) localVideoRef.current.srcObject = rawStream;
  }, [rawStream]);

  const { remoteStream, connectionState, peerLeft, setMicMuted, setMicVolume, setSpeakerVolume } =
    useMeeting({ roomId, localStream: rawStream });

  // Wire remote stream → main video
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) remoteVideoRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  // Peer left via Socket.io
  useEffect(() => {
    const h = ({ role }) => { if (role === 'participant') setCallEnded(true); };
    socket.on('peer-disconnected', h);
    return () => socket.off('peer-disconnected', h);
  }, []);

  // Sync peerLeft from Agora user-left event
  useEffect(() => { if (peerLeft) setCallEnded(true); }, [peerLeft]);

  function handleMute() {
    const next = !muted;
    setMuted(next);
    setMicMuted(next);
  }

  function handleMicVol(e) {
    const v = Number(e.target.value);
    setMicVolState(v);
    setMicVolume(v);
  }

  function handleSpeakerVol(e) {
    const v = Number(e.target.value);
    setSpeakerState(v);
    setSpeakerVolume(v);
  }

  // ── Media error ────────────────────────────────────────────────────────────
  if (mediaError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <p className="text-red-400">{mediaError}</p>
      </div>
    );
  }

  // ── Call ended ────────────────────────────────────────────────────────────
  if (callEnded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <p className="text-xl font-semibold text-white mb-2">Call Ended</p>
          <p className="text-[#888] text-sm mb-6">The other person has left the meeting.</p>
          <button
            onClick={onLeave}
            className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-semibold px-6 py-2.5 rounded-lg transition-colors text-sm"
          >
            Back to Room
          </button>
        </div>
      </div>
    );
  }

  // ── Main layout ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-black relative overflow-hidden">

      {/* Remote video — fills entire background */}
      <div className="absolute inset-0">
        {remoteStream ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-[#0a0a0a]">
            <div className="w-10 h-10 border-2 border-[#7c3aed] border-t-transparent rounded-full animate-spin" />
            <p className="text-[#888] text-sm">Waiting for the other person…</p>
            <p className="text-[#555] text-xs">Share the room link with them</p>
          </div>
        )}
      </div>

      {/* Local PiP preview — bottom-right corner */}
      {showPreview && (
        <div className="absolute bottom-24 right-4 w-36 h-48 rounded-2xl overflow-hidden border-2 border-[#7c3aed]/70 shadow-2xl z-10 bg-[#141414]">
          {rawStream ? (
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-[#555] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {muted && (
            <div className="absolute bottom-2 left-2 bg-red-600/90 rounded-full p-1">
              <MicOffIcon />
            </div>
          )}
        </div>
      )}

      {/* Controls bar */}
      <div className="absolute bottom-0 inset-x-0 z-20 px-4 pb-4 pt-16 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
        <div className="flex items-center justify-between gap-3 max-w-xl mx-auto flex-wrap">

          {/* Mic mute + mic volume */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleMute}
              title={muted ? 'Unmute' : 'Mute mic'}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors flex-shrink-0 ${
                muted ? 'bg-red-600 hover:bg-red-500' : 'bg-white/10 hover:bg-white/20'
              }`}
            >
              {muted ? <MicOffIcon /> : <MicOnIcon />}
            </button>
            <input
              type="range" min="0" max="100" value={micVol}
              onChange={handleMicVol}
              title="Mic volume"
              className="w-20 accent-[#7c3aed] cursor-pointer"
            />
          </div>

          {/* Preview toggle */}
          <button
            onClick={() => setShowPreview((p) => !p)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              showPreview
                ? 'bg-[#7c3aed] text-white'
                : 'bg-white/10 text-[#ccc] hover:bg-white/20'
            }`}
          >
            {showPreview ? '📷 Hide Preview' : '📷 Show Preview'}
          </button>

          {/* Speaker volume */}
          <div className="flex items-center gap-2">
            <SpeakerIcon />
            <input
              type="range" min="0" max="100" value={speakerVol}
              onChange={handleSpeakerVol}
              title="Speaker volume"
              className="w-20 accent-[#7c3aed] cursor-pointer"
            />
          </div>

          {/* Connection dot + End call */}
          <div className="flex items-center gap-3">
            <span
              title={connectionState}
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                connectionState === 'connected' ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'
              }`}
            />
            <button
              onClick={onLeave}
              className="bg-red-600 hover:bg-red-500 text-white font-semibold px-4 py-1.5 rounded-lg text-sm transition-colors whitespace-nowrap"
            >
              End Call
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
