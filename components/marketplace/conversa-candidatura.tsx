"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, MessageCircle, Send } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { BOTAO_OURO, CAMPO, haQuanto } from "@/components/banca/util";
import {
  APPLICATION_STATUS_LABEL,
  conversaAberta,
  enviarMensagem,
  fetchMensagens,
  marcarMensagensLidas,
  type ApplicationStatus,
  type MensagemCandidatura,
} from "@/lib/services/marketplace-service";

const ATUALIZA_MS = 20_000;

// Conversa da candidatura: o admin/coach do time e quem se candidatou
// trocam mensagens antes da decisão (combinar horário, tirar dúvida).
// Atualiza sozinha a cada 20s enquanto a tela está aberta; abrir marca
// como lidas as mensagens do outro lado.
export function ConversaCandidatura({
  applicationId,
  lado,
  status,
  nomeOutroLado,
  onLidas,
  compacta = false,
}: {
  applicationId: string;
  /** Quem está vendo: o candidato ou alguém do time. */
  lado: "candidato" | "time";
  status: ApplicationStatus;
  /** "o time", "Rafael"... (usado nos textos). */
  nomeOutroLado: string;
  /** Avisa quem mostra contadores de não lidas. */
  onLidas?: () => void;
  /** Dentro de modal: sem a caixa de vidro em volta. */
  compacta?: boolean;
}) {
  const [msgs, setMsgs] = useState<MensagemCandidatura[] | null>(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const lista = useRef<HTMLDivElement>(null);
  const aberta = conversaAberta(status);
  // Em ref: quem usa pode passar uma função nova a cada render sem
  // reiniciar a busca e o relógio de atualização.
  const avisarLidas = useRef(onLidas);
  useEffect(() => {
    avisarLidas.current = onLidas;
  }, [onLidas]);

  const carregar = useCallback(async () => {
    try {
      const m = await fetchMensagens(applicationId);
      setMsgs(m);
      const doOutroLado = (x: MensagemCandidatura) => (lado === "candidato" ? x.doTime : !x.doTime);
      if (m.some((x) => doOutroLado(x) && !x.lidaEm)) {
        await marcarMensagensLidas(applicationId);
        avisarLidas.current?.();
      }
    } catch (e) {
      setErro((e as Error)?.message ?? "Não foi possível carregar a conversa.");
      setMsgs((atual) => atual ?? []);
    }
  }, [applicationId, lado]);

  useEffect(() => {
    carregar();
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") carregar();
    }, ATUALIZA_MS);
    return () => window.clearInterval(t);
  }, [carregar]);

  // Sempre mostra a última mensagem.
  useEffect(() => {
    const el = lista.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs]);

  async function enviar() {
    const limpo = texto.trim();
    if (!limpo || enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      await enviarMensagem(applicationId, limpo);
      setTexto("");
      await carregar();
    } catch (e) {
      setErro((e as Error)?.message ?? "Não foi possível enviar.");
    } finally {
      setEnviando(false);
    }
  }

  const ultimaMinha = msgs ? [...msgs].reverse().find((m) => m.minha) : undefined;

  const corpo = (
    <>
      <div className="flex items-center gap-2">
        <MessageCircle size={15} className="text-[#e8cb6a]" />
        <h3 className="m-0 text-sm font-semibold">{lado === "candidato" ? "Conversa com o time" : `Conversa com ${nomeOutroLado}`}</h3>
      </div>

      <div ref={lista} className="painel-scroll mt-3 flex max-h-[340px] min-h-[64px] flex-col gap-2 overflow-y-auto pr-1" aria-live="polite">
        {msgs === null ? (
          <div className="grid place-items-center py-5">
            <Loader2 size={16} className="animate-spin text-muted" />
          </div>
        ) : msgs.length === 0 ? (
          <p className="m-0 rounded-xl border border-dashed border-white/10 px-3 py-3 text-[12.5px] leading-relaxed text-muted">
            {lado === "candidato"
              ? "Alguma dúvida sobre a vaga? Escreva pro time — quem cuida das vagas (admin ou coach) responde aqui."
              : "Converse antes de decidir: combine horários, tire dúvidas, peça mais sobre o jogo."}
          </p>
        ) : (
          msgs.map((m) => (
            <div key={m.id} className={`flex items-end gap-2 ${m.minha ? "flex-row-reverse" : ""}`}>
              {!m.minha && <Avatar id={m.avatarId} url={m.avatarUrl} size={26} />}
              <div className={`max-w-[82%] ${m.minha ? "items-end text-right" : ""} flex flex-col`}>
                <div
                  className={`whitespace-pre-wrap break-words rounded-2xl border px-3 py-2 text-left text-[13px] leading-snug ${
                    m.minha ? "rounded-br-md border-[#d4af37]/35 bg-[#d4af37]/[0.12] text-ink" : "rounded-bl-md border-white/10 bg-white/[0.05] text-ink/90"
                  }`}
                >
                  {m.texto}
                </div>
                <span className="mt-0.5 px-1 text-[10.5px] text-muted">
                  {m.minha ? "Você" : m.autor}
                  {!m.minha && m.doTime && lado === "candidato" && " · do time"} · {haQuanto(m.criadaEm)}
                  {m.minha && m.id === ultimaMinha?.id && m.lidaEm && " · visto"}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {aberta ? (
        <form
          className="mt-3 flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            enviar();
          }}
        >
          <textarea
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              setErro(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                enviar();
              }
            }}
            rows={2}
            maxLength={2000}
            placeholder={lado === "candidato" ? "Escreva pro time…" : `Escreva pra ${nomeOutroLado}…`}
            aria-label="Mensagem"
            className={`${CAMPO} resize-none`}
          />
          <button type="submit" disabled={enviando || !texto.trim()} className={`${BOTAO_OURO} !px-3 py-2.5`} aria-label="Enviar mensagem">
            {enviando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </form>
      ) : (
        <p className="m-0 mt-3 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-[12px] text-muted">
          A conversa fechou: a candidatura foi {APPLICATION_STATUS_LABEL[status].toLocaleLowerCase("pt-BR")}.
        </p>
      )}
      {erro && <p className="m-0 mt-2 text-[12px] text-negative">{erro}</p>}
    </>
  );

  if (compacta) return <div>{corpo}</div>;
  return <section className="painel-vidro rounded-2xl border border-white/10 p-4">{corpo}</section>;
}
