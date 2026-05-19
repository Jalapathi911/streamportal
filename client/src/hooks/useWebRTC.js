import { useEffect, useRef, useState, useCallback } from 'react';
import socket from '../utils/socket.js';

const ICE_SERVERS = [
  { urls: import.meta.env.VITE_STUN_URL || 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  ...(import.meta.env.VITE_TURN_URL
    ? [{
        urls: import.meta.env.VITE_TURN_URL,
        username: import.meta.env.VITE_TURN_USERNAME,
        credential: import.meta.env.VITE_TURN_CREDENTIAL,
      }]
    : []),
];

// Inject bandwidth cap into SDP (2500kbps for video)
function capVideoBandwidth(sdp) {
  return sdp.replace(/a=mid:video\r\n/g, 'a=mid:video\r\nb=AS:2500\r\n');
}

export function useWebRTC({ role, roomId, localStream }) {
  const pcRef = useRef(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [connectionState, setConnectionState] = useState('new');
  const [iceGatheringState, setIceGatheringState] = useState('new');
  const [slowWarning, setSlowWarning] = useState(false);
  const slowTimerRef = useRef(null);

  const createPC = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onconnectionstatechange = () => {
      setConnectionState(pc.connectionState);
      if (pc.connectionState === 'connected') {
        clearTimeout(slowTimerRef.current);
        setSlowWarning(false);
      }
    };

    pc.onicegatheringstatechange = () => {
      setIceGatheringState(pc.iceGatheringState);
    };

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        socket.emit('ice-candidate', { roomId, candidate });
      }
    };

    if (role === 'receiver') {
      const stream = new MediaStream();
      setRemoteStream(stream);
      pc.ontrack = ({ track }) => {
        stream.addTrack(track);
        setRemoteStream(new MediaStream(stream.getTracks()));
      };
    }

    return pc;
  }, [role, roomId]);

  useEffect(() => {
    const pc = createPC();
    pcRef.current = pc;

    if (role === 'sender' && localStream) {
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });
    }

    // Warn if ICE takes >10 seconds
    slowTimerRef.current = setTimeout(() => {
      if (pc.connectionState !== 'connected') {
        setSlowWarning(true);
      }
    }, 10000);

    const handlePeerJoined = async () => {
      if (role === 'sender') {
        const offer = await pc.createOffer();
        // Apply H264 preference and bandwidth cap
        const modifiedSdp = capVideoBandwidth(offer.sdp);
        const modifiedOffer = { type: offer.type, sdp: modifiedSdp };
        await pc.setLocalDescription(modifiedOffer);
        socket.emit('offer', { roomId, sdp: modifiedOffer });
      }
    };

    const handleOffer = async ({ sdp }) => {
      if (role === 'receiver') {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('answer', { roomId, sdp: answer });
      }
    };

    const handleAnswer = async ({ sdp }) => {
      if (role === 'sender') {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      }
    };

    const handleIceCandidate = async ({ candidate }) => {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // ignore stale candidates
      }
    };

    socket.on('peer-joined', handlePeerJoined);
    socket.on('offer', handleOffer);
    socket.on('answer', handleAnswer);
    socket.on('ice-candidate', handleIceCandidate);

    return () => {
      clearTimeout(slowTimerRef.current);
      socket.off('peer-joined', handlePeerJoined);
      socket.off('offer', handleOffer);
      socket.off('answer', handleAnswer);
      socket.off('ice-candidate', handleIceCandidate);
      pc.close();
    };
  }, [role, roomId, localStream, createPC]);

  // Poll WebRTC stats every 5s — report bytes delta + relay type to server
  useEffect(() => {
    let lastBytes = 0;
    const interval = setInterval(async () => {
      const pc = pcRef.current;
      if (!pc || pc.connectionState !== 'connected') return;

      try {
        const stats = await pc.getStats();
        let totalBytes = 0;
        let isRelay = false;

        stats.forEach((r) => {
          if (r.type === 'transport') {
            totalBytes += (r.bytesSent || 0) + (r.bytesReceived || 0);
          }
          if (r.type === 'candidate-pair' && r.nominated) {
            isRelay = r.remoteCandidateId
              ? [...stats.values()].find(
                  (s) => s.id === r.localCandidateId && s.candidateType === 'relay'
                ) !== undefined
              : false;
          }
        });

        const delta = totalBytes - lastBytes;
        if (delta > 0) {
          socket.emit('webrtc-stats', { roomId, deltaBytes: delta });
          lastBytes = totalBytes;
        }
      } catch {
        // stats not available yet
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [roomId]);

  const replaceTrack = useCallback((newTrack, kind) => {
    const pc = pcRef.current;
    if (!pc) return;
    const sender = pc.getSenders().find((s) => s.track && s.track.kind === kind);
    if (sender) sender.replaceTrack(newTrack);
  }, []);

  return {
    peerConnection: pcRef.current,
    remoteStream,
    connectionState,
    iceGatheringState,
    slowWarning,
    replaceTrack,
  };
}
