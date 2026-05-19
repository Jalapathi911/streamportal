import { useState, useEffect, useRef, useCallback } from 'react';
import { useWebRTC } from '../hooks/useWebRTC.js';
import { useCanvasPipeline } from '../hooks/useCanvasPipeline.js';
import DebugOverlay from './DebugOverlay.jsx';
import RotationControl from './RotationControl.jsx';
import DeviceSelector from './DeviceSelector.jsx';

function ConnectionBadge({ state }) {
  const colors = {
    connected: 'bg-green-500',
    connecting: 'bg-yellow-500',
    new: 'bg-yellow-500',
    disconnected: 'bg-red-500',
    failed: 'bg-red-500',
    closed: 'bg-[#888]',
  };
  return (
    <span className="flex items-center gap-2 text-sm text-[#888]">
      <span className={`w-2 h-2 rounded-full ${colors[state] || 'bg-[#888]'}`} />
      {state}
    </span>
  );
}

function useRecording(stream, roomId) {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const startRecording = useCallback(() => {
    if (!stream) return;
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recording-${roomId}-${Date.now()}.webm`;
      a.click();
      URL.revokeObjectURL(url);
    };
    recorder.start(1000);
    recorderRef.current = recorder;
    setIsRecording(true);
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
  }, [stream, roomId]);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    clearInterval(timerRef.current);
    setIsRecording(false);
  }, []);

  useEffect(() => () => clearInterval(timerRef.current), []);

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  return { isRecording, timer: `${mm}:${ss}`, startRecording, stopRecording };
}

export default function SenderView({ roomId }) {
  const [rawStream, setRawStream] = useState(null);
  const [mediaError, setMediaError] = useState('');
  const localVideoRef = useRef(null);
  const selectedCamera = useRef(null);
  const selectedMic = useRef(null);

  async function startCamera(cameraId, micId) {
    try {
      const constraints = {
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30, max: 60 },
          ...(cameraId ? { deviceId: { exact: cameraId } } : {}),
        },
        audio: micId ? { deviceId: { exact: micId } } : true,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setRawStream((prev) => {
        prev?.getTracks().forEach((t) => t.stop());
        return stream;
      });
    } catch (err) {
      setMediaError(`Camera error: ${err.message}`);
    }
  }

  useEffect(() => {
    startCamera(null, null);
    return () => {
      setRawStream((prev) => { prev?.getTracks().forEach((t) => t.stop()); return null; });
    };
  }, []);

  const { correctedStream, rotationDegrees, setRotation } = useCanvasPipeline(rawStream);

  // Canvas pipeline outputs video only — merge with raw audio tracks for WebRTC
  const [webrtcStream, setWebrtcStream] = useState(null);
  useEffect(() => {
    if (!correctedStream) return;
    const combined = new MediaStream();
    correctedStream.getVideoTracks().forEach((t) => combined.addTrack(t));
    rawStream?.getAudioTracks().forEach((t) => combined.addTrack(t));
    setWebrtcStream(combined);
  }, [correctedStream, rawStream]);

  useEffect(() => {
    if (localVideoRef.current && correctedStream) {
      localVideoRef.current.srcObject = correctedStream;
    }
  }, [correctedStream]);

  const { connectionState, iceGatheringState, viewerCount } = useWebRTC({
    role: 'sender',
    roomId,
    localStream: webrtcStream,
  });

  const { isRecording, timer, startRecording, stopRecording } = useRecording(webrtcStream, roomId);

  async function handleCameraChange(deviceId) {
    selectedCamera.current = deviceId;
    await startCamera(deviceId, selectedMic.current);
  }

  async function handleMicChange(deviceId) {
    selectedMic.current = deviceId;
    await startCamera(selectedCamera.current, deviceId);
  }

  if (mediaError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <p className="text-red-400">{mediaError}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col lg:flex-row gap-6 p-6">
      {/* Left: corrected portrait preview */}
      <div className="flex-1 flex flex-col items-center">
        <div className="w-full max-w-xs aspect-[9/16] bg-[#141414] border border-[#2a2a2a] rounded-xl overflow-hidden relative">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          {!correctedStream && (
            <div className="absolute inset-0 flex items-center justify-center text-[#888] text-sm">
              Starting camera…
            </div>
          )}
          {isRecording && (
            <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 rounded-full px-3 py-1">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-white text-xs font-mono">{timer}</span>
            </div>
          )}
        </div>
        <div className="mt-3 flex items-center gap-4">
          <ConnectionBadge state={connectionState} />
          <span className="flex items-center gap-1.5 text-sm text-[#888]">
            <span className="w-2 h-2 rounded-full bg-[#7c3aed]" />
            {viewerCount} viewer{viewerCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Right: controls */}
      <div className="w-full lg:w-72 flex flex-col gap-4">
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5">
          <p className="text-white font-semibold mb-4">Devices</p>
          <DeviceSelector
            role="sender"
            onCameraChange={handleCameraChange}
            onMicChange={handleMicChange}
          />
        </div>

        <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5">
          <p className="text-white font-semibold mb-3">Camera Rotation (portrait correction)</p>
          <RotationControl
            currentRotation={rotationDegrees}
            onRotate={setRotation}
          />
        </div>

        <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5">
          <p className="text-white font-semibold mb-3">Recording</p>
          {!isRecording ? (
            <button
              onClick={startRecording}
              disabled={!correctedStream}
              className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-2 rounded-lg transition-colors text-sm"
            >
              Start Recording
            </button>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-white font-mono text-sm">{timer}</span>
              </div>
              <button
                onClick={stopRecording}
                className="w-full bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white font-semibold py-2 rounded-lg transition-colors text-sm"
              >
                Stop & Download
              </button>
            </div>
          )}
        </div>
      </div>

      <DebugOverlay role="sender" connectionState={connectionState} iceGatheringState={iceGatheringState} />
    </div>
  );
}
