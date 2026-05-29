import { useEffect, useRef, useState, useCallback } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import { apiFetch } from '../utils/api.js';
import socket from '../utils/socket.js';

export function useMeeting({ roomId, localStream, remoteVideoRef }) {
  const clientRef           = useRef(null);
  const localVideoTrackRef  = useRef(null);
  const localAudioTrackRef  = useRef(null);
  const remoteAudioTrackRef = useRef(null);
  const remoteVideoTrackRef = useRef(null);
  const localStreamRef      = useRef(localStream);
  const joinedRef           = useRef(false);
  const replacingRef        = useRef(false);   // guard against concurrent replaceStream calls
  const micMutedRef         = useRef(false);   // persists mute state across track replacement
  const speakerMutedRef     = useRef(false);   // persists across remote track re-subscription
  const speakerVolRef       = useRef(100);

  const [hasRemoteVideo,  setHasRemoteVideo]  = useState(false);
  const [connectionState, setConnectionState] = useState('disconnected');
  const [peerLeft,        setPeerLeft]        = useState(false);

  useEffect(() => { localStreamRef.current = localStream; }, [localStream]);

  // ── Join Agora RTC channel ────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const res = await apiFetch(`/api/agora-token?channel=${encodeURIComponent(roomId)}&role=sender`);
      if (!res.ok || cancelled) return;
      const { token, appId } = await res.json();
      if (cancelled) return;

      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      clientRef.current = client;

      client.on('connection-state-change', (s) => setConnectionState(s.toLowerCase()));

      client.on('user-published', async (user, mediaType) => {
        await client.subscribe(user, mediaType);
        if (mediaType === 'video') {
          remoteVideoTrackRef.current = user.videoTrack;
          setHasRemoteVideo(true);
          if (remoteVideoRef?.current) user.videoTrack.play(remoteVideoRef.current);
        }
        if (mediaType === 'audio') {
          remoteAudioTrackRef.current = user.audioTrack;
          user.audioTrack.play();
          // Re-apply speaker mute/volume — new track always starts at 100%
          user.audioTrack.setVolume(speakerMutedRef.current ? 0 : speakerVolRef.current);
        }
      });

      client.on('user-unpublished', (_, mediaType) => {
        if (mediaType === 'video') {
          remoteVideoTrackRef.current = null;
          setHasRemoteVideo(false);
        }
      });

      client.on('user-left', () => {
        remoteVideoTrackRef.current = null;
        setHasRemoteVideo(false);
        setPeerLeft(true);
      });

      await client.join(appId, roomId, token || null, null);
      joinedRef.current = true;

      const stream = localStreamRef.current;
      if (stream) {
        const videoMSTrack = stream.getVideoTracks()[0];
        const audioMSTrack = stream.getAudioTracks()[0];
        if (videoMSTrack) {
          const vt = AgoraRTC.createCustomVideoTrack({
            mediaStreamTrack: videoMSTrack,
            frameRate: 30,
            bitrateMin: 1000,
            bitrateMax: 4000,
            optimizationMode: 'detail',
          });
          localVideoTrackRef.current = vt;
          await client.publish(vt);
        }
        if (audioMSTrack) {
          const at = AgoraRTC.createCustomAudioTrack({ mediaStreamTrack: audioMSTrack });
          localAudioTrackRef.current = at;
          await client.publish(at);
        }
      }

      socket.emit('join-room', { roomId, role: 'participant' });
    }

    init().catch(console.error);

    return () => {
      cancelled = true;
      localVideoTrackRef.current?.close();
      localAudioTrackRef.current?.close();
      clientRef.current?.leave();
      joinedRef.current = false;
      socket.emit('leave-room', { roomId, role: 'participant' });
    };
  }, [roomId]);

  // ── Replace published tracks when camera/mic changes ──────────────────────
  useEffect(() => {
    if (!localStream || !joinedRef.current) return;
    const client = clientRef.current;
    if (!client || client.connectionState !== 'CONNECTED') return;

    async function replaceStream() {
      if (replacingRef.current) return;
      replacingRef.current = true;
      try {
        const videoMSTrack = localStream.getVideoTracks()[0];
        const audioMSTrack = localStream.getAudioTracks()[0];

        if (localVideoTrackRef.current) {
          await client.unpublish(localVideoTrackRef.current);
          localVideoTrackRef.current.close();
          localVideoTrackRef.current = null;
        }
        if (localAudioTrackRef.current) {
          await client.unpublish(localAudioTrackRef.current);
          localAudioTrackRef.current.close();
          localAudioTrackRef.current = null;
        }

        if (videoMSTrack) {
          const vt = AgoraRTC.createCustomVideoTrack({
            mediaStreamTrack: videoMSTrack,
            frameRate: 30,
            bitrateMin: 1000,
            bitrateMax: 4000,
            optimizationMode: 'detail',
          });
          localVideoTrackRef.current = vt;
          await client.publish(vt);
        }
        if (audioMSTrack) {
          const at = AgoraRTC.createCustomAudioTrack({ mediaStreamTrack: audioMSTrack });
          at.setEnabled(!micMutedRef.current); // re-apply mic mute — new track starts enabled
          localAudioTrackRef.current = at;
          await client.publish(at);
        }
      } finally {
        replacingRef.current = false;
      }
    }

    replaceStream().catch(console.error);
  }, [localStream]);

  const setMicMuted = useCallback((muted) => {
    micMutedRef.current = muted;
    localAudioTrackRef.current?.setEnabled(!muted);
  }, []);

  const setMicVolume = useCallback((vol) => {
    localAudioTrackRef.current?.setVolume(vol);
  }, []);

  const setSpeakerVolume = useCallback((vol) => {
    speakerVolRef.current = vol;
    if (!speakerMutedRef.current) remoteAudioTrackRef.current?.setVolume(vol);
  }, []);

  const setSpeakerMuted = useCallback((muted) => {
    speakerMutedRef.current = muted;
    remoteAudioTrackRef.current?.setVolume(muted ? 0 : speakerVolRef.current);
  }, []);

  return {
    hasRemoteVideo,
    connectionState,
    peerLeft,
    setMicMuted,
    setMicVolume,
    setSpeakerVolume,
    setSpeakerMuted,
  };
}
