"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock, Pause, Play, Square, Timer, X } from "lucide-react";
import type { Session } from "@/lib/bankroll/types";
import { Modal } from "@/components/ui/modal";
import { BOTAO_OURO, BOTAO_VIDRO, dataBR } from "./util";

// Cronômetro de sessão: "Iniciar" quando senta pra jogar, "Encerrar" no
// fim -- as horas jogadas se registram sozinhas (quase ninguém preenche
// esse campo à mão, e sem ele o "Por hora" fica vazio).
//
// Fica salvo no navegador (localStorage): fechar a aba ou recarregar não
// perde a contagem. Não sincroniza entre aparelhos -- quem começa no PC
// encerra no PC.
//
// Pra quem joga torneio com o Radar ligado, os torneios chegam um a um
// como sessões. No fim da jornada dá pra dividir as horas entre os
// torneios do Radar daquele período: a soma das horas fica igual ao tempo
// jogado, e o "Por hora" passa a valer pra eles também. Se os torneios
// ainda não chegaram, a jornada fica guardada e a tela pergunta depois.

const CHAVE = "pokersync:banca:cronometro";
const CHAVE_PENDENTES = "pokersync:banca:jornadas-pendentes";

interface EstadoCronometro {
  inicio: number;
  pausadoDesde: number | null;
  pausadoMs: number;
}

export interface Jornada {
  inicioIso: string;
  fimIso: string;
  horas: number;
}

function ler<T>(chave: string, padrao: T): T {
  try {
    const raw = window.localStorage.getItem(chave);
    return raw ? (JSON.parse(raw) as T) : padrao;
  } catch {
    return padrao;
  }
}
function gravar(chave: string, valor: unknown) {
  try {
    if (valor == null) window.localStorage.removeItem(chave);
    else window.localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    // sem localStorage (modo privado): vale só enquanto a aba estiver aberta
  }
}

export function useCronometro() {
  const [estado, setEstado] = useState<EstadoCronometro | null>(null);
  const [pendentes, setPendentes] = useState<Jornada[]>([]);
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    setEstado(ler<EstadoCronometro | null>(CHAVE, null));
    setPendentes(ler<Jornada[]>(CHAVE_PENDENTES, []));
  }, []);

  const rodando = estado != null && estado.pausadoDesde == null;
  useEffect(() => {
    if (!rodando) return;
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [rodando]);

  const decorridoMs = estado ? (estado.pausadoDesde ?? agora) - estado.inicio - estado.pausadoMs : 0;

  const salvar = (e: EstadoCronometro | null) => {
    setEstado(e);
    gravar(CHAVE, e);
  };
  const salvarPendentes = useCallback((lista: Jornada[]) => {
    setPendentes(lista);
    gravar(CHAVE_PENDENTES, lista.length ? lista : null);
  }, []);

  function iniciar() {
    const t = Date.now();
    setAgora(t);
    salvar({ inicio: t, pausadoDesde: null, pausadoMs: 0 });
  }
  function pausar() {
    if (estado && estado.pausadoDesde == null) salvar({ ...estado, pausadoDesde: Date.now() });
  }
  function retomar() {
    if (estado?.pausadoDesde != null) {
      const t = Date.now();
      setAgora(t);
      salvar({ ...estado, pausadoMs: estado.pausadoMs + (t - estado.pausadoDesde), pausadoDesde: null });
    }
  }
  /** Para o relógio e devolve a jornada (horas com 2 casas). */
  function encerrar(): Jornada | null {
    if (!estado) return null;
    const fim = estado.pausadoDesde ?? Date.now();
    const horas = Math.max(0, (fim - estado.inicio - estado.pausadoMs) / 3_600_000);
    salvar(null);
    return { inicioIso: new Date(estado.inicio).toISOString(), fimIso: new Date(fim).toISOString(), horas: +horas.toFixed(2) };
  }

  return { estado, decorridoMs, pausado: estado?.pausadoDesde != null, iniciar, pausar, retomar, encerrar, pendentes, salvarPendentes };
}

export function formatarDuracao(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function horasPorExtenso(h: number): string {
  const min = Math.round(h * 60);
  const hh = Math.floor(min / 60);
  const mm = min % 60;
  return hh > 0 ? `${hh}h${mm > 0 ? ` ${String(mm).padStart(2, "0")}min` : ""}` : `${mm} min`;
}

// Data local "aaaa-mm-dd" de um ISO (a sessão guarda a data local).
export function dataLocal(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Torneios do Radar sem horas, jogados nos dias da jornada. */
export function torneiosDaJornada(j: Jornada, sessoes: Session[]): Session[] {
  const de = dataLocal(j.inicioIso);
  const ate = dataLocal(j.fimIso);
  return sessoes.filter((s) => s.importedHandSessionId && !(Number(s.hours) > 0) && s.date >= de && s.date <= ate);
}

// ---------------------------------------------------------------------
// Controle no cabeçalho: botão "Cronômetro" parado; relógio + pausar +
// encerrar quando está contando.
export function ControleCronometro({
  c,
  alerta,
  onEncerrar,
}: {
  c: ReturnType<typeof useCronometro>;
  /** Limite de perda do dia batido: o relógio fica vermelho. */
  alerta?: boolean;
  onEncerrar: (j: Jornada) => void;
}) {
  if (!c.estado) {
    return (
      <button type="button" onClick={c.iniciar} className={`${BOTAO_VIDRO} whitespace-nowrap`} title="Começar a contar o tempo de jogo">
        <Timer size={15} /> Cronômetro
      </button>
    );
  }
  const cor = alerta ? "#e0555a" : c.pausado ? "#f59e0b" : "#22c55e";
  return (
    <div
      className="flex items-center gap-1 whitespace-nowrap rounded-xl border bg-white/[0.03] py-1 pl-3 pr-1"
      style={{ borderColor: `${cor}66` }}
      title={alerta ? "Você bateu o limite de perda do dia" : c.pausado ? "Pausado" : "Sessão em andamento"}
    >
      <span className="relative mr-1 flex h-2 w-2">
        {!c.pausado && <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: cor }} />}
        <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: cor }} />
      </span>
      <span className="tnum mr-1 text-[13px] font-semibold text-ink">{formatarDuracao(c.decorridoMs)}</span>
      <button
        type="button"
        onClick={c.pausado ? c.retomar : c.pausar}
        aria-label={c.pausado ? "Continuar" : "Pausar"}
        title={c.pausado ? "Continuar" : "Pausar (intervalo)"}
        className="grid h-7 w-7 place-items-center rounded-lg text-muted transition hover:bg-white/[0.08] hover:text-ink"
      >
        {c.pausado ? <Play size={14} /> : <Pause size={14} />}
      </button>
      <button
        type="button"
        onClick={() => {
          const j = c.encerrar();
          if (j) onEncerrar(j);
        }}
        aria-label="Encerrar sessão"
        title="Encerrar sessão"
        className="grid h-7 w-7 place-items-center rounded-lg text-muted transition hover:bg-white/[0.08] hover:text-negative"
      >
        <Square size={13} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------
