"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, ChevronDown, Landmark, SlidersHorizontal } from "lucide-react";
import type { Session } from "@/lib/bankroll/types";
import { net } from "@/lib/bankroll/calc";
import { CURRENCIES, FORMATS, fmtSignedMoneyIn, todayISO } from "@/lib/bankroll/format";
import { OUTRO_PLATFORM, PLATFORMS } from "@/lib/bankroll/platforms";
import { Modal } from "@/components/ui/modal";
import { EASE } from "@/components/painel/painel-card";
import { BOTAO_OURO, CAMPO, COR_NEGATIVO, COR_POSITIVO, ROTULO_REENTRADA, numero } from "./util";

// Registrar/editar sessão em "modo rápido": o que o grinder preenche toda
// vez (formato, buy-in, cashout, data, plataforma) fica à vista, e o
// resultado aparece na hora. O resto (horário, horas, stake, reentradas,
// moeda, notas, diário, rake e staking) mora em seções que abrem com um
// toque -- e já abrem sozinhas na edição quando têm algo preenchido.
//
// Formato e plataforma já vêm com o que o jogador mais usa (sugestões
// passadas pela página), pra registro em 3 campos.

export interface SugestoesSessao {
  formato: string;
  plataforma: string;
  moeda: string;
}

const MOODS = [
  { value: "focado", label: "Focado" },
  { value: "neutro", label: "Neutro" },
  { value: "tilt", label: "Tilt" },
];

