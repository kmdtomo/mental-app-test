'use client';

import { useEffect, useRef, useState } from 'react';

export function useAudioVisualizer(stream: MediaStream | null) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  useEffect(() => {
    if (!stream) return;

    // Create audio context and analyser
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    const analyserNode = audioContext.createAnalyser();
    
    analyserNode.fftSize = 256;
    analyserNode.smoothingTimeConstant = 0.9;
    
    source.connect(analyserNode);
    setAnalyser(analyserNode);

    // Some browsers start AudioContext as 'suspended'. Ensure it resumes ASAP.
    const tryResume = async () => {
      try {
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }
      } catch {}
    };
    // attempt immediately
    void tryResume();

    // also bind one-off resume on user interaction
    const onInteract = () => {
      void tryResume();
    };
    document.addEventListener('click', onInteract, { once: true });
    document.addEventListener('touchstart', onInteract, { once: true });
    document.addEventListener('keydown', onInteract, { once: true });

    return () => {
      source.disconnect();
      audioContext.close();
      document.removeEventListener('click', onInteract);
      document.removeEventListener('touchstart', onInteract);
      document.removeEventListener('keydown', onInteract);
    };
  }, [stream]);

  useEffect(() => {
    if (!analyser || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      
      analyser.getByteFrequencyData(dataArray);
      
      // 背景を薄いオレンジのトーンに（カードに馴染む程度）
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const barWidth = (canvas.width / bufferLength) * 2.2;
      let barHeight;
      let x = 0;
      
      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * canvas.height * 0.78;

        // オレンジ系に統一（--primary: hsl(20 100% 60%) を想定）
        // 近いRGB: #F97316 (orange-500) をベースに微妙にトーンを変える
        const baseR = 249, baseG = 115, baseB = 22;
        const lighten = 0.8 + (i / bufferLength) * 0.2; // 0.8〜1.0
        const r = Math.round(baseR * lighten);
        const g = Math.round(baseG * lighten);
        const b = Math.round(baseB * lighten);

        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        
        x += barWidth + 1;
      }
    };
    
    draw();
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [analyser]);

  return canvasRef;
}