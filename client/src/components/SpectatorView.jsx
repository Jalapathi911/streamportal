import { useEffect, useRef, useState } from 'react';
import { useSpectator } from '../hooks/useSpectator.js';

function ConnectionBadge({ state }) {
  const dot = { connected: 'bg-green-500', connecting: 'bg-yellow-500', new: 'bg-yellow-500', disconnected: 'bg-red-500', failed: 'bg-red-500', closed: 'bg-[#555]' };
  return (
    <span className="flex items-center gap-2 text-xs text-[#888]">
      <span className={`w-2 h-2 rounded-full ${dot[state] || 'bg-[#555]'}`} />
      {state}
    </span>
  );
}

const SpeakerOnIcon = () => (
  <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
  </svg>
);

const SpeakerOffIcon = () => (
  <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z" />
  </svg>
);

const FEED_LABELS = ['Streamer', 'Viewer'];

function RemoteVideoTile({ videoTrack, uid, label, audioMuted, onToggleAudio }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!videoTrack || !containerRef.current) return;
    videoTrack.play(containerRef.current);
    return () => videoTrack.stop();
  }, [videoTrack]);

  return (
    <div className="relative flex-1 bg-[#141414] rounded-2xl overflow-hidden border border-[#2a2a2a]" style={{ minHeight: '260px' }}>
      <div ref={containerRef} className="absolute inset-0" />

      {!videoTrack && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <div className="w-8 h-8 border-2 border-[#8B2BE2] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#666] text-xs">Waiting for {label}…</p>
        </div>
      )}

      <div className="absolute top-3 left-3 px-2.5 py-1 bg-black/70 rounded-lg">
        <span className="text-white text-xs font-semibold">{label}</span>
      </div>

      <button
        onClick={() => onToggleAudio(uid, !audioMuted)}
        title={audioMuted ? 'Unmute audio' : 'Mute audio'}
        className={`absolute bottom-3 right-3 w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
          audioMuted ? 'bg-red-600 hover:bg-red-500' : 'bg-black/60 hover:bg-black/80'
        }`}
      >
        {audioMuted ? <SpeakerOffIcon /> : <SpeakerOnIcon />}
      </button>
    </div>
  );
}

export default function SpectatorView({ roomId, onLeave }) {
  const { remoteUsers, connectionState, speakerDevices, audioMuted, muteUserAudio, setSpeakerDevice } = useSpectator({ roomId });
  const [selectedSpeaker, setSelectedSpeaker] = useState('');

  function handleSpeakerChange(e) {
    const deviceId = e.target.value;
    setSelectedSpeaker(deviceId);
    setSpeakerDevice(deviceId);
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col p-4 gap-4">
      {/* Header bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <span className="text-[#8B2BE2] text-xs font-semibold tracking-widest uppercase">Spectator</span>
          <ConnectionBadge state={connectionState} />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {speakerDevices.length > 1 && (
            <select
              value={selectedSpeaker}
              onChange={handleSpeakerChange}
              className="bg-[#141414] border border-[#2a2a2a] rounded-xl px-3 py-1.5 text-white text-xs focus:outline-none focus:border-[#8B2BE2] transition-colors"
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
              <p className="text-[#888] text-sm">Waiting for feeds…</p>
              <p className="text-[#555] text-xs mt-1">Streamer and Viewer must be in the room</p>
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
            />
          ))
        )}
      </div>
    </div>
  );
}
