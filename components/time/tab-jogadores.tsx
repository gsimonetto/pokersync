"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Flame, ChevronRight, Search, Tag, ArrowUpDown } from "lucide-react";
import { Avatar } from "@/components/avatar";
import {
  assignCoach,
  diasSemAtividade,
  setMemberLabel,
  traduzErroTime,
  type TeamDashboardRow,
  type TeamLabel,
} from "@/lib/services/team-service";

// Lista de jogadores. Decisoes de UX:
// - nivel colado ao nome (identidade do jogador, nao metrica);
// - etiqueta como pill colorida, editavel inline pelo admin;
// - filtro por etiqueta em cima, porque time grande se organiza por
//   buy-in e o coach quase sempre olha um recorte, nao a lista toda;
// - linha inteira clicavel para a ficha — menos fricção que um botao.

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const INATIVO_DIAS = 7;

type Ordem = "nome" | "treinos" | "acerto" | "revisadas" | "resultado";

const OPCOES_ORDEM: { key: Ordem; label: string }[] = [
  { key: "nome", label: "Nome" },
  { key: "treinos", label: "Mais treinos" },
  { key: "acerto", label: "Melhor acerto GTO" },
  { key: "revisadas", label: "Mais revisões" },
  { key: "resultado", label: "Melhor resultado" },
];

