"use client";

import { useState, useEffect } from "react";
import { Play, Pause, RotateCcw } from "lucide-react";

export function FocusTimerCard() {
  const [seconds, setSeconds] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const totalSeconds = 25 * 60;
  const progress = ((totalSeconds - seconds) / totalSeconds) * 100;

  function reset() {
    setSeconds(25 * 60);
    setIsRunning(false);
  }

  function toggle() {
    setIsRunning(!isRunning);
  }

  return (
    <div className="group relative h-full overflow-hidden rounded-2xl border border-hairline bg-gradient-to-br from-elevated via-surface to-elevated p-6 backdrop-blur-xl transition-all duration-300 hover:border-review/40">
      {/* Glow ambient */}
      <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-20">
        <div className="absolute inset-0 bg-gradient-to-r from-review/20 via-transparent to-transparent blur-3xl" />
      </div>

      <div className="relative flex flex-col items-center justify-center gap-6">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted">Timer de Foco</h3>

        {/* Circular Timer */}
        <div className="relative size-48 flex items-center justify-center">
          {/* Background circle */}
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 160 160">
            <circle cx="80" cy="80" r="70" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
            <circle
              cx="80"
              cy="80"
              r="70"
              fill="none"
              stroke="#a855f7"
              strokeWidth="2"
              strokeDasharray={`${progress * 4.4} 440`}
              className="transition-all duration-300"
              strokeLinecap="round"
            />
          </svg>

          {/* Time display */}
          <div className="text-center">
            <div className="text-5xl font-bold font-mono text-ink tnum">
              {String(minutes).padStart(2, "0")}:{String(secs).padStart(2, "0")}
            </div>
            <div className="text-xs uppercase tracking-widest text-muted mt-1">Foco</div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggle}
            className="group/btn flex size-12 items-center justify-center rounded-full border border-review/30 bg-review/10 transition-all hover:border-review/60 hover:bg-review/20"
          >
            {isRunning ? (
              <Pause size={20} className="text-review" />
            ) : (
              <Play size={20} className="translate-x-0.5 text-review" />
            )}
          </button>
          <button
            onClick={reset}
            className="group/btn flex size-12 items-center justify-center rounded-full border border-hairline bg-surface/50 transition-all hover:border-muted/40 hover:bg-surface"
          >
            <RotateCcw size={18} className="text-muted" />
          </button>
        </div>
      </div>
    </div>
  );
}
