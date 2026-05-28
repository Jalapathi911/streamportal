import { useState, useEffect, useRef, useCallback } from 'react';
import { useMeeting } from '../hooks/useMeeting.js';
import RotationControl from './RotationControl.jsx';
import DeviceSelector from './DeviceSelector.jsx';
import socket from '../utils/socket.js';

const FIT_MODES = [
  { key: 'contain', label: 'Fit'     },
  { key: 'cover',   label: 'Fill'    },
  { key: 'fill',    label: 'Stretch' },
  { key: 'none',    label: 'Native'  },
];

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

function FitButtons({ value, onChange }) {
  return (
    <div className="grid grid-cols-4 gap-1">
      {FIT_MODES.map(({ key, label }) => (
        <button key={key} onClick={() => onChange(key)}
          className={`py-1.5 rounded text-xs font-semibold transition-colors border ${
            value === key
              ? 'bg-[#7c3aed] border-[#7c3aed] text-white'
              : 'bg-[#0a0a0a] border-[#2a2a2a] text-[#888] hover:border-[#7c3aed] hover:text-white'
          }`}
        >{label}</button>
      ))}
    </div>
  );
}

function FlipButton({ value, onChange }) {
  return (
    <button onClick={() => onChange(!value)}
      className={`w-full py-1.5 rounded text-xs font-semibold transition-colors border ${
        value
          ? 'bg-[#7c3aed] border-[#7c3aed] text-white'
          : 'bg-[#0a0a0a] border-[#2a2a2a] text-[#888] hover:border-[#7c3aed] hover:text-white'
      }`}
    >⇄ Mirror / Flip {value ? '(ON)' : '(OFF)'}</button>
  );
}

