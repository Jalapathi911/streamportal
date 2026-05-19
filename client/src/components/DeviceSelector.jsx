import { useEffect, useRef } from 'react';
import { useDevices } from '../hooks/useDevices.js';

function Select({ label, value, onChange, options }) {
  return (
    <div>
      <label className="block text-[#888] text-xs mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7c3aed] transition-colors"
      >
        {options.map((d) => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.label || `Device ${d.deviceId.slice(0, 8)}`}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function DeviceSelector({ role, onCameraChange, onMicChange, onSpeakerChange, videoRef }) {
  const { cameras, microphones, speakers, refreshDevices } = useDevices();
  const speakerWarningRef = useRef(false);

  useEffect(() => {
    refreshDevices();
  }, []);

  async function handleCameraChange(deviceId) {
    if (onCameraChange) onCameraChange(deviceId);
  }

  async function handleMicChange(deviceId) {
    if (onMicChange) onMicChange(deviceId);
  }

  async function handleSpeakerChange(deviceId) {
    if (!videoRef?.current) return;
    if (typeof videoRef.current.setSinkId === 'function') {
      await videoRef.current.setSinkId(deviceId);
      if (onSpeakerChange) onSpeakerChange(deviceId);
    } else if (!speakerWarningRef.current) {
      speakerWarningRef.current = true;
      alert('Speaker selection is not supported in this browser. Please use Chrome or Edge.');
    }
  }

  return (
    <div className="space-y-3">
      {(role === 'sender') && (
        <>
          <Select
            label="Camera"
            value=""
            onChange={handleCameraChange}
            options={cameras}
          />
          <Select
            label="Microphone"
            value=""
            onChange={handleMicChange}
            options={microphones}
          />
        </>
      )}
      {(role === 'receiver') && (
        <Select
          label="Speaker"
          value=""
          onChange={handleSpeakerChange}
          options={speakers}
        />
      )}
    </div>
  );
}
