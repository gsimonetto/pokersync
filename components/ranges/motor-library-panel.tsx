"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Download, Library } from "lucide-react";
import type { RangeHands } from "@/components/ranges/range-grid";
import {
  ALL_POSITIONS,
  getRfiJamSpot,
  listRfiJamSpots,
  matchupKey,
  parseMatchup,
  rfiJamSpotToRangeHands,
  type RfiJamListItem,
  type RfiJamSpot,
} from "@/lib/services/rfi-jam-service";
import { useConfirm } from "@/components/confirm-dialog";

const FASES = [
  { key: "sbOpen", label: "Abrir (RFI)" },
  { key: "bbJam", label: "Responder ao jam" },
  { key: "sbCallJam", label: "Pagar o all-in" },
] as const;
type FaseKey = (typeof FASES)[number]["key"];

// Ranges pre-flop que ja saem resolvidos pelo motor (pokersync-solver,
// os mesmos specs que alimentam o drill RFI/Jam do Modo Treino) —
// carregados aqui como ponto de partida pra nao comecar toda mao do
// zero. So aparece quando ha spot no banco (senao seria uma secao
// vazia sem utilidade).
export function MotorLibraryPanel({ onLoad }: { onLoad: (hands: RangeHands) => void }) {
  const confirm = useConfirm();
  const [spots, setSpots] = useState<RfiJamListItem[]>([]);
  const [heroPos, setHeroPos] = useState("SB");
  const [villainPos, setVillainPos] = useState("BB");
  const [stackBb, setStackBb] = useState<number | null>(null);
  const [fase, setFase] = useState<FaseKey>("sbOpen");
  const [spot, setSpot] = useState<RfiJamSpot | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [aberto, setAberto] = useState(true);

  useEffect(() => {
    listRfiJamSpots()
      .then((rows) => {
        setSpots(rows);
        if (rows.length > 0) {
          const { hero, villain } = parseMatchup(rows[0].matchup);
          if (hero) setHeroPos(hero);
          if (villain) setVillainPos(villain);
          setStackBb(rows[0].stackBb);
        }
      })
      .catch(() => setErro("Erro ao listar os spots do motor."))
      .finally(() => setLoading(false));
  }, []);

  const villainsForHero = useMemo(
    () =>
      Array.from(new Set(spots.filter((s) => parseMatchup(s.matchup).hero === heroPos).map((s) => parseMatchup(s.matchup).villain))).filter(
        (v): v is string => Boolean(v)
      ),
    [spots, heroPos]
  );
  const stacksForMatchup = useMemo(
    () => Array.from(new Set(spots.filter((s) => s.matchup === matchupKey(heroPos, villainPos)).map((s) => s.stackBb))).sort((a, b) => a - b),
    [spots, heroPos, villainPos]
  );

  useEffect(() => {
    if (villainsForHero.length > 0 && !villainsForHero.includes(villainPos)) setVillainPos(villainsForHero[0]);
  }, [villainsForHero, villainPos]);

  useEffect(() => {
    if (stacksForMatchup.length === 0) return;
    if (stackBb === null || !stacksForMatchup.includes(stackBb)) setStackBb(stacksForMatchup[0]);
  }, [stacksForMatchup, stackBb]);

  const spotId = useMemo(() => {
    const key = matchupKey(heroPos, villainPos);
    return spots.find((s) => s.matchup === key && s.stackBb === stackBb)?.spotId ?? "";
  }, [spots, heroPos, villainPos, stackBb]);

  useEffect(() => {
    if (!spotId) {
      setSpot(null);
      return;
    }
    getRfiJamSpot(spotId)
      .then(setSpot)
      .catch(() => setErro("Erro ao carregar esse spot."));
  }, [spotId]);

  const handsDaFase = useMemo(() => {
    if (!spot) return null;
    return rfiJamSpotToRangeHands(spot)[fase];
  }, [spot, fase]);

  const maosAtivas = useMemo(() => {
    if (!handsDaFase) return null;
    return Object.values(handsDaFase).filter((d) => d.call > 0 || d.raise > 0).length;
  }, [handsDaFase]);

  async function carregar() {
    if (!handsDaFase) return;
    const ok = await confirm({
      tone: "default",
      title: "Carregar range da biblioteca",
      message: "Isso substitui o range atual na grade por este da biblioteca.",
      confirmLabel: "Carregar",
    });
    if (!ok) return;
    onLoad(handsDaFase);
  }

  if (loading) return null;

  // Sem spots no catalogo (banco vazio/erro): antes sumia inteiro
  // (`return null`), o que colapsava essa coluna da grid e deixava um
  // vazio grande do lado da grade de maos, sem nenhuma pista do porque.
  // Mantem a mesma caixa com uma mensagem — layout fica estavel e o
  // usuario entende que a biblioteca so' esta vazia, nao quebrada.
  if (spots.length === 0) {
    return (
      <section className="rounded-xl border border-hairline bg-surface p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Library size={15} />
          Biblioteca do motor
        </div>
        <p className="mt-1 text-[11px] text-muted">
          {erro || "Nenhum range pré-flop resolvido pelo solver disponível ainda."}
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-hairline bg-surface p-4">
      <button onClick={() => setAberto((v) => !v)} className="flex w-full items-center gap-2 text-left text-sm font-semibold">
        <Library size={15} />
        Biblioteca do motor
        <ChevronDown size={14} className={`ml-auto text-muted transition-transform ${aberto ? "rotate-180" : ""}`} />
      </button>
      <p className="mt-1 text-[11px] text-muted">
        Ranges pré-flop de RFI/Jam já resolvidos pelo solver (mesma base do Modo Treino) — use como ponto de partida.
      </p>

      {aberto && (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <select
              value={heroPos}
              onChange={(e) => setHeroPos(e.target.value)}
              className="rounded-lg border border-hairline bg-elevated px-2 py-1.5 text-xs text-ink outline-none"
            >
              {ALL_POSITIONS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <select
              value={villainPos}
              onChange={(e) => setVillainPos(e.target.value)}
              className="rounded-lg border border-hairline bg-elevated px-2 py-1.5 text-xs text-ink outline-none"
            >
              {ALL_POSITIONS.map((p) => (
                <option key={p} value={p} disabled={!villainsForHero.includes(p)}>{p}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <select
              value={stackBb ?? ""}
              onChange={(e) => setStackBb(Number(e.target.value))}
              className="rounded-lg border border-hairline bg-elevated px-2 py-1.5 text-xs text-ink outline-none"
            >
              {stacksForMatchup.map((s) => (
                <option key={s} value={s}>{s}bb</option>
              ))}
            </select>
            <select
              value={fase}
              onChange={(e) => setFase(e.target.value as FaseKey)}
              className="rounded-lg border border-hairline bg-elevated px-2 py-1.5 text-xs text-ink outline-none"
            >
              {FASES.map((f) => (
                <option key={f.key} value={f.key}>{f.label}</option>
              ))}
            </select>
          </div>

          {erro && <p className="text-xs text-negative">{erro}</p>}

          <button
            onClick={carregar}
            disabled={!handsDaFase}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-hairline bg-elevated px-3 py-2 text-xs font-medium text-ink transition-colors hover:border-ink/40 disabled:opacity-50"
          >
            <Download size={13} />
            Carregar no construtor{maosAtivas != null ? ` (${maosAtivas} mãos)` : ""}
          </button>
        </div>
      )}
    </section>
  );
}
