import { useEffect, useRef, useState } from 'react';

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
    const ctx = canvas.getContext('2d');

    function drawFrame() {
      const rot = rotRef.current;
      const vw = video.videoWidth;
      const vh = video.videoHeight;

      if (!vw || !vh) {
        rafRef.current = requestAnimationFrame(drawFrame);
        return;
      }

      // Portrait output: swap canvas dimensions for 90/270
      const outW = rot === 90 || rot === 270 ? vh : vw;
      const outH = rot === 90 || rot === 270 ? vw : vh;
      if (canvas.width !== outW) canvas.width = outW;
      if (canvas.height !== outH) canvas.height = outH;

      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rot * Math.PI) / 180);
      ctx.scale(-1, 1); // horizontal flip
      ctx.drawImage(video, -vw / 2, -vh / 2, vw, vh);
      ctx.restore();

      rafRef.current = requestAnimationFrame(drawFrame);
    }

    video.onloadedmetadata = () => {
      video.play().then(() => {
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
