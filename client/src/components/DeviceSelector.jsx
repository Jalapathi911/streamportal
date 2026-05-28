import { useEffect, useRef, useState } from 'react';
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

  const [selectedCam,     setSelectedCam]     = useState('');
  const [selectedMic,     setSelectedMic]     = useState('');
  const [selectedSpeaker, setSelectedSpeaker] = useState('');

  useEffect(() => { refreshDevices(); }, []);

  // Set defaults when device lists first load
  useEffect(() => {
    if (cameras.length     && !selectedCam)     setSelectedCam(cameras[0].deviceId);
  }, [cameras]);
  useEffect(() => {
    if (microphones.length && !selectedMic)     setSelectedMic(microphones[0].deviceId);
  }, [microphones]);
  useEffect(() => {
    if (speakers.length    && !selectedSpeaker) setSelectedSpeaker(speakers[0].deviceId);
  }, [speakers]);

  function handleCameraChange(deviceId) {
    setSelectedCam(deviceId);
    if (onCameraChange) onCameraChange(deviceId);
  }

  function handleMicChange(deviceId) {
    setSelectedMic(deviceId);
    if (onMicChange) onMicChange(deviceId);
  }

  async function handleSpeakerChange(deviceId) {
    setSelectedSpeaker(deviceId);
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
      {role === 'sender' && (
        <>
          <Select label="Camera"     value={selectedCam} onChange={handleCameraChange} options={cameras}      />
          <Select label="Microphone" value={selectedMic} onChange={handleMicChange}    options={microphones}  />
        </>
      )}
      {role === 'receiver' && (
        <Select label="Speaker" value={selectedSpeaker} onChange={handleSpeakerChange} options={speakers} />
      )}
    </div>
  );
}
