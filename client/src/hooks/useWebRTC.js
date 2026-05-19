import { useEffect, useRef, useState } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import { apiFetch } from '../utils/api.js';
import socket from '../utils/socket.js';

AgoraRTC.setLogLevel(4); // suppress verbose SDK logs in production

// Exported as useWebRTC to avoid touching SenderView/ReceiverView imports
export function useWebRTC({ role, roomId, localStream }) {
  const clientRef        = useRef(null);
  const videoTrackRef    = useRef(null);
  const audioTrackRef    = useRef(null);
  const joinedRef        = useRef(false);
  const localStreamRef   = useRef(localStream);

  const [remoteStream,     setRemoteStream]     = useState(null);
  const [connectionState,  setConnectionState]  = useState('disconnected');

  // Keep localStreamRef current so the join effect can read it without re-running
  useEffect(() => { localStreamRef.current = localStream; }, [localStream]);

  // ── Join Agora channel once per mount ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function publishStream(client, stream) {
      if (!stream) return;
      const videoMSTrack = stream.getVideoTracks()[0];
      const audioMSTrack = stream.getAudioTracks()[0];

      if (videoMSTrack) {
        const vt = AgoraRTC.createCustomVideoTrack({ mediaStreamTrack: videoMSTrack, frameRate: 30 });
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

      client.on('connection-state-change', (curState) => {
        setConnectionState(curState.toLowerCase());
      });

      if (role === 'receiver') {
        client.on('user-published', async (user, mediaType) => {
          await client.subscribe(user, mediaType);
          if (mediaType === 'video') {
            setRemoteStream(new MediaStream([user.videoTrack.getMediaStreamTrack()]));
          }
          if (mediaType === 'audio') {
            user.audioTrack.play();
          }
        });
        client.on('user-unpublished', (_, mediaType) => {
          if (mediaType === 'video') setRemoteStream(null);
        });
      }

      const agoraRole = role === 'sender' ? 'host' : 'audience';
      const opts      = role === 'receiver' ? { level: 1 } : undefined; // low-latency audience
      await client.setClientRole(agoraRole, opts);
      await client.join(appId, roomId, token || null, null);
      joinedRef.current = true;

      // Publish whatever stream is available at join time
      if (role === 'sender') await publishStream(client, localStreamRef.current);
    }

    init().catch(console.error);

    return () => {
      cancelled = true;
      videoTrackRef.current?.close();
      audioTrackRef.current?.close();
      clientRef.current?.leave();
      joinedRef.current = false;
    };
  }, [role, roomId]); // intentional: localStream changes handled below

  // ── Replace published tracks when localStream changes (sender only) ────────
  useEffect(() => {
    if (role !== 'sender' || !localStream || !joinedRef.current) return;
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
        const vt = AgoraRTC.createCustomVideoTrack({ mediaStreamTrack: videoMSTrack, frameRate: 30 });
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

  // ── Approximate bandwidth tracking for dashboard ───────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      const client = clientRef.current;
      if (!client || client.connectionState !== 'CONNECTED') return;
      const stats = client.getRTCStats();
      // SendBitrate + RecvBitrate are in bps; sample every 5s → bytes
      const deltaBytes = Math.round(((stats.SendBitrate || 0) + (stats.RecvBitrate || 0)) * 5 / 8);
      if (deltaBytes > 0) socket.emit('webrtc-stats', { roomId, deltaBytes });
    }, 5000);
    return () => clearInterval(interval);
  }, [roomId]);

  return {
    remoteStream,
    connectionState,
    iceGatheringState: connectionState, // compat alias for DebugOverlay
    slowWarning: false,                 // not applicable with Agora
    replaceTrack: () => {},             // no-op — track replacement via localStream effect
  };
}
