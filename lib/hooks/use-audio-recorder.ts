"use client";

import { useCallback, useRef, useState } from "react";

// Grava com MediaRecorder (webm/opus) e entrega o blob via callback --
// sem Promise atravessada pelo timer de auto-stop (mais simples de
// acompanhar do que resolver uma Promise de dentro de um setInterval).
// Usado pelo MessageComposer (Central de Conversas e ConversaDrawer).

export type RecorderStatus = "idle" | "recording" | "erro";

export interface AudioRecordResult {
  blob: Blob;
  seconds: number;
}

const MAX_SECONDS = 120; // mesmo teto validado pelo RPC send_team_message

export function useAudioRecorder() {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [seconds, setSeconds] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const secondsRef = useRef(0);
  const shouldSendRef = useRef(false);
  const onDoneRef = useRef<((result: AudioRecordResult | null) => void) | null>(null);

  const cleanupStream = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const stopInternal = useCallback(
    (send: boolean) => {
      shouldSendRef.current = send;
      const recorder = recorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        cleanupStream();
        setStatus("idle");
        if (!send) onDoneRef.current?.(null);
        return;
      }
      recorder.stop();
    },
    [cleanupStream]
  );

  const start = useCallback(
    async (onDone: (result: AudioRecordResult | null) => void) => {
      onDoneRef.current = onDone;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        const mime =
          typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
            ? "audio/webm;codecs=opus"
            : "audio/webm";
        const recorder = new MediaRecorder(stream, { mimeType: mime });
        chunksRef.current = [];
        secondsRef.current = 0;
        setSeconds(0);

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.onstop = () => {
          const finalSeconds = secondsRef.current;
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
          cleanupStream();
          setStatus("idle");
          if (shouldSendRef.current && finalSeconds > 0) {
            onDoneRef.current?.({ blob, seconds: finalSeconds });
          } else {
            onDoneRef.current?.(null);
          }
        };

        recorder.start();
        recorderRef.current = recorder;
        setStatus("recording");
        timerRef.current = setInterval(() => {
          secondsRef.current += 1;
          setSeconds(secondsRef.current);
          if (secondsRef.current >= MAX_SECONDS) stopInternal(true);
        }, 1000);
      } catch {
        setStatus("erro");
      }
    },
    [cleanupStream, stopInternal]
  );

  const finish = useCallback(() => stopInternal(true), [stopInternal]);
  const cancel = useCallback(() => stopInternal(false), [stopInternal]);

  return { status, seconds, start, finish, cancel, maxSeconds: MAX_SECONDS };
}
