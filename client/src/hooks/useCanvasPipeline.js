import { useEffect, useRef, useState } from 'react';

// Cap the long side to this — keeps encoding efficient while preserving 1080p quality.
// A 4K raw frame rotated to portrait would be 2160×3840 which overloads WebRTC encoders.
const MAX_LONG_SIDE = 1920;

export function useCanvasPipeline(inputStream) {
  const [rotationDegrees, setRotation] = useState(90);
  const [correctedStream, setCorrectedStream] = useState(null);

  // Use ref so the rAF loop always reads the latest rotation without re-running the effect
  const rotRef = useRef(rotationDegrees);
  const syncRotation = (deg) => {
    rotRef.current = deg;
    setRotation(deg);
  };

  const rafRef = useRef(null);

  useEffect(() => {
    if (!inputStream) return;

    const video = document.createElement('video');
    video.srcObject = inputStream;
    video.muted = true;
    video.playsInline = true;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { alpha: false });

    function drawFrame() {
      const rot = rotRef.current;
      const vw = video.videoWidth;
      const vh = video.videoHeight;

      if (!vw || !vh) {
        rafRef.current = requestAnimationFrame(drawFrame);
        return;
      }

      // Swap dims for 90/270 (portrait output from landscape camera)
      const rawOutW = rot === 90 || rot === 270 ? vh : vw;
      const rawOutH = rot === 90 || rot === 270 ? vw : vh;

      // Downscale so long side ≤ MAX_LONG_SIDE — reduces encoder load, removes 4K→WebRTC choke
      const scale = Math.min(1, MAX_LONG_SIDE / Math.max(rawOutW, rawOutH));
      const outW = Math.round(rawOutW * scale);
      const outH = Math.round(rawOutH * scale);

      if (canvas.width !== outW || canvas.height !== outH) {
        canvas.width  = outW;
        canvas.height = outH;
        // Canvas resize resets context state — re-apply quality settings
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
      }

      ctx.save();
      ctx.translate(outW / 2, outH / 2);
      ctx.rotate((rot * Math.PI) / 180);
      ctx.scale(-scale, scale); // horizontal flip + downscale in one transform
      ctx.drawImage(video, -vw / 2, -vh / 2, vw, vh);
      ctx.restore();

      rafRef.current = requestAnimationFrame(drawFrame);
    }

    video.onloadedmetadata = () => {
      video.play().then(() => {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        rafRef.current = requestAnimationFrame(drawFrame);
        const stream = canvas.captureStream(30);
        setCorrectedStream(stream);
      });
    };

    return () => {
      cancelAnimationFrame(rafRef.current);
      video.pause();
      video.srcObject = null;
      setCorrectedStream(null);
    };
  }, [inputStream]);

  return { correctedStream, rotationDegrees, setRotation: syncRotation };
}
