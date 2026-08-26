"use client";

import { useState } from "react";
import { Check, Mic, Send, X } from "lucide-react";
import { useAudioRecorder } from "@/lib/hooks/use-audio-recorder";
import { EmojiPickerButton } from "@/components/emoji-picker";

// Composer compartilhado: input de texto + botao de microfone que vira
// uma barra de gravacao (cancelar/enviar), igual apps de chat com audio.
// Enquanto grava, o botao de enviar texto some -- so' uma coisa por vez.
export function MessageComposer({
  onSendText,
  onSendAudio,
  disabled,
}: {
  onSendText: (body: string) => Promise<void> | void;
  onSendAudio: (blob: Blob, seconds: number) => Promise<void> | void;
  disabled?: boolean;
}) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const { status, seconds, start, finish, cancel } = useAudioRecorder();

  async function enviarTexto() {
    const corpo = texto.trim();
    if (!corpo || enviando || disabled) return;
    setEnviando(true);
    setTexto("");
    try {
      await onSendText(corpo);
    } finally {
      setEnviando(false);
    }
  }

  function iniciarGravacao() {
    if (disabled || enviando) return;
    start((result) => {
      if (!result) return;
      setEnviando(true);
      Promise.resolve(onSendAudio(result.blob, result.seconds)).finally(() => setEnviando(false));
    });
  }

  if (status === "recording") {
    const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
    const ss = String(seconds % 60).padStart(2, "0");
    return (
      <div className="flex items-center gap-2 border-t border-hairline p-3">
        <span className="flex size-2 shrink-0 animate-pulse rounded-full bg-negative" aria-hidden="true" />
        <span className="flex-1 text-sm tabular-nums text-ink">
          Gravando… {mm}:{ss}
        </span>
        <button
          onClick={cancel}
          className="grid size-9 shrink-0 place-items-center rounded-lg border border-hairline text-muted transition-colors hover:text-ink"
          aria-label="Cancelar gravação"
        >
          <X size={15} />
        </button>
        <button
          onClick={finish}
          className="grid size-9 shrink-0 place-items-center rounded-lg bg-ink text-void"
          aria-label="Enviar áudio"
        >
          <Check size={15} />
        </button>
      </div>
    );
  }

  return (
    <div className="border-t border-hairline">
      {status === "erro" && (
        <p className="px-3 pt-2 text-[11px] text-negative">
          Não foi possível acessar o microfone. Verifique a permissão do navegador.
        </p>
      )}
      <div className="flex items-center gap-2 p-3">
        <EmojiPickerButton onPick={(emoji) => setTexto((t) => t + emoji)} />
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && enviarTexto()}
          placeholder="Escreva uma mensagem…"
          disabled={disabled || enviando}
          className="flex-1 rounded-lg border border-hairline bg-elevated px-3 py-2 text-sm text-ink outline-none placeholder:text-muted/50 disabled:opacity-60"
        />
        {texto.trim() ? (
          <button
            onClick={enviarTexto}
            disabled={enviando}
            className="grid size-9 shrink-0 place-items-center rounded-lg bg-ink text-void disabled:opacity-50"
            aria-label="Enviar"
          >
            <Send size={15} />
          </button>
        ) : (
          <button
            onClick={iniciarGravacao}
            disabled={disabled || enviando}
            className="grid size-9 shrink-0 place-items-center rounded-lg border border-hairline text-muted transition-colors hover:border-ink/40 hover:text-ink disabled:opacity-50"
            aria-label="Gravar áudio"
          >
            <Mic size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
