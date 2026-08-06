import { useEffect, useRef, useState, useCallback } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import { apiFetch } from '../utils/api.js';
import socket from '../utils/socket.js';

AgoraRTC.setLogLevel(4);

const isMobile    = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth <= 768;
const BITRATE_MAX = isMobile ? 2000 : 4000;

export function useWebRTC({ role, roomId, localStream, remoteVideoRef }) {
  const clientRef           = useRef(null);
  const videoTrackRef       = useRef(null);
  const audioTrackRef       = useRef(null);
  const remoteAudioTrackRef = useRef(null);
  const joinedRef           = useRef(false);
  const localStreamRef      = useRef(localStream);

  const [hasRemoteVideo,  setHasRemoteVideo]  = useState(false);
  const [connectionState, setConnectionState] = useState('disconnected');
  const [viewerCount,     setViewerCount]     = useState(0);

  useEffect(() => { localStreamRef.current = localStream; }, [localStream]);

  useEffect(() => {
    let cancelled = false;

    async function publishStream(client, stream) {
      if (!stream) return;
      const videoMSTrack = stream.getVideoTracks()[0];
      const audioMSTrack = stream.getAudioTracks()[0];
      if (videoMSTrack) {
        const vt = AgoraRTC.createCustomVideoTrack({
          mediaStreamTrack: videoMSTrack,
          frameRate: 30,
          bitrateMin: 1000,
          bitrateMax: BITRATE_MAX,
          optimizationMode: 'detail',
        });
        videoTrackRef.current = vt;
        await client.publish(vt);
      }
      if (audioMSTrack) {
        const at = AgoraRTC.createCustomAudioTrack({ mediaStreamTrack: audioMSTrack });
        audioTrackRef.current = at;
        await client.publish(at);
      }
    }

    async function init() {
      const res = await apiFetch(`/api/agora-token?channel=${encodeURIComponent(roomId)}&role=${role}`);
      if (!res.ok || cancelled) return;
      const { token, appId } = await res.json();
      if (cancelled) return;

      const client = AgoraRTC.createClient({ mode: 'live', codec: 'h264' });
      clientRef.current = client;

      client.on('connection-state-change', (curState) => setConnectionState(curState.toLowerCase()));

      if (role === 'receiver') {
        client.on('user-published', async (user, mediaType) => {
          await client.subscribe(user, mediaType);
          if (mediaType === 'video') {
            setHasRemoteVideo(true);
            if (remoteVideoRef?.current) user.videoTrack.play(remoteVideoRef.current);
          }
          if (mediaType === 'audio') {
            remoteAudioTrackRef.current = user.audioTrack;
            user.audioTrack.play();
          }
        });
        client.on('user-unpublished', (_, mediaType) => {
          if (mediaType === 'video') setHasRemoteVideo(false);
        });
        client.on('user-left', () => setHasRemoteVideo(false));
      }

      if (role === 'sender') {
        client.on('user-joined', () => setViewerCount((n) => n + 1));
        client.on('user-left',   () => setViewerCount((n) => Math.max(0, n - 1)));
      }

      const agoraRole = (role === 'sender' || role === 'receiver') ? 'host' : 'audience';
      await client.setClientRole(agoraRole);
      await client.join(appId, roomId, token || null, null);
      joinedRef.current = true;

      if (role === 'sender' || role === 'receiver') await publishStream(client, localStreamRef.current);
    }

    init().catch(console.error);

    return () => {
      cancelled = true;
      videoTrackRef.current?.close();
      audioTrackRef.current?.close();
      clientRef.current?.leave();
      joinedRef.current = false;
    };
  }, [role, roomId]);

  // Replace published tracks when localStream changes (sender only)
  useEffect(() => {
    if (!['sender', 'receiver'].includes(role) || !localStream || !joinedRef.current) return;
    const client = clientRef.current;
    if (!client || client.connectionState !== 'CONNECTED') return;

    async function replaceStream() {
      const videoMSTrack = localStream.getVideoTracks()[0];
      const audioMSTrack = localStream.getAudioTracks()[0];

      if (videoTrackRef.current) {
        await client.unpublish(videoTrackRef.current);
        videoTrackRef.current.close();
        videoTrackRef.current = null;
      }
      if (audioTrackRef.current) {
        await client.unpublish(audioTrackRef.current);
        audioTrackRef.current.close();
        audioTrackRef.current = null;
      }

      if (videoMSTrack) {
        const vt = AgoraRTC.createCustomVideoTrack({
          mediaStreamTrack: videoMSTrack,
          frameRate: 30,
          bitrateMin: 1000,
          bitrateMax: BITRATE_MAX,
          optimizationMode: 'detail',
        });
        videoTrackRef.current = vt;
        await client.publish(vt);
      }
      if (audioMSTrack) {
        const at = AgoraRTC.createCustomAudioTrack({ mediaStreamTrack: audioMSTrack });
        audioTrackRef.current = at;
        await client.publish(at);
      }
    }

    replaceStream().catch(console.error);
  }, [localStream, role]);

  // Bandwidth + resolution tracking (every 5 s)
  useEffect(() => {
    const interval = setInterval(() => {
      const client = clientRef.current;
      if (!client || client.connectionState !== 'CONNECTED') return;
      const stats = client.getRTCStats();
      const deltaBytes = Math.round(((stats.SendBitrate || 0) + (stats.RecvBitrate || 0)) * 5 / 8);
      const vTrack = localStreamRef.current?.getVideoTracks()[0];
      const { width = 0, height = 0 } = vTrack?.getSettings() || {};
      socket.emit('webrtc-stats', { roomId, deltaBytes, width, height, role });
    }, 5000);
    return () => clearInterval(interval);
  }, [roomId, role]);

  const setMicMuted = useCallback((muted) => {
    audioTrackRef.current?.setEnabled(!muted);
  }, []);

  const setSpeakerMuted = useCallback((muted) => {
    remoteAudioTrackRef.current?.setVolume(muted ? 0 : 100);
  }, []);

  return {
    hasRemoteVideo,
    connectionState,
    viewerCount,
    iceGatheringState: connectionState,
    slowWarning: false,
    replaceTrack: () => {},
    setMicMuted,
    setSpeakerMuted,
  };
}
