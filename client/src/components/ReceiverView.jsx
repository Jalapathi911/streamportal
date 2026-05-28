import { useEffect, useRef, useState, useCallback } from 'react';
import { useWebRTC } from '../hooks/useWebRTC.js';
import socket from '../utils/socket.js';
import DebugOverlay from './DebugOverlay.jsx';
import RotationControl from './RotationControl.jsx';
import DeviceSelector from './DeviceSelector.jsx';

const FIT_MODES = [
  { key: 'contain', label: 'Fit',     desc: 'Black bars, whole frame visible' },
  { key: 'cover',   label: 'Fill',    desc: 'Crop edges to fill screen' },
  { key: 'fill',    label: 'Stretch', desc: 'Stretch to fill exactly' },
  { key: 'none',    label: 'Native',  desc: 'Original feed size' },
];

function ConnectionBadge({ state }) {
  const dot = { connected:'bg-green-500', connecting:'bg-yellow-500', new:'bg-yellow-500', disconnected:'bg-red-500', failed:'bg-red-500', closed:'bg-[#555]' };
  return (
    <span className="flex items-center gap-2 text-sm text-[#888]">
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

export default function ReceiverView({ roomId }) {
  const remoteVideoRef  = useRef(null);
  const containerRef    = useRef(null);
  const hideTimerRef    = useRef(null);

  const [senderDisconnected, setSenderDisconnected] = useState(false);
  const [speakerMuted,       setSpeakerMuted]       = useState(false);
  const [displayRotation,    setDisplayRotation]    = useState(0);
  const [fitMode,            setFitMode]            = useState('cover');
  const [isFullscreen,       setIsFullscreen]       = useState(false);
  const [showOverlay,        setShowOverlay]        = useState(true);
  const [flipped,            setFlipped]            = useState(false);

  const { hasRemoteVideo, connectionState, iceGatheringState, slowWarning, setSpeakerMuted: setSpeakerMutedFn } = useWebRTC({
    role: 'receiver', roomId, localStream: null, remoteVideoRef,
  });

  // Auto-reconnect: clear disconnected screen when sender comes back
  useEffect(() => {
    if (hasRemoteVideo) setSenderDisconnected(false);
  }, [hasRemoteVideo]);

  // Sender disconnect via socket
  useEffect(() => {
    const h = ({ role }) => { if (role === 'sender') setSenderDisconnected(true); };
    socket.on('peer-disconnected', h);
    return () => socket.off('peer-disconnected', h);
  }, []);

  function handleSpeakerMute() {
    const next = !speakerMuted;
    setSpeakerMuted(next);
    setSpeakerMutedFn(next);
  }

  // Fullscreen
  useEffect(() => {
    const onChange = () => {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      setShowOverlay(!fs);
      clearTimeout(hideTimerRef.current);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const revealOverlay = useCallback(() => {
    clearTimeout(hideTimerRef.current);
    setShowOverlay(true);
    hideTimerRef.current = setTimeout(() => setShowOverlay(false), 3000);
  }, []);

  const onMouseMove = useCallback(() => {
    if (isFullscreen) revealOverlay();
  }, [isFullscreen, revealOverlay]);

  useEffect(() => () => clearTimeout(hideTimerRef.current), []);

  const enterFullscreen = useCallback(async () => {
    try { await containerRef.current?.requestFullscreen(); } catch { /* denied */ }
  }, []);

  const exitFullscreen = useCallback(async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
  }, []);

  const videoStyle = {
    objectFit:  fitMode,
    transform: `rotate(${displayRotation}deg) scaleX(${flipped ? -1 : 1})`,
    transition: 'transform 0.3s ease',
    width:  '100%',
    height: '100%',
    display: 'block',
  };

  // Disconnected screen — still shown but sender reconnect clears it
  if (senderDisconnected && !hasRemoteVideo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-[#7c3aed] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-xl font-semibold text-white mb-2">Sender Disconnected</p>
          <p className="text-[#888] text-sm">Waiting for sender to reconnect…</p>
        </div>
      </div>
    );
  }

  const overlayBar = (
    <div
      className="absolute inset-x-0 bottom-0 z-10 px-4 pb-4 pt-12 bg-gradient-to-t from-black/90 via-black/40 to-transparent"
      style={{ transition: 'opacity 0.3s ease', opacity: showOverlay ? 1 : 0, pointerEvents: showOverlay ? 'auto' : 'none' }}
      onMouseEnter={() => clearTimeout(hideTimerRef.current)}
      onMouseLeave={() => { if (isFullscreen) revealOverlay(); }}
    >
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-[#aaa] text-xs mr-1 whitespace-nowrap">Feed Size:</span>
        {FIT_MODES.map(({ key, label, desc }) => (
          <button key={key} title={desc} onClick={() => setFitMode(key)}
            className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
              fitMode === key ? 'bg-[#7c3aed] text-white' : 'bg-white/10 text-[#ccc] hover:bg-white/20 hover:text-white'
            }`}
          >{label}</button>
        ))}
        <div className="w-px h-4 bg-white/20 mx-1" />
        <button onClick={() => setFlipped(f => !f)}
          className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
            flipped ? 'bg-[#7c3aed] text-white' : 'bg-white/10 text-[#ccc] hover:bg-white/20 hover:text-white'
          }`}
        >⇄ Flip</button>
        <div className="w-px h-4 bg-white/20 mx-1" />
        <button onClick={handleSpeakerMute} title={speakerMuted ? 'Unmute speaker' : 'Mute speaker'}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
            speakerMuted ? 'bg-red-600 hover:bg-red-500' : 'bg-white/10 hover:bg-white/20'
          }`}
        >
          {speakerMuted ? <SpeakerOffIcon /> : <SpeakerOnIcon />}
        </button>
      </div>

      <div className="flex items-center justify-between">
        <ConnectionBadge state={connectionState} />
        {isFullscreen && (
          <button onClick={exitFullscreen}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-4 py-1.5 rounded-full transition-colors"
          >
            ✕ Exit Fullscreen <kbd className="opacity-50 ml-1">ESC</kbd>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6">
      <div
        ref={containerRef}
        onMouseMove={onMouseMove}
        onClick={() => { if (isFullscreen) revealOverlay(); }}
        className="relative bg-black overflow-hidden"
        style={isFullscreen
          ? { width: '100%', height: '100%' }
          : { width: '100%', maxWidth: '320px', aspectRatio: '9/16', borderRadius: '12px', border: '1px solid #2a2a2a' }
        }
      >
        {/* Always rendered so Agora play() has a DOM target */}
        <video ref={remoteVideoRef} autoPlay playsInline style={{ ...videoStyle, display: hasRemoteVideo ? 'block' : 'none' }} />

        {!hasRemoteVideo && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#141414]">
            <div className="w-8 h-8 border-2 border-[#7c3aed] border-t-transparent rounded-full animate-spin" />
            <p className="text-[#888] text-sm">Waiting for sender…</p>
          </div>
        )}

        {overlayBar}
      </div>

      {!isFullscreen && (
        <>
          <div className="mt-3 mb-4 space-y-1 text-center">
            <ConnectionBadge state={connectionState} />
          </div>

          <div className="w-full max-w-xs bg-[#141414] border border-[#2a2a2a] rounded-xl p-5 space-y-4">

            {/* Speaker mute */}
            <div>
              <p className="text-white font-semibold mb-3">Audio</p>
              <button onClick={handleSpeakerMute}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors border ${
                  speakerMuted
                    ? 'bg-red-600 border-red-600 text-white hover:bg-red-500'
                    : 'bg-[#0a0a0a] border-[#2a2a2a] text-[#888] hover:border-[#7c3aed] hover:text-white'
                }`}
              >
                {speakerMuted ? <SpeakerOffIcon /> : <SpeakerOnIcon />}
                {speakerMuted ? 'Speaker Muted' : 'Mute Speaker'}
              </button>
            </div>

            {/* Feed Size + Flip */}
            <div>
              <p className="text-white font-semibold mb-3">Feed Size</p>
              <div className="grid grid-cols-4 gap-1 mb-2">
                {FIT_MODES.map(({ key, label, desc }) => (
                  <button key={key} title={desc} onClick={() => setFitMode(key)}
                    className={`py-2 rounded-lg text-xs font-semibold transition-colors border ${
                      fitMode === key
                        ? 'bg-[#7c3aed] border-[#7c3aed] text-white'
                        : 'bg-[#0a0a0a] border-[#2a2a2a] text-[#888] hover:border-[#7c3aed] hover:text-white'
                    }`}
                  >{label}</button>
                ))}
              </div>
              <button onClick={() => setFlipped(f => !f)}
                className={`w-full py-2 rounded-lg text-xs font-semibold transition-colors border ${
                  flipped
                    ? 'bg-[#7c3aed] border-[#7c3aed] text-white'
                    : 'bg-[#0a0a0a] border-[#2a2a2a] text-[#888] hover:border-[#7c3aed] hover:text-white'
                }`}
              >⇄ Mirror / Flip {flipped ? '(ON)' : '(OFF)'}</button>
            </div>

            {/* Rotation */}
            <div>
              <p className="text-white font-semibold mb-3">Display Rotation</p>
              <RotationControl currentRotation={displayRotation} onRotate={setDisplayRotation} />
            </div>

            {/* Speaker device */}
            <div>
              <p className="text-white font-semibold mb-3">Audio Output</p>
              <DeviceSelector role="receiver" videoRef={remoteVideoRef} />
            </div>

            <button onClick={enterFullscreen}
              className="w-full bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-semibold py-2.5 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M1.5 1h4a.5.5 0 0 1 0 1H2v3.5a.5.5 0 0 1-1 0V1.5A.5.5 0 0 1 1.5 1zm9 0h4a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-1 0V2h-3.5a.5.5 0 0 1 0-1zM1 10.5a.5.5 0 0 1 .5-.5H5v-3.5a.5.5 0 0 1 1 0V10.5a.5.5 0 0 1-.5.5H1.5a.5.5 0 0 1-.5-.5zm9 3a.5.5 0 0 1 .5-.5H14v-3.5a.5.5 0 0 1 1 0V14.5a.5.5 0 0 1-.5.5h-4a.5.5 0 0 1-.5-.5z"/>
              </svg>
              Fullscreen
            </button>
          </div>
        </>
      )}

      <DebugOverlay role="receiver" connectionState={connectionState} iceGatheringState={iceGatheringState} />
    </div>
  );
}
