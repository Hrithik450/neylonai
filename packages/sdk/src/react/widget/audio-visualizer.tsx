"use client";

import React from "react";
import { cn } from "../../ui";

interface AudioVisualizerProps {
  stream: MediaStream | null;
  className?: string;
  /** Accent for live bars (defaults to zinc). */
  color?: string;
}

const BAR_COUNT = 28;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/**
 * Vertical equalizer bars that grow up/down with speech.
 * Smooth envelope — tall bars, not dots.
 */
export function AudioVisualizer({
  stream,
  className,
  color = "#71717a",
}: AudioVisualizerProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const displayRef = React.useRef<Float32Array>(new Float32Array(BAR_COUNT));
  const envelopeRef = React.useRef(0);

  React.useEffect(() => {
    if (!stream || !canvasRef.current || !wrapRef.current) return;

    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyzer = audioCtx.createAnalyser();
    analyzer.fftSize = 256;
    analyzer.smoothingTimeConstant = 0.7;
    source.connect(analyzer);

    const freqData = new Uint8Array(analyzer.frequencyBinCount);
    const timeData = new Uint8Array(analyzer.fftSize);
    let raf = 0;
    let running = true;
    let lastTs = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.floor(wrap.clientWidth));
      const height = Math.max(1, Math.floor(wrap.clientHeight));
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    const draw = (ts: number) => {
      if (!running) return;
      const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0.016;
      lastTs = ts;

      analyzer.getByteFrequencyData(
        freqData as unknown as Uint8Array<ArrayBuffer>,
      );
      analyzer.getByteTimeDomainData(
        timeData as unknown as Uint8Array<ArrayBuffer>,
      );

      // Overall speech loudness.
      let energy = 0;
      for (let i = 0; i < timeData.length; i++) {
        const n = ((timeData[i] ?? 128) - 128) / 128;
        energy += n * n;
      }
      energy = Math.sqrt(energy / timeData.length);
      const measured = Math.min(1, Math.max(0, (energy - 0.015) * 5.5));

      // Smooth volume envelope (no flashes).
      const envSpeed = measured > envelopeRef.current ? 6 : 3.5;
      envelopeRef.current = lerp(
        envelopeRef.current,
        measured,
        1 - Math.exp(-envSpeed * dt),
      );
      const envelope = envelopeRef.current;

      const startBin = 2;
      const endBin = Math.min(
        freqData.length - 1,
        Math.floor(freqData.length * 0.5),
      );
      const usable = Math.max(1, endBin - startBin);

      const width = wrap.clientWidth;
      const height = wrap.clientHeight;
      const midY = height / 2;
      const gap = 4;
      const barWidth = Math.max(3, (width - gap * (BAR_COUNT - 1)) / BAR_COUNT);
      // Keep a clear vertical bar at rest; grow up to nearly full height.
      const minBar = height * 0.18;
      const maxBar = height * 0.92;

      ctx.clearRect(0, 0, width, height);

      const follow = 1 - Math.exp(-7 * dt);

      for (let i = 0; i < BAR_COUNT; i++) {
        const t0 = i / BAR_COUNT;
        const t1 = (i + 1) / BAR_COUNT;
        const from = startBin + Math.floor(t0 * usable);
        const to = startBin + Math.max(from + 1, Math.floor(t1 * usable));

        let sum = 0;
        for (let j = from; j < to; j++) sum += (freqData[j] ?? 0) / 255;
        const band = sum / Math.max(1, to - from);

        // Neighbor soften so the row moves as one wave.
        // (Uses previous display neighbors as a cheap blur.)
        const prevL = displayRef.current[Math.max(0, i - 1)] ?? 0;
        const prevR = displayRef.current[Math.min(BAR_COUNT - 1, i + 1)] ?? 0;

        // Idle: short vertical stub. Speaking: bars stretch up/down from center.
        const idle = 0.12 + 0.06 * Math.sin(ts * 0.003 + i * 0.45);
        const spoken = Math.min(1, band * 1.35 + envelope * 0.55);
        const target = lerp(idle, spoken, Math.min(1, envelope * 1.4 + 0.15));
        const blended = target * 0.7 + ((prevL + prevR) * 0.5) * 0.3;

        displayRef.current[i] = lerp(
          displayRef.current[i] ?? idle,
          blended,
          follow,
        );

        const amp = displayRef.current[i]!;
        const barHeight = minBar + amp * (maxBar - minBar);
        const x = i * (barWidth + gap);
        const y = midY - barHeight / 2;

        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.roundRect(x, y, barWidth, barHeight, barWidth / 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };

    void audioCtx.resume().then(() => {
      if (running) raf = requestAnimationFrame(draw);
    });

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      void audioCtx.close();
    };
  }, [stream, color]);

  return (
    <div
      ref={wrapRef}
      className={cn(
        "flex h-11 w-full min-w-0 items-center justify-center",
        className,
      )}
      aria-hidden
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
