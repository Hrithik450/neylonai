import React from "react";
import { cn } from "@/lib/utils";

interface AudioVisualizerProps {
  stream: MediaStream | null;
  className: string;
}

export function AudioVisualizer({ stream, className }: AudioVisualizerProps) {
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const analyserRef = React.useRef<AnalyserNode | null>(null);
  const dataArrayRef: React.RefObject<Uint8Array<ArrayBuffer> | null> =
    React.useRef(null);
  const animationFrameRef = React.useRef<number | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    if (stream && canvasRef.current) {
      startVisualizer(stream);
    }

    return () => {
      stopVisualizer();
    };
  }, [stream]);

  const startVisualizer = (mediaStream: MediaStream) => {
    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(mediaStream);
    const analyzer = audioCtx.createAnalyser();
    analyzer.fftSize = 256;

    const bufferLength = analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    source.connect(analyzer);
    audioContextRef.current = audioCtx;
    analyserRef.current = analyzer;
    dataArrayRef.current = dataArray;

    const canvas = canvasRef.current;
    if (!canvas || !canvas.getContext) {
      console.warn("Canvas not ready for visualizer");
      return;
    }

    const ctx = canvas.getContext("2d");
    const draw = () => {
      if (!ctx || !analyserRef.current || !dataArrayRef.current) return;
      analyserRef.current.getByteFrequencyData(dataArrayRef.current);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const sliceWidth = 0.95;
      const gap = 2;
      const totalBarWidth = sliceWidth + gap;
      const centerY = canvas.height / 2;

      let x = (canvas.width - bufferLength * totalBarWidth) / 2;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArrayRef.current[i];
        const amplitude = Math.abs((v - 128) / 128);
        const y = amplitude * canvas.height * 0.4;

        ctx.beginPath();
        ctx.strokeStyle = "#9ca3af";
        ctx.lineWidth = sliceWidth;
        ctx.moveTo(x, centerY - y);
        ctx.lineTo(x, centerY + y);
        ctx.stroke();

        x += totalBarWidth;
      }

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    draw();
  };

  const stopVisualizer = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  return (
    <div className="flex min-h-12 items-start">
      <div className="max-w-full h-full min-w-0 flex-1">
        <canvas
          ref={canvasRef}
          width={300}
          height={50}
          className={cn(className, "w-full rounded bg-black")}
        />
      </div>
    </div>
  );
}
