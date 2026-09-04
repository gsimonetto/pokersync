"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MessageSquare, Bell, ClipboardList, StickyNote, Target } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  METRICA_LABEL,
  ALERTA_LABEL,
  fetchPlayerGoals,
  fetchPlayerAlerts,
  type PlayerGoal,
  type TeamAlert,
} from "@/lib/services/team-service";
import { fetchPlayerCards, fetchChecklist, type PlayerCard, type ChecklistItem } from "@/lib/services/team-funnel-service";
import { fetchRecentCoachComments, type RecentCoachComment } from "@/lib/services/hand-review-service";

// Reune tudo que o coach compartilha com o jogador, hoje espalhado em
// 4 fontes diferentes -- so' as metas do coach ja tinham tela propria
// (Modo Time); o resto (funil, checklist, alertas, comentarios em mao)
// nunca tinha um lugar pro proprio jogador ver antes disso.

function fmtRelativo(iso: string): string {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "há 1 dia";
  return `há ${dias} dias`;
}

export function RecadosCoachModalBody() {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [aba, setAba] = useState<"ativas" | "finalizadas">("ativas");

  const [metas, setMetas] = useState<PlayerGoal[]>([]);
  const [card, setCard] = useState<PlayerCard | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [alertas, setAlertas] = useState<TeamAlert[]>([]);
  const [comentarios, setComentarios] = useState<RecentCoachComment[]>([]);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      const meId = userData.user?.id;
      if (!meId) {
        setLoading(false);
        return;
      }

      // Cada fonte busca em paralelo e falha isolada -- se uma nao tiver
      // dado (ex: jogador sem card no funil ainda), as outras continuam
      // aparecendo normalmente.
      const [metasR, cardsR, alertasR, comentariosR] = await Promise.allSettled([
        fetchPlayerGoals(meId),
        fetchPlayerCards(),
        fetchPlayerAlerts(meId),
        fetchRecentCoachComments(5),
      ]);

      if (metasR.status === "fulfilled") setMetas(metasR.value);
      if (alertasR.status === "fulfilled") setAlertas(alertasR.value);
      if (comentariosR.status === "fulfilled") setComentarios(comentariosR.value);

      if (cardsR.status === "fulfilled" && cardsR.value.length > 0) {
        const meuCard = cardsR.value[0];
        setCard(meuCard);
        try {
          setChecklist(await fetchChecklist(meuCard.cardId));
        } catch {
          // checklist vazia/sem permissao: secao so' nao aparece
        }
      }

      if ([metasR, cardsR, alertasR, comentariosR].every((r) => r.status === "rejected")) {
        setErro("Não foi possível carregar os recados do coach.");
      }
      setLoading(false);
    })();
  }, []);

  const metasAtivas = useMemo(() => metas.filter((m) => !m.finalizada), [metas]);
  const metasFinalizadas = useMemo(() => metas.filter((m) => m.finalizada), [metas]);

  if (loading) return <p className="text-sm text-muted">Carregando…</p>;
  if (erro) return <p className="text-sm text-negative">{erro}</p>;

  const nada = metas.length === 0 && !card && checklist.length === 0 && alertas.length === 0 && comentarios.length === 0;
  if (nada) return <p className="text-sm text-muted">Seu coach ainda não compartilhou nada por aqui.</p>;

  return (
    <div className="space-y-5">
      {metas.length > 0 && (
        <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
              <Target size={13} className="text-training" />
              Metas do coach
            </h3>
            <div className="flex gap-1 rounded-lg bg-elevated p-1 text-[11px] font-semibold">
              <button
                onClick={() => setAba("ativas")}
                className={`rounded-md px-2 py-1 transition-colors ${aba === "ativas" ? "bg-surface text-ink" : "text-muted"}`}
              >
                Ativas ({metasAtivas.length})
              </button>
              <button
                onClick={() => setAba("finalizadas")}
                className={`rounded-md px-2 py-1 transition-colors ${aba === "finalizadas" ? "bg-surface text-ink" : "text-muted"}`}
              >
                Finalizadas ({metasFinalizadas.length})
              </button>
            </div>
          </div>
          <ul className="space-y-2.5">
            {(aba === "ativas" ? metasAtivas : metasFinalizadas).map((m) => {
              const pct = Math.min(100, Math.round((m.progress / m.target) * 100));
              return (
                <li key={m.id} className="rounded-lg border border-hairline bg-elevated p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[12.5px] font-medium">
                      {METRICA_LABEL[m.metric]}
                      <span className="ml-1.5 text-[11px] font-normal text-muted">
                        até {new Date(m.deadline).toLocaleDateString("pt-BR")}
                      </span>
                    </span>
                    <span className={`text-[12.5px] font-semibold tnum ${m.atingida ? "text-positive" : "text-ink/85"}`}>
                      {m.progress}/{m.target}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-void">
                    <div
                      className={`h-full rounded-full ${m.atingida ? "bg-positive" : "bg-training"}`}
                      style={{ width: `${Math.max(4, pct)}%` }}
                    />
                  </div>
                </li>
              );
            })}
            {(aba === "ativas" ? metasAtivas : metasFinalizadas).length === 0 && (
              <p className="text-[12px] text-muted">Nenhuma meta {aba === "ativas" ? "ativa" : "finalizada"}.</p>
            )}
          </ul>
        </section>
      )}

      {card && (card.drillsTarget > 0 || card.reviewsTarget > 0 || card.statTarget != null) && (
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
            <ClipboardList size={13} className="text-training" />
            Alvos do funil
          </h3>
          <div className="space-y-2.5 rounded-lg border border-hairline bg-elevated p-3">
            {card.drillsTarget > 0 && (
              <div>
                <div className="mb-1 flex justify-between text-[12.5px]">
                  <span>Drills concluídos</span>
                  <span className="font-semibold tnum text-training">{card.drillsDone} / {card.drillsTarget}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-void">
                  <div className="h-full rounded-full bg-training" style={{ width: `${Math.max(4, Math.min(100, (card.drillsDone / card.drillsTarget) * 100))}%` }} />
                </div>
              </div>
            )}
            {card.reviewsTarget > 0 && (
              <div>
                <div className="mb-1 flex justify-between text-[12.5px]">
                  <span>Mãos revisadas</span>
                  <span className="font-semibold tnum text-training">{card.reviewsDone} / {card.reviewsTarget}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-void">
                  <div className="h-full rounded-full bg-training" style={{ width: `${Math.max(4, Math.min(100, (card.reviewsDone / card.reviewsTarget) * 100))}%` }} />
                </div>
              </div>
            )}
            {card.statMetric && card.statTarget != null && (
              <div className="flex items-center justify-between text-[12.5px]">
                <span>{card.statMetric.toUpperCase()} atual vs. alvo</span>
                <span>
                  <span className="font-semibold tnum">{card.statValue ?? "—"}%</span>
                  <span className="text-muted"> / alvo {card.statTarget}%</span>
                </span>
              </div>
            )}
          </div>
        </section>
      )}

      {card?.notes && (
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
            <StickyNote size={13} className="text-training" />
            Observação do coach
          </h3>
          <p className="rounded-lg border border-hairline bg-elevated p-3 text-[12.5px] italic text-muted">&quot;{card.notes}&quot;</p>
        </section>
      )}

      {checklist.length > 0 && (
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
            <ClipboardList size={13} className="text-training" />
            Checklist do funil
          </h3>
          <ul className="rounded-lg border border-hairline bg-elevated">
            {checklist.map((it, i) => (
              <li
                key={it.id}
                className={`flex items-center gap-2.5 px-3 py-2 text-[12.5px] ${i > 0 ? "border-t border-hairline" : ""} ${it.done ? "text-muted line-through" : ""}`}
              >
                <span
                  className={`grid size-4 flex-none place-items-center rounded ${it.done ? "bg-positive text-void" : "border border-hairline"}`}
                >
                  {it.done && "✓"}
                </span>
                {it.text}
              </li>
            ))}
          </ul>
        </section>
      )}

      {alertas.length > 0 && (
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
            <Bell size={13} className="text-evolution" />
            Alertas automáticos
          </h3>
          <ul className="space-y-2">
            {alertas.map((a) => (
              <li key={a.id} className="flex items-start gap-2.5">
                <span className="mt-1.5 size-1.5 flex-none rounded-full bg-evolution" />
                <div>
                  <p className="text-[12.5px] text-muted">
                    <span className="font-semibold text-ink">{ALERTA_LABEL[a.kind]}</span>
                    {a.detail ? ` — ${a.detail}` : ""}
                  </p>
                  <p className="text-[11px] text-muted/70">{fmtRelativo(a.createdAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {comentarios.length > 0 && (
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
            <MessageSquare size={13} className="text-training" />
            Comentários em mãos revisadas
          </h3>
          <ul className="space-y-2">
            {comentarios.map((c) => (
              <li key={c.id} className="rounded-lg border border-hairline bg-elevated p-3">
                <Link href={`/revisor?shared=${c.reviewId}`} className="text-[12.5px] font-semibold text-ink hover:text-training hover:underline">
                  {c.reviewTitle}
                </Link>
                <p className="mt-0.5 text-[12.5px] text-muted">
                  <span className="font-medium text-ink/85">{c.authorName}:</span> &quot;{c.body}&quot;
                </p>
                <p className="mt-0.5 text-[11px] text-muted/70">{fmtRelativo(c.createdAt)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
