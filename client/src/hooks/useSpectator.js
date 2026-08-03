import { useEffect, useRef, useState, useCallback } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import { apiFetch } from '../utils/api.js';

export function useSpectator({ roomId }) {
  const clientRef       = useRef(null);
  const audioTracksRef  = useRef({});

  const [remoteUsers,     setRemoteUsers]     = useState([]);
  const [connectionState, setConnectionState] = useState('disconnected');
  const [speakerDevices,  setSpeakerDevices]  = useState([]);
  const [audioMuted,      setAudioMuted]      = useState({});

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const res = await apiFetch(`/api/agora-token?channel=${encodeURIComponent(roomId)}&role=spectator`);
      if (!res.ok || cancelled) return;
      const { token, appId } = await res.json();
      if (cancelled) return;

      const client = AgoraRTC.createClient({ mode: 'live', codec: 'h264' });
      clientRef.current = client;

      client.on('connection-state-change', (s) => setConnectionState(s.toLowerCase()));

      client.on('user-published', async (user, mediaType) => {
        await client.subscribe(user, mediaType);

        setRemoteUsers((prev) => {
          const exists = prev.find((u) => u.uid === user.uid);
          if (mediaType === 'video') {
            return exists
              ? prev.map((u) => u.uid === user.uid ? { ...u, videoTrack: user.videoTrack } : u)
              : [...prev, { uid: user.uid, videoTrack: user.videoTrack, audioTrack: null }];
          }
          if (mediaType === 'audio') {
            audioTracksRef.current[user.uid] = user.audioTrack;
            user.audioTrack.play();
            return exists
              ? prev.map((u) => u.uid === user.uid ? { ...u, audioTrack: user.audioTrack } : u)
              : [...prev, { uid: user.uid, videoTrack: null, audioTrack: user.audioTrack }];
          }
          return prev;
        });
      });

      client.on('user-unpublished', (user, mediaType) => {
        if (mediaType === 'video') {
          setRemoteUsers((prev) => prev.map((u) => u.uid === user.uid ? { ...u, videoTrack: null } : u));
        }
        if (mediaType === 'audio') {
          delete audioTracksRef.current[user.uid];
          setRemoteUsers((prev) => prev.map((u) => u.uid === user.uid ? { ...u, audioTrack: null } : u));
        }
      });

      client.on('user-left', (user) => {
        delete audioTracksRef.current[user.uid];
        setRemoteUsers((prev) => prev.filter((u) => u.uid !== user.uid));
      });

      await client.setClientRole('audience', { level: 1 });
      await client.join(appId, roomId, token || null, null);

      try {
        const devices = await AgoraRTC.getPlaybackDevices();
        if (!cancelled) setSpeakerDevices(devices);
      } catch {}
    }

    init().catch(console.error);

    return () => {
      cancelled = true;
      audioTracksRef.current = {};
      clientRef.current?.leave();
    };
  }, [roomId]);

  const muteUserAudio = useCallback((uid, muted) => {
    const track = audioTracksRef.current[uid];
    if (track) track.setVolume(muted ? 0 : 100);
    setAudioMuted((prev) => ({ ...prev, [uid]: muted }));
  }, []);

  const setSpeakerDevice = useCallback(async (deviceId) => {
    for (const track of Object.values(audioTracksRef.current)) {
      try { await track.setPlaybackDevice(deviceId); } catch {}
    }
  }, []);

  return { remoteUsers, connectionState, speakerDevices, audioMuted, muteUserAudio, setSpeakerDevice };
}