// Fim da jornada: lançar como sessão ou dividir entre os torneios do Radar.
export function ModalFimJornada({
  jornada,
  sessoes,
  onFechar,
  onLancarSessao,
  onAplicarTorneios,
  onGuardar,
}: {
  jornada: Jornada | null;
  sessoes: Session[];
  onFechar: () => void;
  onLancarSessao: (j: Jornada) => void;
  onAplicarTorneios: (j: Jornada, torneios: Session[]) => void;
  /** Guarda a jornada pra aplicar quando os torneios do Radar chegarem. */
  onGuardar: (j: Jornada) => void;
}) {
  const torneios = useMemo(() => (jornada ? torneiosDaJornada(jornada, sessoes) : []), [jornada, sessoes]);
  if (!jornada) return null;
  const inicio = new Date(jornada.inicioIso);
  return (
    <Modal open onClose={onFechar} title="Sessão encerrada">
      <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3.5">
        <Clock size={20} className="text-[#d4af37]" />
        <div>
          <p className="text-[22px] font-bold leading-none text-ink">{horasPorExtenso(jornada.horas)}</p>
          <p className="mt-1 text-[12px] text-muted">
            Começou {dataBR(dataLocal(jornada.inicioIso))} às {String(inicio.getHours()).padStart(2, "0")}:
            {String(inicio.getMinutes()).padStart(2, "0")}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {torneios.length > 0 && (
          <button type="button" onClick={() => onAplicarTorneios(jornada, torneios)} className={`${BOTAO_OURO} w-full py-2.5`}>
            Dividir entre os {torneios.length} {torneios.length === 1 ? "torneio" : "torneios"} do Radar desse período
          </button>
        )}
        <button type="button" onClick={() => onLancarSessao(jornada)} className={`${torneios.length > 0 ? BOTAO_VIDRO : BOTAO_OURO} w-full py-2.5`}>
          Lançar como uma sessão (com resultado)
        </button>
        {torneios.length === 0 && (
          <button type="button" onClick={() => onGuardar(jornada)} className={`${BOTAO_VIDRO} w-full py-2.5`}>
            Esperar os torneios do Radar chegarem
          </button>
        )}
      </div>
      <p className="mt-3 text-[11.5px] leading-relaxed text-muted">
        {torneios.length > 0
          ? "Dividir: cada torneio do Radar desse período ganha uma parte igual do tempo. Assim o seu ganho por hora passa a contar esses torneios."
          : "Joga torneio com o Radar ligado? Se os torneios ainda não chegaram, escolha esperar: quando eles aparecerem aqui, a tela pergunta se quer dividir as horas entre eles."}
      </p>
    </Modal>
  );
}

// ---------------------------------------------------------------------
// Aviso de jornada guardada cujos torneios do Radar já chegaram.
export function AvisoJornadas({
  pendentes,
  sessoes,
  onAplicar,
  onDescartar,
}: {
  pendentes: Jornada[];
  sessoes: Session[];
  onAplicar: (j: Jornada, torneios: Session[]) => void;
  onDescartar: (j: Jornada) => void;
}) {
  const prontas = pendentes
    .map((j) => ({ j, torneios: torneiosDaJornada(j, sessoes) }))
    .filter((x) => x.torneios.length > 0);
  if (prontas.length === 0) return null;
  return (
    <div className="mb-3 flex shrink-0 flex-col gap-2">
      {prontas.map(({ j, torneios }) => (
        <div key={j.inicioIso} className="flex flex-wrap items-center gap-2 rounded-xl border border-[#d4af37]/30 bg-[#d4af37]/[0.07] px-3 py-2 text-[12.5px] text-ink/90">
          <Timer size={15} className="shrink-0 text-[#d4af37]" />
          <span className="flex-1">
            Jornada de {dataBR(dataLocal(j.inicioIso))} ({horasPorExtenso(j.horas)}): os {torneios.length} torneios do Radar chegaram. Dividir as horas entre eles?
          </span>
          <button type="button" onClick={() => onAplicar(j, torneios)} className="rounded-lg bg-[#d4af37] px-2.5 py-1 text-[12px] font-semibold text-black">
            Dividir
          </button>
          <button type="button" onClick={() => onDescartar(j)} aria-label="Descartar jornada" className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:text-ink">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
