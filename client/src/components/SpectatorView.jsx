import { useEffect, useRef, useState } from 'react';
import { useSpectator } from '../hooks/useSpectator.js';
import socket from '../utils/socket.js';

function ConnectionBadge({ state }) {
  const dot = { connected: 'bg-green-500', connecting: 'bg-yellow-500', new: 'bg-yellow-500', disconnected: 'bg-red-500', failed: 'bg-red-500', closed: 'bg-[#555]' };
  return (
    <span className="flex items-center gap-2 text-xs text-gray-500">
      <span className={`w-2 h-2 rounded-full ${dot[state] || 'bg-[#555]'}`} />
      {state}
    </span>
  );
}

const GearIcon = () => (
  <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
    <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
  </svg>
);
const BackIcon = () => (
  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 5l-7 7 7 7" />
  </svg>
);

const SpeakerOnIcon = () => (
  <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
  </svg>
);

const SpeakerOffIcon = () => (
  <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z" />
  </svg>
);

const MicOnIcon = () => (
  <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.49 6-3.31 6-6.72h-1.7z" />
  </svg>
);

const MicOffIcon = () => (
  <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
    <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3 3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
  </svg>
);

const FEED_LABELS = ['Streamer', 'Viewer'];

function RemoteVideoTile({ videoTrack, uid, label, audioMuted, onToggleAudio, flipped }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!videoTrack || !containerRef.current) return;
    videoTrack.play(containerRef.current);
    return () => videoTrack.stop();
  }, [videoTrack]);

  return (
    <div className="relative flex-1 bg-[#141414] rounded-2xl overflow-hidden border border-[#e8e0f5]" style={{ minHeight: '260px' }}>
      <div ref={containerRef} className="absolute inset-0" style={flipped ? { transform: 'scaleX(-1)' } : {}} />

      {!videoTrack && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <div className="w-8 h-8 border-2 border-[#8B2BE2] border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-xs">Waiting for {label}…</p>
        </div>
      )}

      <div className="absolute top-3 left-3 px-2.5 py-1 bg-black/70 rounded-lg">
        <span className="text-white text-xs font-semibold">{label}</span>
      </div>

      {/* Per-feed local speaker mute — mutes spectator's own audio for this feed */}
      <button
        onClick={() => onToggleAudio(uid, !audioMuted)}
        title={audioMuted ? 'Unmute this feed (your speaker)' : 'Mute this feed (your speaker)'}
        className={`absolute bottom-3 right-3 w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
          audioMuted ? 'bg-red-600 hover:bg-red-500' : 'bg-black/60 hover:bg-black/80'
        }`}
      >
        {audioMuted ? <SpeakerOffIcon /> : <SpeakerOnIcon />}
      </button>
    </div>
  );
}