export default function MeetingView({ roomId, onLeave }) {
  const containerRef   = useRef(null);
  const localVideoRef  = useRef(null);
  const remoteVideoRef = useRef(null);
  const hideTimerRef   = useRef(null);
  const selectedCamRef = useRef(null);
  const selectedMicRef = useRef(null);

  const [rawStream,    setRawStream]    = useState(null);
  const [mediaError,   setMediaError]   = useState('');
  const [showPreview,  setShowPreview]  = useState(true);
  const [muted,        setMuted]        = useState(false);
  const [speakerMuted, setSpeakerMuted] = useState(false);
  const [micVol,       setMicVolState]  = useState(100);
  const [speakerVol,   setSpeakerState] = useState(100);
  const [callEnded,    setCallEnded]    = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  const [remoteFit,      setRemoteFit]      = useState('cover');
  const [remoteRotation, setRemoteRotation] = useState(0);
  const [remoteFlipped,  setRemoteFlipped]  = useState(false);

  const [previewFit,      setPreviewFit]      = useState('cover');
  const [previewRotation, setPreviewRotation] = useState(0);
  const [previewFlipped,  setPreviewFlipped]  = useState(true);

  // ── Camera + mic ─────────────────────────────────────────────────────────
  async function startCamera(cameraId, micId) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 3840 },
          height: { ideal: 2160 },
          frameRate: { ideal: 30 },
          ...(cameraId ? { deviceId: { exact: cameraId } } : {}),
        },
        audio: micId ? { deviceId: { exact: micId } } : true,
      });
      setRawStream((prev) => { prev?.getTracks().forEach((t) => t.stop()); return stream; });
    } catch (err) {
      setMediaError(`Camera error: ${err.message}`);
    }
  }

  useEffect(() => {
    startCamera(null, null);
    return () => setRawStream((prev) => { prev?.getTracks().forEach((t) => t.stop()); return null; });
  }, []);

  // Keep local preview in sync — always-rendered element so ref is always valid
  useEffect(() => {
    if (localVideoRef.current && rawStream) localVideoRef.current.srcObject = rawStream;
  }, [rawStream]);

  const {
    hasRemoteVideo, connectionState, peerLeft,
    setMicMuted, setMicVolume, setSpeakerVolume, setSpeakerMuted: setSpeakerMutedFn,
  } = useMeeting({ roomId, localStream: rawStream, remoteVideoRef });

  // Auto-reconnect: peer came back after a drop
  useEffect(() => {
    if (hasRemoteVideo) setCallEnded(false);
  }, [hasRemoteVideo]);

  useEffect(() => {
    const h = ({ role }) => { if (role === 'participant') setCallEnded(true); };
    socket.on('peer-disconnected', h);
    return () => socket.off('peer-disconnected', h);
  }, []);
  useEffect(() => { if (peerLeft) setCallEnded(true); }, [peerLeft]);

  // ── Fullscreen ────────────────────────────────────────────────────────────
  useEffect(() => {
    const onChange = () => {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      setShowControls(true);
      clearTimeout(hideTimerRef.current);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const revealControls = useCallback(() => {
    clearTimeout(hideTimerRef.current);
    setShowControls(true);
    if (!showSettings) hideTimerRef.current = setTimeout(() => setShowControls(false), 3000);
  }, [showSettings]);

  useEffect(() => () => clearTimeout(hideTimerRef.current), []);

  useEffect(() => {
    if (showSettings) { clearTimeout(hideTimerRef.current); setShowControls(true); }
  }, [showSettings]);

  const enterFullscreen = useCallback(async () => {
    try { await containerRef.current?.requestFullscreen(); } catch { /* denied */ }
  }, []);
  const exitFullscreen = useCallback(async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
  }, []);

  // ── Device switch handlers ────────────────────────────────────────────────
  function handleCameraChange(deviceId) {
    selectedCamRef.current = deviceId;
    startCamera(deviceId, selectedMicRef.current);
  }
  function handleMicChange(deviceId) {
    selectedMicRef.current = deviceId;
    startCamera(selectedCamRef.current, deviceId);
  }

  // ── Audio handlers ────────────────────────────────────────────────────────
  function handleMicMute() {
    const next = !muted;
    setMuted(next);
    setMicMuted(next);
  }
  function handleSpeakerMute() {
    const next = !speakerMuted;
    setSpeakerMuted(next);
    setSpeakerMutedFn(next);
  }
  function handleMicVol(e)     { const v = +e.target.value; setMicVolState(v);  setMicVolume(v);     }
  function handleSpeakerVol(e) { const v = +e.target.value; setSpeakerState(v); setSpeakerVolume(v); }

  // ── Video styles ──────────────────────────────────────────────────────────
  // For 90°/270° rotations the video element's box model doesn't swap — use
  // absolute centering and swap width/height so the rotated frame fills its container.
  const remoteIs90or270 = remoteRotation === 90 || remoteRotation === 270;
  const remoteStyle = {
    objectFit: remoteFit,
    position: 'absolute',
    top: '50%', left: '50%',
    width:  remoteIs90or270 ? '100vh' : '100%',
    height: remoteIs90or270 ? '100vw' : '100%',
    transform: `translate(-50%, -50%) rotate(${remoteRotation}deg) scaleX(${remoteFlipped ? -1 : 1})`,
    transition: 'transform 0.3s ease',
  };
  // PiP container is w-36 (9rem) × h-48 (12rem) — swap those for 90°/270°
  const pipIs90or270 = previewRotation === 90 || previewRotation === 270;
  const previewStyle = {
    objectFit: previewFit,
    position: 'absolute',
    top: '50%', left: '50%',
    width:  pipIs90or270 ? '12rem' : '9rem',
    height: pipIs90or270 ? '9rem'  : '12rem',
    transform: `translate(-50%, -50%) rotate(${previewRotation}deg) scaleX(${previewFlipped ? -1 : 1})`,
    transition: 'transform 0.3s ease',
  };

  // ── Error screen ──────────────────────────────────────────────────────────
  if (mediaError) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
      <p className="text-red-400">{mediaError}</p>
    </div>
  );

  // ── Call ended / waiting for reconnect ────────────────────────────────────
  if (callEnded) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-[#7c3aed] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-xl font-semibold text-white mb-2">Other person left</p>
        <p className="text-[#888] text-sm mb-6">Waiting for them to reconnect…</p>
        <button onClick={onLeave}
          className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-semibold px-6 py-2.5 rounded-lg transition-colors text-sm">
          Leave Room
        </button>
      </div>
    </div>
  );

  // ── Main layout ───────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      onMouseMove={() => { if (isFullscreen) revealControls(); }}
      onClick={() => { if (isFullscreen && !showSettings) revealControls(); }}
      className="min-h-screen bg-black relative overflow-hidden"
      style={isFullscreen ? { width: '100%', height: '100%' } : {}}
    >
      {/* Remote video — always in DOM so Agora play() has a target */}
      <div className="absolute inset-0 overflow-hidden">
        <video ref={remoteVideoRef} autoPlay playsInline
          style={{ ...remoteStyle, display: hasRemoteVideo ? 'block' : 'none' }} />
        {!hasRemoteVideo && (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-[#0a0a0a]">
            <div className="w-10 h-10 border-2 border-[#7c3aed] border-t-transparent rounded-full animate-spin" />
            <p className="text-[#888] text-sm">Waiting for the other person…</p>
            <p className="text-[#555] text-xs">Share the room link with them</p>
          </div>
        )}
      </div>

      {/* Local PiP — always in DOM so ref stays valid during device switch */}
      <div
        className={`absolute w-36 h-48 rounded-2xl overflow-hidden border-2 border-[#7c3aed]/70 shadow-2xl z-10 bg-[#141414] transition-all duration-300 ${
          showSettings ? 'top-4 right-4' : 'bottom-24 right-4'
        }`}
        style={{ display: showPreview ? 'block' : 'none' }}
      >
        <video ref={localVideoRef} autoPlay muted playsInline style={previewStyle} />
        {!rawStream && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-[#555] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {muted && (
          <div className="absolute bottom-2 left-2 bg-red-600/90 rounded-full p-1">
            <MicOffIcon />
          </div>
        )}
        {speakerMuted && (
          <div className="absolute bottom-2 right-2 bg-red-600/90 rounded-full p-1">
            <SpeakerOffIcon />
          </div>
        )}
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div
          className="absolute inset-x-2 z-30 bg-[#141414] border border-[#2a2a2a] rounded-2xl p-5 overflow-y-auto"
          style={{ bottom: isFullscreen ? '80px' : '72px', maxHeight: '70vh' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-5">
            <p className="text-white font-semibold">Settings</p>
            <button onClick={() => setShowSettings(false)} className="text-[#888] hover:text-white text-lg leading-none">✕</button>
          </div>

          {/* Devices — full width at top */}
          <div className="mb-5 pb-5 border-b border-[#2a2a2a]">
            <p className="text-[#a78bfa] text-sm font-semibold mb-3">🎥 Camera & Microphone</p>
            <DeviceSelector
              role="sender"
              onCameraChange={handleCameraChange}
              onMicChange={handleMicChange}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Incoming Feed */}
            <div className="space-y-4">
              <p className="text-[#a78bfa] text-sm font-semibold">📥 Incoming Feed</p>
              <div>
                <p className="text-[#888] text-xs mb-2">Feed Size</p>
                <FitButtons value={remoteFit} onChange={setRemoteFit} />
              </div>
              <FlipButton value={remoteFlipped} onChange={setRemoteFlipped} />
              <div>
                <p className="text-[#888] text-xs mb-2">Display Rotation</p>
                <RotationControl currentRotation={remoteRotation} onRotate={setRemoteRotation} />
              </div>
              <div>
                <p className="text-[#888] text-xs mb-2">Audio Output Device</p>
                <DeviceSelector role="receiver" videoRef={remoteVideoRef} />
              </div>
            </div>

            {/* Your Preview */}
            <div className="space-y-4">
              <p className="text-[#a78bfa] text-sm font-semibold">📷 Your Preview</p>
              <div>
                <p className="text-[#888] text-xs mb-2">Feed Size</p>
                <FitButtons value={previewFit} onChange={setPreviewFit} />
              </div>
              <FlipButton value={previewFlipped} onChange={setPreviewFlipped} />
              <div>
                <p className="text-[#888] text-xs mb-2">Display Rotation</p>
                <RotationControl currentRotation={previewRotation} onRotate={setPreviewRotation} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Controls bar */}
      <div
        className="absolute bottom-0 inset-x-0 z-20 px-4 pb-4 pt-12 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-300"
        style={{ opacity: showControls ? 1 : 0, pointerEvents: showControls ? 'auto' : 'none' }}
        onMouseEnter={() => clearTimeout(hideTimerRef.current)}
        onMouseLeave={() => { if (isFullscreen && !showSettings) revealControls(); }}
      >
        <div className="flex items-center justify-between gap-2 max-w-2xl mx-auto flex-wrap">

          {/* Mic mute + volume */}
          <div className="flex items-center gap-2">
            <button onClick={handleMicMute} title={muted ? 'Unmute mic' : 'Mute mic'}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors flex-shrink-0 ${muted ? 'bg-red-600 hover:bg-red-500' : 'bg-white/10 hover:bg-white/20'}`}>
              {muted ? <MicOffIcon /> : <MicOnIcon />}
            </button>
            <input type="range" min="0" max="100" value={micVol} onChange={handleMicVol}
              title="Mic volume" className="w-20 accent-[#7c3aed] cursor-pointer" />
          </div>

          {/* Speaker mute + volume */}
          <div className="flex items-center gap-2">
            <button onClick={handleSpeakerMute} title={speakerMuted ? 'Unmute speaker' : 'Mute speaker'}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors flex-shrink-0 ${speakerMuted ? 'bg-red-600 hover:bg-red-500' : 'bg-white/10 hover:bg-white/20'}`}>
              {speakerMuted ? <SpeakerOffIcon /> : <SpeakerOnIcon />}
            </button>
            <input type="range" min="0" max="100" value={speakerVol} onChange={handleSpeakerVol}
              title="Speaker volume" className="w-20 accent-[#7c3aed] cursor-pointer" />
          </div>

          {/* Preview toggle */}
          <button onClick={() => setShowPreview((p) => !p)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${showPreview ? 'bg-[#7c3aed] text-white' : 'bg-white/10 text-[#ccc] hover:bg-white/20'}`}>
            {showPreview ? '📷 Hide' : '📷 Show'}
          </button>

          {/* Settings */}
          <button onClick={() => setShowSettings((s) => !s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${showSettings ? 'bg-[#7c3aed] text-white' : 'bg-white/10 text-[#ccc] hover:bg-white/20'}`}>
            ⚙️ Settings
          </button>

          {/* Fullscreen */}
          <button onClick={isFullscreen ? exitFullscreen : enterFullscreen}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/10 text-[#ccc] hover:bg-white/20 transition-colors whitespace-nowrap">
            {isFullscreen ? '✕ Exit' : '⛶ Fullscreen'}
          </button>

          {/* Connection state + End call */}
          <div className="flex items-center gap-2">
            <span title={connectionState}
              className={`w-2 h-2 rounded-full flex-shrink-0 ${connectionState === 'connected' ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`} />
            <button onClick={onLeave}
              className="bg-red-600 hover:bg-red-500 text-white font-semibold px-4 py-1.5 rounded-lg text-sm transition-colors whitespace-nowrap">
              End Call
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
