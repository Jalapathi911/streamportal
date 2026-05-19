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

export default function ReceiverView({ roomId }) {
  const remoteVideoRef  = useRef(null);
  const containerRef    = useRef(null);
  const hideTimerRef    = useRef(null);

  const [senderDisconnected, setSenderDisconnected] = useState(false);
  const [displayRotation, setDisplayRotation]       = useState(0);
  const [fitMode,          setFitMode]              = useState('cover');
  const [isFullscreen,     setIsFullscreen]         = useState(false);
  const [showOverlay,      setShowOverlay]          = useState(true);
  const [flipped,          setFlipped]              = useState(false);

  const { remoteStream, connectionState, iceGatheringState, slowWarning } = useWebRTC({
    role: 'receiver', roomId, localStream: null,
  });

  /* ── stream → video element ── */
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream)
      remoteVideoRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  /* ── sender disconnect ── */
  useEffect(() => {
    const h = ({ role }) => { if (role === 'sender') setSenderDisconnected(true); };
    socket.on('peer-disconnected', h);
    return () => socket.off('peer-disconnected', h);
  }, []);

  /* ── track browser fullscreen state (ESC key handled natively) ── */
  useEffect(() => {
    const onChange = () => {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      // hide controls immediately on enter; restore on exit
      setShowOverlay(!fs);
      clearTimeout(hideTimerRef.current);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  /* ── show overlay for 3s then hide (only in fullscreen) ── */
  const revealOverlay = useCallback(() => {
    clearTimeout(hideTimerRef.current);
    setShowOverlay(true);
    hideTimerRef.current = setTimeout(() => setShowOverlay(false), 3000);
  }, []);

  const onMouseMove = useCallback(() => {
    if (isFullscreen) revealOverlay();
  }, [isFullscreen, revealOverlay]);

  useEffect(() => () => clearTimeout(hideTimerRef.current), []);

  /* ── fullscreen helpers ── */
  const enterFullscreen = useCallback(async () => {
    try { await containerRef.current?.requestFullscreen(); }
    catch { /* browser denied */ }
  }, []);

  const exitFullscreen = useCallback(async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
  }, []);

  /* ── video style ── */
  const videoStyle = {
    objectFit:  fitMode,
    transform: `rotate(${displayRotation}deg) scaleX(${flipped ? -1 : 1})`,
    transition: 'transform 0.3s ease',
    width:  '100%',
    height: '100%',
    display: 'block',
  };

  /* ── disconnected screen ── */
  if (senderDisconnected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <p className="text-xl font-semibold text-white mb-2">Sender Disconnected</p>
          <p className="text-[#888] text-sm">Waiting for sender to reconnect…</p>
        </div>
      </div>
    );
  }

  /* ── overlay bar (used in both fullscreen and normal mode) ── */
  const overlayBar = (
    <div
      className="absolute inset-x-0 bottom-0 z-10 px-4 pb-4 pt-12 bg-gradient-to-t from-black/90 via-black/40 to-transparent"
      style={{ transition: 'opacity 0.3s ease', opacity: showOverlay ? 1 : 0, pointerEvents: showOverlay ? 'auto' : 'none' }}
      onMouseEnter={() => clearTimeout(hideTimerRef.current)} // don't hide while hovering controls
      onMouseLeave={() => { if (isFullscreen) revealOverlay(); }}
    >
      {/* Feed Size + Flip row */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-[#aaa] text-xs mr-1 whitespace-nowrap">Feed Size:</span>
        {FIT_MODES.map(({ key, label, desc }) => (
          <button
            key={key}
            title={desc}
            onClick={() => setFitMode(key)}
            className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
              fitMode === key
                ? 'bg-[#7c3aed] text-white'
                : 'bg-white/10 text-[#ccc] hover:bg-white/20 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
        <div className="w-px h-4 bg-white/20 mx-1" />
        <button
          title="Mirror / flip horizontally"
          onClick={() => setFlipped(f => !f)}
          className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
            flipped
              ? 'bg-[#7c3aed] text-white'
              : 'bg-white/10 text-[#ccc] hover:bg-white/20 hover:text-white'
          }`}
        >
          ⇄ Flip
        </button>
      </div>

      {/* Bottom row: status left, exit right */}
      <div className="flex items-center justify-between">
        <ConnectionBadge state={connectionState} />
        {isFullscreen && (
          <button
            onClick={exitFullscreen}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-4 py-1.5 rounded-full transition-colors"
          >
            ✕ Exit Fullscreen <kbd className="opacity-50 ml-1">ESC</kbd>
          </button>
        )}
      </div>
    </div>
  );

  /* ── main render ── */
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6">

      {/* ── Video container — this element goes fullscreen ── */}
      <div
        ref={containerRef}
        onMouseMove={onMouseMove}
        onClick={() => { if (isFullscreen) revealOverlay(); }}
        className="relative bg-black overflow-hidden"
        style={isFullscreen
          ? { width: '100%', height: '100%' }                          // browser fills the rest
          : { width: '100%', maxWidth: '320px', aspectRatio: '9/16',
              borderRadius: '12px', border: '1px solid #2a2a2a' }
        }
      >
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          style={videoStyle}
        />

        {/* Waiting spinner */}
        {!remoteStream && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#141414]">
            <div className="w-8 h-8 border-2 border-[#7c3aed] border-t-transparent rounded-full animate-spin" />
            <p className="text-[#888] text-sm">Waiting for sender…</p>
          </div>
        )}

        {/* Overlay — always rendered inside container so it works in fullscreen */}
        {overlayBar}
      </div>

      {/* ── Normal-mode controls panel (hidden when fullscreen) ── */}
      {!isFullscreen && (
        <>
          <div className="mt-3 mb-4 space-y-1 text-center">
            <ConnectionBadge state={connectionState} />
            {slowWarning && (
              <p className="text-yellow-400 text-xs">Connection is slow — may need TURN relay</p>
            )}
          </div>

          <div className="w-full max-w-xs bg-[#141414] border border-[#2a2a2a] rounded-xl p-5 space-y-4">

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
              <button
                onClick={() => setFlipped(f => !f)}
                className={`w-full py-2 rounded-lg text-xs font-semibold transition-colors border ${
                  flipped
                    ? 'bg-[#7c3aed] border-[#7c3aed] text-white'
                    : 'bg-[#0a0a0a] border-[#2a2a2a] text-[#888] hover:border-[#7c3aed] hover:text-white'
                }`}
              >
                ⇄ Mirror / Flip {flipped ? '(ON)' : '(OFF)'}
              </button>
            </div>

            {/* Rotation */}
            <div>
              <p className="text-white font-semibold mb-3">Display Rotation</p>
              <RotationControl currentRotation={displayRotation} onRotate={setDisplayRotation} />
            </div>

            {/* Speaker */}
            <div>
              <p className="text-white font-semibold mb-3">Audio Output</p>
              <DeviceSelector role="receiver" videoRef={remoteVideoRef} />
            </div>

            {/* Fullscreen button */}
            <button
              onClick={enterFullscreen}
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