function Secao({ titulo, icone, aberta, onToggle, children }: { titulo: string; icone: ReactNode; aberta: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02]">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[13px] font-medium text-ink/90">
        <span className="text-muted">{icone}</span>
        <span className="flex-1">{titulo}</span>
        <ChevronDown size={15} className={`text-muted transition-transform ${aberta ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {aberta && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-2 gap-2 px-3.5 pb-3.5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Rotulo({ texto, children, className = "" }: { texto: string; children: ReactNode; className?: string }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <span className="text-[11px] font-medium text-muted">{texto}</span>
      {children}
    </label>
  );
}

// Botões de escolha única (formato, humor, tilt) -- um toque em vez de abrir um select.
export function Escolhas<T extends string>({ valor, opcoes, onChange }: { valor: T; opcoes: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {opcoes.map((o) => {
        const ativo = o.value === valor;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`rounded-xl border px-3 py-1.5 text-[13px] font-medium transition active:scale-[0.97] ${
              ativo ? "border-[#d4af37]/70 bg-[#d4af37]/15 text-[#f1d78a]" : "border-white/10 bg-white/[0.03] text-muted hover:border-white/20 hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function FormularioSessao({
  aberto,
  sessao,
  inicial,
  sugestoes,
  onFechar,
  onSalvar,
}: {
  aberto: boolean;
  /** Sessão sendo editada; null = registrar nova. */
  sessao: Session | null;
  /** Nova sessão já com data/horário/horas (vindo do cronômetro). */
  inicial?: Partial<Session> | null;
  sugestoes: SugestoesSessao;
  onFechar: () => void;
  onSalvar: (rascunho: Session, editandoId: string | null) => void;
}) {
  const [formato, setFormato] = useState(sugestoes.formato);
  const [data, setData] = useState(todayISO());
  const [hora, setHora] = useState("");
  const [buyIn, setBuyIn] = useState("");
  const [reentradas, setReentradas] = useState("");
  const [cashout, setCashout] = useState("");
  const [stake, setStake] = useState("");
  const [sala, setSala] = useState(sugestoes.plataforma);
  const [salaOutra, setSalaOutra] = useState("");
  const [horas, setHoras] = useState("");
  const [moeda, setMoeda] = useState(sugestoes.moeda);
  const [notas, setNotas] = useState("");
  const [humor, setHumor] = useState("");
  const [tilt, setTilt] = useState("");
  const [aprendizado, setAprendizado] = useState("");
  const [rake, setRake] = useState("");
  const [rakeback, setRakeback] = useState("");
  const [bigBlind, setBigBlind] = useState("");
  const [minhaPct, setMinhaPct] = useState("");
  const [markup, setMarkup] = useState("");
  const [backer, setBacker] = useState("");
  const [abrirDetalhes, setAbrirDetalhes] = useState(false);
  const [abrirDiario, setAbrirDiario] = useState(false);
  const [abrirStaking, setAbrirStaking] = useState(false);
  const [aviso, setAviso] = useState("");
  const primeiroCampo = useRef<HTMLInputElement>(null);

  // Toda vez que abre: preenche com a sessão (edição) ou zera com as sugestões.
  useEffect(() => {
    if (!aberto) return;
    const s = sessao;
    const conhecida = s?.venue && (PLATFORMS as readonly string[]).includes(s.venue);
    setFormato(s?.format ?? sugestoes.formato);
    setData(s?.date ?? inicial?.date ?? todayISO());
    setHora(s?.time ?? inicial?.time ?? "");
    setBuyIn(s ? String(s.buyIn) : "");
    setReentradas(s?.reentries ? String(s.reentries) : "");
    setCashout(s ? String(s.cashout) : "");
    setStake(s?.stake ?? "");
    setSala(s ? (conhecida ? (s.venue as string) : s.venue ? OUTRO_PLATFORM : PLATFORMS[0]) : sugestoes.plataforma);
    setSalaOutra(s && !conhecida ? s.venue ?? "" : "");
    const h = s?.hours ?? inicial?.hours;
    setHoras(h != null ? String(h).replace(".", ",") : "");
    setMoeda(s?.currency ?? sugestoes.moeda);
    setNotas(s?.notes ?? "");
    setHumor(s?.mood ?? "");
    setTilt(s?.tilt != null ? String(s.tilt) : "");
    setAprendizado(s?.diaryNote ?? "");
    setRake(s?.rake != null ? String(s.rake) : "");
    setRakeback(s?.rakeback != null ? String(s.rakeback) : "");
    setBigBlind(s?.bigBlind != null ? String(s.bigBlind) : "");
    setMinhaPct(s?.ownPct != null ? String(s.ownPct) : "");
    setMarkup(s?.markup != null ? String(s.markup) : "");
    setBacker(s?.backerName ?? "");
    setAbrirDetalhes(
      Boolean(inicial?.hours != null || (s && (s.time || s.hours != null || s.stake || s.reentries || s.notes || (s.currency && s.currency !== "BRL")))),
    );
    setAbrirDiario(Boolean(s && (s.mood || s.tilt != null || s.diaryNote)));
    setAbrirStaking(Boolean(s && (s.rake != null || s.rakeback != null || s.ownPct != null || s.markup != null || s.backerName)));
    setAviso("");
    setTimeout(() => primeiroCampo.current?.focus(), 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, sessao, inicial]);

  const rascunho: Session = {
    id: sessao?.id ?? `tmp-${Date.now()}`,
    date: data,
    time: hora || undefined,
    format: formato,
    buyIn: numero(buyIn) || 0,
    reentries: numero(reentradas) || 0,
    cashout: numero(cashout) || 0,
    stake,
    hours: horas ? numero(horas) : undefined,
    venue: (sala === OUTRO_PLATFORM ? salaOutra.trim() : sala) || undefined,
    currency: moeda,
    notes: notas,
    mood: humor || undefined,
    tilt: tilt ? Number(tilt) : undefined,
    diaryNote: aprendizado || undefined,
    rake: rake ? numero(rake) : undefined,
    rakeback: rakeback ? numero(rakeback) : undefined,
    bigBlind: bigBlind ? numero(bigBlind) : undefined,
    ownPct: minhaPct ? numero(minhaPct) : undefined,
    markup: markup ? numero(markup) : undefined,
    backerName: backer || undefined,
    importedHandSessionId: sessao?.importedHandSessionId,
  };
  const preenchido = buyIn.trim() !== "" && cashout.trim() !== "";
  const resultado = preenchido ? net(rascunho) : null;

  function salvar() {
    if (!preenchido || !data) {
      setAviso("Preencha buy-in, cashout e data.");
      return;
    }
    onSalvar(rascunho, sessao?.id ?? null);
  }

  const formatos = FORMATS.includes(formato) ? FORMATS : [...FORMATS, formato];

  return (
    <Modal open={aberto} onClose={onFechar} title={sessao ? "Editar sessão" : "Registrar sessão"}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          salvar();
        }}
        className="flex flex-col gap-3"
      >
        <Escolhas valor={formato} opcoes={formatos.map((f) => ({ value: f, label: f }))} onChange={setFormato} />

        <div className="grid grid-cols-2 gap-2">
          <Rotulo texto={`Buy-in (${moeda})`}>
            <input ref={primeiroCampo} inputMode="decimal" placeholder="0,00" value={buyIn} onChange={(e) => setBuyIn(e.target.value)} className={`${CAMPO} text-base tabular-nums`} />
          </Rotulo>
          <Rotulo texto={`Cashout (${moeda})`}>
            <input inputMode="decimal" placeholder="0,00" value={cashout} onChange={(e) => setCashout(e.target.value)} className={`${CAMPO} text-base tabular-nums`} />
          </Rotulo>
          <Rotulo texto="Data">
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={CAMPO} />
          </Rotulo>
          <Rotulo texto="Plataforma">
            <select value={sala} onChange={(e) => setSala(e.target.value)} className={CAMPO}>
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
              <option value={OUTRO_PLATFORM}>{OUTRO_PLATFORM}</option>
            </select>
          </Rotulo>
          {sala === OUTRO_PLATFORM && (
            <Rotulo texto="Qual plataforma?" className="col-span-2">
              <input value={salaOutra} onChange={(e) => setSalaOutra(e.target.value)} className={CAMPO} />
            </Rotulo>
          )}
          {formato === "Cash" && (
            <Rotulo texto="Big blind da mesa (pro bb/hora)" className="col-span-2">
              <input inputMode="decimal" placeholder="Ex.: 0,50" value={bigBlind} onChange={(e) => setBigBlind(e.target.value)} className={CAMPO} />
            </Rotulo>
          )}
        </div>

        {/* Resultado na hora: o jogador confere antes de salvar. */}
        <div className="flex items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-2.5">
          <span className="text-[12px] text-muted">Resultado da sessão</span>
          <span
            className="text-lg font-bold tabular-nums"
            style={{ color: resultado == null ? "rgba(255,255,255,0.4)" : resultado >= 0 ? COR_POSITIVO : COR_NEGATIVO }}
          >
            {resultado == null ? "—" : fmtSignedMoneyIn(resultado, moeda)}
          </span>
        </div>

        <Secao titulo="Mais detalhes" icone={<SlidersHorizontal size={14} />} aberta={abrirDetalhes} onToggle={() => setAbrirDetalhes((v) => !v)}>
          <Rotulo texto="Horário de início">
            <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className={CAMPO} />
          </Rotulo>
          <Rotulo texto="Horas jogadas">
            <input inputMode="decimal" placeholder="Ex.: 3,5" value={horas} onChange={(e) => setHoras(e.target.value)} className={CAMPO} />
          </Rotulo>
          <Rotulo texto={ROTULO_REENTRADA[formato] ?? "Reentradas"}>
            <input inputMode="numeric" placeholder="0" value={reentradas} onChange={(e) => setReentradas(e.target.value)} className={CAMPO} />
          </Rotulo>
          <Rotulo texto="Stake">
            <input placeholder="Ex.: NL50, $22" value={stake} onChange={(e) => setStake(e.target.value)} className={CAMPO} />
          </Rotulo>
          <Rotulo texto="Moeda">
            <select value={moeda} onChange={(e) => setMoeda(e.target.value)} className={CAMPO}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Rotulo>
          <Rotulo texto="Notas">
            <input value={notas} onChange={(e) => setNotas(e.target.value)} className={CAMPO} />
          </Rotulo>
        </Secao>

        <Secao titulo="Diário pós-sessão" icone={<BookOpen size={14} />} aberta={abrirDiario} onToggle={() => setAbrirDiario((v) => !v)}>
          <Rotulo texto="Como foi?" className="col-span-2">
            <Escolhas valor={humor} opcoes={[{ value: "", label: "—" }, ...MOODS]} onChange={setHumor} />
          </Rotulo>
          <Rotulo texto="Nível de tilt (1 a 5)" className="col-span-2">
            <Escolhas valor={tilt} opcoes={[{ value: "", label: "—" }, ...[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))]} onChange={setTilt} />
          </Rotulo>
          <Rotulo texto="Principal aprendizado" className="col-span-2">
            <input value={aprendizado} onChange={(e) => setAprendizado(e.target.value)} className={CAMPO} />
          </Rotulo>
          <p className="col-span-2 text-[11px] text-muted/80">
            Evite incluir dados de saúde ou identificar outras pessoas aqui. Você pode editar ou apagar essa anotação a qualquer momento.
          </p>
        </Secao>

        <Secao titulo="Rake e staking" icone={<Landmark size={14} />} aberta={abrirStaking} onToggle={() => setAbrirStaking((v) => !v)}>
          <Rotulo texto="Rake pago">
            <input inputMode="decimal" value={rake} onChange={(e) => setRake(e.target.value)} className={CAMPO} />
          </Rotulo>
          <Rotulo texto="Rakeback recebido">
            <input inputMode="decimal" value={rakeback} onChange={(e) => setRakeback(e.target.value)} className={CAMPO} />
          </Rotulo>
          {formato !== "Cash" && (
            <Rotulo texto="Big blind (só cash, pro bb/hora)" className="col-span-2">
              <input inputMode="decimal" value={bigBlind} onChange={(e) => setBigBlind(e.target.value)} className={CAMPO} />
            </Rotulo>
          )}
          <p className="col-span-2 mt-1 text-[11px] text-muted/80">Staking: deixe em branco se a banca é 100% sua.</p>
          <Rotulo texto="% que é sua">
            <input inputMode="decimal" placeholder="Ex.: 50" value={minhaPct} onChange={(e) => setMinhaPct(e.target.value)} className={CAMPO} />
          </Rotulo>
          <Rotulo texto="Markup">
            <input inputMode="decimal" placeholder="Ex.: 1,1" value={markup} onChange={(e) => setMarkup(e.target.value)} className={CAMPO} />
          </Rotulo>
          <Rotulo texto="Nome do backer" className="col-span-2">
            <input value={backer} onChange={(e) => setBacker(e.target.value)} className={CAMPO} />
          </Rotulo>
        </Secao>

        {aviso && <p className="text-[12.5px] text-negative">{aviso}</p>}

        <button type="submit" className={`${BOTAO_OURO} mt-1 w-full py-2.5`}>
          {sessao ? "Salvar alterações" : "Salvar sessão"}
        </button>
      </form>
    </Modal>
  );
}
