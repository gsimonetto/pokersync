"use client";

import { useEffect, useState } from "react";
import { Loader2, Mic } from "lucide-react";
import { getTeamAudioUrl, type TeamMessage } from "@/lib/services/team-service";

// Bolha de mensagem 1:1 -- texto ou audio (kind='audio'). Compartilhada
// entre a Central de Conversas (topbar) e o ConversaDrawer do Painel do
// Time, pra manter os dois lugares consistentes. Audio mora num bucket
// privado (team-audio); a signed URL e' pedida sob demanda quando a
// bolha aparece, nunca cacheada entre sessoes.
export function MessageBubble({ message, isMine }: { message: TeamMessage; isMine: boolean }) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    if (message.kind !== "audio" || !message.audioUrl) return;
    let ativo = true;
    getTeamAudioUrl(message.audioUrl)
      .then((url) => ativo && setAudioUrl(url))
      .catch(() => ativo && setErro(true));
    return () => {
      ativo = false;
    };
  }, [message.kind, message.audioUrl]);

  return (
    <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-lg px-3 py-2 text-[13px] ${
          isMine ? "bg-ink text-void" : "border border-hairline bg-elevated text-ink"
        }`}
      >
        {message.kind === "audio" ? (
          erro ? (
            <p className="py-1 text-xs opacity-70">Áudio indisponível.</p>
          ) : audioUrl ? (
            <div className="flex items-center gap-2">
              <Mic size={14} className="shrink-0 opacity-70" />
              <audio controls preload="none" src={audioUrl} className="h-8 max-w-[220px]" />
              {message.durationSeconds != null && (
                <span className={`shrink-0 text-[10px] tabular-nums ${isMine ? "text-void/60" : "text-muted"}`}>
                  {message.durationSeconds}s
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 py-1">
              <Loader2 size={14} className="animate-spin opacity-70" />
              <span className="text-xs opacity-70">Carregando áudio…</span>
            </div>
          )
        ) : (
          <p className="whitespace-pre-wrap break-words">{message.body}</p>
        )}
        <p className={`mt-1 text-[10px] ${isMine ? "text-void/60" : "text-muted"}`}>
          {new Date(message.createdAt).toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}