export function TabJogadores({
  jogadores,
  labels,
  isAdmin,
  coaches,
  onChange,
  onErro,
}: {
  jogadores: TeamDashboardRow[];
  labels: TeamLabel[];
  isAdmin: boolean;
  coaches: { userId: string; nome: string }[];
  onChange: () => void;
  onErro: (s: string) => void;
}) {
  const [filtroLabel, setFiltroLabel] = useState<string>("todas");
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState<Ordem>("nome");

  const lista = useMemo(() => {
    const filtrada = jogadores.filter((j) => {
      if (filtroLabel === "sem" && j.labelId) return false;
      if (filtroLabel !== "todas" && filtroLabel !== "sem" && j.labelId !== filtroLabel) return false;
      if (busca.trim() && !j.nome.toLowerCase().includes(busca.trim().toLowerCase())) return false;
      return true;
    });
    const acerto = (j: TeamDashboardRow) => (j.treinos > 0 ? j.acertosGto / j.treinos : -1);
    const sorters: Record<Ordem, (a: TeamDashboardRow, b: TeamDashboardRow) => number> = {
      nome: (a, b) => a.nome.localeCompare(b.nome),
      treinos: (a, b) => b.treinos - a.treinos,
      acerto: (a, b) => acerto(b) - acerto(a),
      revisadas: (a, b) => b.maosRevisadas - a.maosRevisadas,
      resultado: (a, b) => b.lucroNoTime - a.lucroNoTime,
    };
    return [...filtrada].sort(sorters[ordem]);
  }, [jogadores, filtroLabel, busca, ordem]);

  async function mudarEtiqueta(userId: string, labelId: string) {
    try {
      await setMemberLabel(userId, labelId || null);
      onChange();
    } catch (e) {
      onErro(traduzErroTime(e));
    }
  }

  async function mudarCoach(userId: string, coachId: string) {
    try {
      await assignCoach(userId, coachId || null);
      onChange();
    } catch (e) {
      onErro(traduzErroTime(e));
    }
  }

  return (
    <section className="rounded-xl border border-hairline bg-surface p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="flex-1 text-[15px] font-semibold">
          Jogadores <span className="ml-1 text-sm font-normal text-muted">{lista.length}</span>
        </h2>

        <div className="flex items-center gap-1.5 print:hidden">
          <ArrowUpDown size={13} className="text-muted" />
          <select
            value={ordem}
            onChange={(e) => setOrdem(e.target.value as Ordem)}
            className="rounded-lg border border-hairline bg-elevated px-2 py-1.5 text-[13px] text-ink outline-none"
          >
            {OPCOES_ORDEM.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="relative print:hidden">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar"
            className="w-40 rounded-lg border border-hairline bg-elevated py-1.5 pl-8 pr-3 text-[13px] text-ink outline-none transition-colors placeholder:text-muted/50 focus:border-ink/40"
          />
        </div>
      </div>

      {labels.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5 print:hidden">
          <Chip ativo={filtroLabel === "todas"} onClick={() => setFiltroLabel("todas")}>Todas</Chip>
          {labels.map((l) => (
            <Chip key={l.id} ativo={filtroLabel === l.id} cor={l.color} onClick={() => setFiltroLabel(l.id)}>
              {l.name}
            </Chip>
          ))}
          <Chip ativo={filtroLabel === "sem"} onClick={() => setFiltroLabel("sem")}>Sem etiqueta</Chip>
        </div>
      )}

      {lista.length === 0 ? (
        <p className="mt-6 text-sm text-muted">Nenhum jogador neste recorte.</p>
      ) : (
        <ul className="mt-4 divide-y divide-hairline">
          {lista.map((j, idx) => {
            const d = diasSemAtividade(j.lastActivityAt);
            const inativo = d === null || d >= INATIVO_DIAS;
            const pct = j.treinos > 0 ? Math.round((j.acertosGto / j.treinos) * 100) : null;
            return (
              <li key={j.userId} className="py-3">
                <div className="flex flex-wrap items-center gap-3">
                  {ordem !== "nome" && (
                    <span className={`w-5 shrink-0 text-center text-[13px] font-bold tnum ${
                      idx === 0 ? "text-evolution" : "text-muted"
                    }`}>
                      {idx + 1}
                    </span>
                  )}
                  <Avatar id={j.avatarId} url={j.avatarUrl} size={38} />

                  <div className="min-w-0 flex-[2]">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/time/jogador/${j.userId}`} className="truncate text-sm font-medium hover:underline">
                        {j.nome}
                      </Link>
                      <span className="shrink-0 rounded-md bg-elevated px-1.5 py-px text-[10px] font-bold tracking-wide text-muted">
                        NÍVEL {j.level ?? 1}
                      </span>
                      {j.labelName && (
                        <span
                          className="shrink-0 rounded-full px-2 py-px text-[10px] font-bold uppercase tracking-wider"
                          style={{ backgroundColor: `${j.labelColor}22`, color: j.labelColor ?? undefined }}
                        >
                          {j.labelName}
                        </span>
                      )}
                      {j.streakDays ? (
                        <span className="flex shrink-0 items-center gap-0.5 text-[11px] text-evolution">
                          <Flame size={11} />
                          {j.streakDays}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs text-muted">
                      Entrou em {new Date(j.joinedAt).toLocaleDateString("pt-BR")}
                      {" · "}
                      <span className={inativo ? "text-negative" : undefined}>
                        {d === null ? "nunca ativo" : d === 0 ? "ativo hoje" : `há ${d}d sem atividade`}
                      </span>
                    </p>
                  </div>

                  <Metrica label="Treinos" valor={String(j.treinos)} />
                  <Metrica label="GTO" valor={pct === null ? "—" : `${pct}%`} />
                  <Metrica label="Revisadas" valor={String(j.maosRevisadas)} />
                  <Metrica label="Jogos" valor={String(j.jogosNoTime)} />
                  <Metrica
                    label="Resultado"
                    valor={j.jogosNoTime > 0 ? BRL.format(j.lucroNoTime) : "—"}
                    tom={j.lucroNoTime > 0 ? "positivo" : j.lucroNoTime < 0 ? "negativo" : undefined}
                    largo
                  />

                  <Link href={`/time/jogador/${j.userId}`}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-hairline text-muted transition-colors hover:border-ink/40 hover:text-ink print:hidden"
                    aria-label={`Abrir ficha de ${j.nome}`}>
                    <ChevronRight size={15} />
                  </Link>
                </div>

                {isAdmin && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 pl-[50px] print:hidden">
                    <span className="flex items-center gap-1 text-[11px] text-muted">
                      <Tag size={11} /> Etiqueta
                    </span>
                    <select
                      value={j.labelId ?? ""}
                      onChange={(e) => mudarEtiqueta(j.userId, e.target.value)}
                      className="rounded-lg border border-hairline bg-elevated px-2 py-1 text-xs text-ink outline-none"
                    >
                      <option value="">Sem etiqueta</option>
                      {labels.map((l) => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>

                    {coaches.length > 0 && (
                      <>
                        <span className="ml-2 text-[11px] text-muted">Coach</span>
                        <select
                          value={j.coachId ?? ""}
                          onChange={(e) => mudarCoach(j.userId, e.target.value)}
                          className="rounded-lg border border-hairline bg-elevated px-2 py-1 text-xs text-ink outline-none"
                        >
                          <option value="">Sem coach</option>
                          {coaches.map((c) => (
                            <option key={c.userId} value={c.userId}>{c.nome}</option>
                          ))}
                        </select>
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Metrica({ label, valor, tom, largo }: { label: string; valor: string; tom?: "positivo" | "negativo"; largo?: boolean }) {
  const cor = tom === "positivo" ? "text-positive" : tom === "negativo" ? "text-negative" : "text-ink/90";
  return (
    <div className={largo ? "w-24 shrink-0 text-right" : "w-16 shrink-0 text-right"}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted">{label}</p>
      <p className={`text-[13px] font-medium tnum ${cor}`}>{valor}</p>
    </div>
  );
}

function Chip({ children, ativo, cor, onClick }: { children: React.ReactNode; ativo: boolean; cor?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-all ${
        ativo ? "border-transparent bg-ink text-void" : "border-hairline text-muted hover:text-ink"
      }`}
      style={!ativo && cor ? { color: cor, borderColor: `${cor}55` } : undefined}
    >
      {children}
    </button>
  );
}
