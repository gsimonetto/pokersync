"use client";

import { useEffect, useState } from "react";
import { NotebookPen, Plus, Trash2 } from "lucide-react";
import { addAnnotation, deleteAnnotation, fetchAnnotations } from "@/lib/services/bankroll-service";
import type { Annotation } from "@/lib/bankroll/types";
import { CardHint, GlassCard } from "./glass-card";

// Bloco de anotações rápidas. Grava nas MESMAS anotações da Gestão de
// Banca (bankroll_annotations), que já aparecem no gráfico de evolução —
// ou seja, o insight escrito aqui vira contexto do resultado daquele dia,
// em vez de virar uma nota solta só do painel.
export function QuickNotesCard({ style, className }: { style?: React.CSSProperties; className?: string }) {
  const [notas, setNotas] = useState<Annotation[]>([]);
  const [texto, setTexto] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const lista = await fetchAnnotations();
        if (!vivo) return;
        // fetchAnnotations vem em ordem crescente de data — aqui a mais
        // recente é a que interessa, então inverte.
        setNotas([...lista].reverse().slice(0, 8));
      } catch {
        // sem sessão/Supabase: card fica vazio, sem quebrar a tela
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const nota = texto.trim();
    if (!nota || salvando) return;
    setSalvando(true);
    setErro(null);
    try {
      const criada = await addAnnotation({ date: new Date().toISOString().slice(0, 10), note: nota });
      setNotas((l) => [criada, ...l].slice(0, 8));
      setTexto("");
    } catch {
      setErro("Não deu pra salvar agora.");
    } finally {
      setSalvando(false);
    }
  }

  async function remover(id: string) {
    const antes = notas;
    setNotas((l) => l.filter((n) => n.id !== id));
    try {
      await deleteAnnotation(id);
    } catch {
      setNotas(antes);
    }
  }

  return (
    <GlassCard title="Anotações rápidas" icon={<NotebookPen size={13} />} style={style} className={className}>
      <form onSubmit={salvar} className="flex items-center gap-2">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Insight da sessão…"
          maxLength={280}
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm placeholder:text-white/30 focus:border-[color:var(--psd-line-strong)] focus:outline-none"
        />
        <button
          type="submit"
          disabled={!texto.trim() || salvando}
          aria-label="Salvar anotação"
          className="psd-active grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white transition-transform hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
        >
          <Plus size={16} />
        </button>
      </form>
      {erro && <p className="mt-2 text-xs text-negative">{erro}</p>}

      {carregando ? (
        <p className="mt-4 text-sm text-white/45">Carregando…</p>
      ) : notas.length === 0 ? (
        <div className="mt-4">
          <CardHint>Nenhuma anotação ainda. Escreva o que funcionou (ou não) na última sessão.</CardHint>
        </div>
      ) : (
        <ul className="psd-scroll mt-4 flex max-h-[190px] flex-col gap-2.5 overflow-y-auto pr-1">
          {notas.map((n) => (
            <li key={n.id} className="group flex items-start gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--psd-neon-soft)]" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm leading-snug text-white/85">{n.note}</span>
                <span className="text-[11px] text-white/35">
                  {new Date(`${n.date}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                </span>
              </span>
              <button
                type="button"
                onClick={() => remover(n.id)}
                aria-label="Apagar anotação"
                className="shrink-0 text-white/0 transition-colors hover:text-negative focus:text-negative group-hover:text-white/30"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </GlassCard>
  );
}
