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

const GearIcon = () => (
  <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
    <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
  </svg>
);
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
              : 'bg-[#1a1a1a] border-[#2a2a2a] text-[#888] hover:border-[#7c3aed] hover:text-white'
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
          : 'bg-[#1a1a1a] border-[#2a2a2a] text-[#888] hover:border-[#7c3aed] hover:text-white'
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

  const [previewFit,             setPreviewFit]             = useState('cover');
  const [previewFlipped,         setPreviewFlipped]         = useState(false);
  const [previewDisplayRotation, setPreviewDisplayRotation] = useState(0);

  // ── Camera + mic ─────────────────────────────────────────────────────────
  async function startCamera(cameraId, micId) {
    const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth <= 768;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: mobile
          ? { width: { ideal: 720 }, height: { ideal: 1280 }, frameRate: { ideal: 30 }, ...(cameraId ? { deviceId: { exact: cameraId } } : {}) }
          : { width: { ideal: 3840 }, height: { ideal: 2160 }, frameRate: { ideal: 30 }, ...(cameraId ? { deviceId: { exact: cameraId } } : {}) },
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

  // Local preview — raw stream with CSS rotation/flip for display only
  useEffect(() => {
    if (localVideoRef.current && rawStream) localVideoRef.current.srcObject = rawStream;
  }, [rawStream]);

  // rawStream goes directly to Agora — no canvas processing
  const {
    hasRemoteVideo, connectionState, peerLeft,
    setMicMuted, setMicVolume, setSpeakerVolume, setSpeakerMuted: setSpeakerMutedFn,
  } = useMeeting({ roomId, localStream: rawStream, remoteVideoRef });

  useEffect(() => { if (hasRemoteVideo) setCallEnded(false); }, [hasRemoteVideo]);

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
  function handleCameraChange(deviceId) { selectedCamRef.current = deviceId; startCamera(deviceId, selectedMicRef.current); }
  function handleMicChange(deviceId)    { selectedMicRef.current = deviceId; startCamera(selectedCamRef.current, deviceId); }

  // ── Audio handlers ────────────────────────────────────────────────────────
  function handleMicMute()     { const n = !muted;        setMuted(n);        setMicMuted(n); }
  function handleSpeakerMute() { const n = !speakerMuted; setSpeakerMuted(n); setSpeakerMutedFn(n); }
  function handleMicVol(e)     { const v = +e.target.value; setMicVolState(v);  setMicVolume(v); }
  function handleSpeakerVol(e) { const v = +e.target.value; setSpeakerState(v); setSpeakerVolume(v); }

  // ── Video styles (CSS only — no canvas) ──────────────────────────────────
  const remoteIs90or270 = remoteRotation === 90 || remoteRotation === 270;
  const remoteStyle = {
    objectFit: remoteFit, position: 'absolute', top: '50%', left: '50%',
    width:  remoteIs90or270 ? '100vh' : '100%',
    height: remoteIs90or270 ? '100vw' : '100%',
    transform: `translate(-50%, -50%) rotate(${remoteRotation}deg) scaleX(${remoteFlipped ? -1 : 1})`,
    transition: 'transform 0.3s ease',
  };

  const previewDispIs90or270 = previewDisplayRotation === 90 || previewDisplayRotation === 270;
  const previewStyle = {
    objectFit: previewFit, position: 'absolute', top: '50%', left: '50%',
    width:  previewDispIs90or270 ? '12rem' : '100%',
    height: previewDispIs90or270 ? '9rem'  : '100%',
    transform: `translate(-50%, -50%) rotate(${previewDisplayRotation}deg) scaleX(${previewFlipped ? -1 : 1})`,
    transition: 'transform 0.3s ease',
  };

  if (mediaError) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
      <p className="text-red-400">{mediaError}</p>
    </div>
  );

  const controlsVisible = showControls;

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

      {/* Call ended overlay — keeps video elements mounted so Agora play() works on reconnect */}
      {callEnded && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#0a0a0a]/95">
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
      )}

      {/* Local PiP — always in DOM so ref stays valid during device switch */}
      <div
        className="absolute bottom-24 right-4 w-36 h-48 rounded-2xl overflow-hidden border-2 border-[#7c3aed]/70 shadow-2xl z-10 bg-[#141414]"
        style={{ display: showPreview ? 'block' : 'none' }}
      >
        <video ref={localVideoRef} autoPlay muted playsInline style={previewStyle} />
        {!rawStream && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-[#555] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {muted && (
          <div className="absolute bottom-2 left-2 bg-red-600/90 rounded-full p-1"><MicOffIcon /></div>
        )}
        {speakerMuted && (
          <div className="absolute bottom-2 right-2 bg-red-600/90 rounded-full p-1"><SpeakerOffIcon /></div>
        )}
      </div>

      {/* Gear icon — top-right corner, fades with controls in fullscreen */}
      <button
        onClick={(e) => { e.stopPropagation(); setShowSettings((s) => !s); }}
        style={{ transition: 'opacity 0.3s ease', opacity: controlsVisible ? 1 : 0, pointerEvents: controlsVisible ? 'auto' : 'none' }}
        className={`absolute top-4 right-4 z-20 w-9 h-9 rounded-full flex items-center justify-center shadow-lg transition-colors ${
          showSettings ? 'bg-[#7c3aed] text-white' : 'bg-black/60 hover:bg-black/80 text-white'
        }`}
      >
        <GearIcon />
      </button>

      {/* Settings — right-side overlay */}
      {showSettings && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setShowSettings(false)} />
          <div className="fixed top-0 right-0 bottom-0 z-40 w-72 bg-[#0d0d0d] border-l border-[#2a2a2a] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-[#2a2a2a]">
              <p className="text-white font-semibold">Settings</p>
              <button onClick={() => setShowSettings(false)} className="text-[#888] hover:text-white text-lg leading-none">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Camera & Mic */}
              <div>
                <p className="text-[#a78bfa] text-xs font-semibold mb-3">Camera & Microphone</p>
                <DeviceSelector role="sender" onCameraChange={handleCameraChange} onMicChange={handleMicChange} />
              </div>

              {/* Incoming Feed */}
              <div className="pt-5 border-t border-[#2a2a2a]">
                <p className="text-[#a78bfa] text-xs font-semibold mb-3">Incoming Feed</p>
                <div className="space-y-2">
                  <FitButtons value={remoteFit} onChange={setRemoteFit} />
                  <FlipButton value={remoteFlipped} onChange={setRemoteFlipped} />
                  <p className="text-[#555] text-xs pt-1">Display Rotation</p>
                  <RotationControl currentRotation={remoteRotation} onRotate={setRemoteRotation} />
                </div>
                <div className="mt-3">
                  <p className="text-[#555] text-xs mb-2">Audio Output Device</p>
                  <DeviceSelector role="receiver" videoRef={remoteVideoRef} />
                </div>
              </div>

              {/* Your Preview */}
              <div className="pt-5 border-t border-[#2a2a2a]">
                <p className="text-[#a78bfa] text-xs font-semibold mb-3">Your Preview</p>
                <div className="space-y-2">
                  <FitButtons value={previewFit} onChange={setPreviewFit} />
                  <FlipButton value={previewFlipped} onChange={setPreviewFlipped} />
                  <p className="text-[#555] text-xs pt-1">Display Rotation <span className="text-[#3a3a3a]">(local only)</span></p>
                  <RotationControl currentRotation={previewDisplayRotation} onRotate={setPreviewDisplayRotation} />
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Controls bar */}
      <div
        className="absolute bottom-0 inset-x-0 z-20 px-4 pb-4 pt-12 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-300"
        style={{ opacity: controlsVisible ? 1 : 0, pointerEvents: controlsVisible ? 'auto' : 'none' }}
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
