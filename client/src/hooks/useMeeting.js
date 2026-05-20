import { useEffect, useRef, useState, useCallback } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import { apiFetch } from '../utils/api.js';
import socket from '../utils/socket.js';

export function useMeeting({ roomId, localStream }) {
  const clientRef           = useRef(null);
  const localVideoTrackRef  = useRef(null);
  const localAudioTrackRef  = useRef(null);
  const remoteAudioTrackRef = useRef(null);
  const localStreamRef      = useRef(localStream);

  const [remoteStream,    setRemoteStream]    = useState(null);
  const [connectionState, setConnectionState] = useState('disconnected');
  const [peerLeft,        setPeerLeft]        = useState(false);

  useEffect(() => { localStreamRef.current = localStream; }, [localStream]);

  // ── Join Agora RTC channel (two-way, both are hosts) ──────────────────────
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const res = await apiFetch(`/api/agora-token?channel=${encodeURIComponent(roomId)}&role=sender`);
      if (!res.ok || cancelled) return;
      const { token, appId } = await res.json();
      if (cancelled) return;

      // RTC mode — no host/audience distinction, both peers are equal
      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'h264' });
      clientRef.current = client;

      client.on('connection-state-change', (s) => setConnectionState(s.toLowerCase()));

      client.on('user-published', async (user, mediaType) => {
        await client.subscribe(user, mediaType);
        if (mediaType === 'video') {
          setRemoteStream(new MediaStream([user.videoTrack.getMediaStreamTrack()]));
        }
        if (mediaType === 'audio') {
          remoteAudioTrackRef.current = user.audioTrack;
          user.audioTrack.play();
        }
      });

      client.on('user-unpublished', (_, mediaType) => {
        if (mediaType === 'video') setRemoteStream(null);
      });

      client.on('user-left', () => {
        setRemoteStream(null);
        setPeerLeft(true);
      });

      await client.join(appId, roomId, token || null, null);

      // Publish local stream once joined
      const stream = localStreamRef.current;
      if (stream) {
        const videoMSTrack = stream.getVideoTracks()[0];
        const audioMSTrack = stream.getAudioTracks()[0];
        if (videoMSTrack) {
          const vt = AgoraRTC.createCustomVideoTrack({ mediaStreamTrack: videoMSTrack, frameRate: 30 });
          localVideoTrackRef.current = vt;
          await client.publish(vt);
        }
        if (audioMSTrack) {
          const at = AgoraRTC.createCustomAudioTrack({ mediaStreamTrack: audioMSTrack });
          localAudioTrackRef.current = at;
          await client.publish(at);
        }
      }

      // Register presence with Socket.io
      socket.emit('join-room', { roomId, role: 'participant' });
    }

    init().catch(console.error);

    return () => {
      cancelled = true;
      localVideoTrackRef.current?.close();
      localAudioTrackRef.current?.close();
      clientRef.current?.leave();
    };
  }, [roomId]);

  // ── Mic mute ──────────────────────────────────────────────────────────────
  const setMicMuted = useCallback((muted) => {
    localAudioTrackRef.current?.setEnabled(!muted);
  }, []);

  // ── Mic volume (how loud you are to others, 0–100) ────────────────────────
  const setMicVolume = useCallback((vol) => {
    localAudioTrackRef.current?.setVolume(vol);
  }, []);

  // ── Speaker volume (how loud remote sounds to you, 0–100) ─────────────────
  const setSpeakerVolume = useCallback((vol) => {
    remoteAudioTrackRef.current?.setVolume(vol);
  }, []);

  return {
    remoteStream,
    connectionState,
    peerLeft,
    setMicMuted,
    setMicVolume,
    setSpeakerVolume,
  };
}
