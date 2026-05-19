import { useState, useCallback } from 'react';

export function useDevices() {
  const [cameras, setCameras] = useState([]);
  const [microphones, setMicrophones] = useState([]);
  const [speakers, setSpeakers] = useState([]);

  const refreshDevices = useCallback(async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    setCameras(devices.filter((d) => d.kind === 'videoinput'));
    setMicrophones(devices.filter((d) => d.kind === 'audioinput'));
    setSpeakers(devices.filter((d) => d.kind === 'audiooutput'));
  }, []);

  return { cameras, microphones, speakers, refreshDevices };
}
