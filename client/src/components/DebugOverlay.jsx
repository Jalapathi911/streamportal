import { useState, useEffect } from 'react';
import socket from '../utils/socket.js';

export default function DebugOverlay({ role, connectionState, iceGatheringState }) {
  const [visible, setVisible] = useState(false);
  const [socketState, setSocketState] = useState(socket.connected ? 'connected' : 'disconnected');

  useEffect(() => {
    function toggle(e) {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        setVisible((v) => !v);
      }
    }
    window.addEventListener('keydown', toggle);
    return () => window.removeEventListener('keydown', toggle);
  }, []);

  useEffect(() => {
    const onConnect = () => setSocketState('connected');
    const onDisconnect = () => setSocketState('disconnected');
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 border border-[#2a2a2a] rounded-xl p-4 text-xs font-mono z-50 min-w-48">
      <p className="text-[#7c3aed] font-bold mb-2">DEBUG (Ctrl+Shift+D)</p>
      <div className="space-y-1 text-[#ccc]">
        <p>Socket: <span className={socketState === 'connected' ? 'text-green-400' : 'text-red-400'}>{socketState}</span></p>
        <p>Role: <span className="text-white">{role || '—'}</span></p>
        <p>WebRTC: <span className="text-white">{connectionState || '—'}</span></p>
        <p>ICE: <span className="text-white">{iceGatheringState || '—'}</span></p>
      </div>
    </div>
  );
}