function AdminToggle({ label, icon, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all border ${
        active
          ? 'bg-red-600/20 border-red-600/50 text-red-400 hover:bg-red-600/30'
          : 'bg-[#f0ebff] border-[#e8e0f5] text-gray-500 hover:border-[#8B2BE2]/60 hover:text-gray-900'
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wider ${
        active ? 'bg-red-600/40 text-red-300' : 'bg-[#e8e0f5] text-gray-400'
      }`}>
        {active ? 'MUTED' : 'LIVE'}
      </span>
    </button>
  );
}

export default function SpectatorView({ roomId, onLeave }) {
  const { remoteUsers, connectionState, speakerDevices, audioMuted, muteUserAudio, setSpeakerDevice } = useSpectator({ roomId });
  const [selectedSpeaker, setSelectedSpeaker] = useState('');
  const [showSettings,    setShowSettings]    = useState(false);

  // Tracks what admin has force-muted on each target
  const [adminMuted, setAdminMuted] = useState({
    sender:   { mic: false, speaker: false },
    receiver: { mic: false, speaker: false },
  });

  function handleSpeakerChange(e) {
    const deviceId = e.target.value;
    setSelectedSpeaker(deviceId);
    setSpeakerDevice(deviceId);
  }

  function toggleRemoteMute(target, type) {
    const next = !adminMuted[target][type];
    setAdminMuted((prev) => ({ ...prev, [target]: { ...prev[target], [type]: next } }));
    socket.emit('admin-control', { roomId, target, type, muted: next });
  }

  return (
    <div className="min-h-screen bg-[#f8f5ff] flex flex-col p-4 gap-4">

      {/* Header bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          {onLeave && (
            <button
              onClick={onLeave}
              className="w-9 h-9 rounded-full flex items-center justify-center bg-[#f0ebff] border border-[#e8e0f5] text-gray-500 hover:bg-[#8B2BE2] hover:text-white transition-colors shadow-sm"
            >
              <BackIcon />
            </button>
          )}
          <span className="text-[#8B2BE2] text-xs font-semibold tracking-widest uppercase">Admin View</span>
          <ConnectionBadge state={connectionState} />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {speakerDevices.length > 1 && (
            <select
              value={selectedSpeaker}
              onChange={handleSpeakerChange}
              className="bg-white border border-[#e8e0f5] rounded-xl px-3 py-1.5 text-gray-900 text-xs focus:outline-none focus:border-[#8B2BE2] transition-colors"
            >
              <option value="">Default Speaker</option>
              {speakerDevices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Speaker ${d.deviceId.slice(0, 8)}`}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => setShowSettings((s) => !s)}
            title="Admin controls"
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
              showSettings ? 'bg-[#8B2BE2] text-white' : 'bg-white border border-[#e8e0f5] text-gray-500 hover:text-gray-900 hover:border-[#8B2BE2]'
            }`}
          >
            <GearIcon />
          </button>
          <button
            onClick={onLeave}
            className="px-4 py-1.5 rounded-xl bg-transparent border border-red-600/40 text-red-400 text-xs font-semibold hover:border-red-500 hover:bg-red-600/10 transition-all"
          >
            ✕ Leave
          </button>
        </div>
      </div>

      {/* Video grid */}
      <div className="flex-1 flex flex-col md:flex-row gap-4">
        {remoteUsers.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-10 h-10 border-2 border-[#8B2BE2] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Waiting for feeds…</p>
              <p className="text-gray-400 text-xs mt-1">Streamer and Viewer must be in the room</p>
            </div>
          </div>
        ) : (
          remoteUsers.map((user, i) => (
            <RemoteVideoTile
              key={user.uid}
              videoTrack={user.videoTrack}
              uid={user.uid}
              label={FEED_LABELS[i] || `Feed ${i + 1}`}
              audioMuted={!!audioMuted[user.uid]}
              onToggleAudio={muteUserAudio}
              flipped={i === 1}
            />
          ))
        )}
      </div>

      {/* Admin controls panel — right-side slide-out */}
      {showSettings && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setShowSettings(false)} />
          <div className="fixed top-0 right-0 bottom-0 z-40 w-72 bg-white border-l border-[#e8e0f5] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-[#e8e0f5]">
              <p className="text-gray-900 font-semibold">Admin Controls</p>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-900 text-lg leading-none">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">

              {/* Streamer controls */}
              <div>
                <p className="text-[#7c3aed] text-xs font-semibold mb-3 uppercase tracking-wider">Streamer</p>
                <div className="space-y-2">
                  <AdminToggle
                    label="Mute Mic"
                    icon={adminMuted.sender.mic ? <MicOffIcon /> : <MicOnIcon />}
                    active={adminMuted.sender.mic}
                    onClick={() => toggleRemoteMute('sender', 'mic')}
                  />
                  <AdminToggle
                    label="Mute Speaker"
                    icon={adminMuted.sender.speaker ? <SpeakerOffIcon /> : <SpeakerOnIcon />}
                    active={adminMuted.sender.speaker}
                    onClick={() => toggleRemoteMute('sender', 'speaker')}
                  />
                </div>
              </div>

              {/* Viewer controls */}
              <div className="pt-5 border-t border-[#e8e0f5]">
                <p className="text-[#7c3aed] text-xs font-semibold mb-3 uppercase tracking-wider">Viewer</p>
                <div className="space-y-2">
                  <AdminToggle
                    label="Mute Mic"
                    icon={adminMuted.receiver.mic ? <MicOffIcon /> : <MicOnIcon />}
                    active={adminMuted.receiver.mic}
                    onClick={() => toggleRemoteMute('receiver', 'mic')}
                  />
                  <AdminToggle
                    label="Mute Speaker"
                    icon={adminMuted.receiver.speaker ? <SpeakerOffIcon /> : <SpeakerOnIcon />}
                    active={adminMuted.receiver.speaker}
                    onClick={() => toggleRemoteMute('receiver', 'speaker')}
                  />
                </div>
              </div>

              {/* Note about per-feed mute */}
              <div className="pt-5 border-t border-[#e8e0f5]">
                <p className="text-[#7c3aed] text-xs font-semibold mb-2 uppercase tracking-wider">Your Audio</p>
                <p className="text-gray-400 text-xs leading-relaxed">
                  Use the speaker icon on each video tile to mute your own playback for that feed. This only affects what you hear.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
