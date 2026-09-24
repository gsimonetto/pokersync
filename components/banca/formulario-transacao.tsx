"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import type { Annotation, Transaction, TransactionType } from "@/lib/bankroll/types";
import { CURRENCIES, todayISO } from "@/lib/bankroll/format";
import { OUTRO_PLATFORM, PLATFORMS } from "@/lib/bankroll/platforms";
import { Modal } from "@/components/ui/modal";
import { Escolhas } from "./formulario-sessao";
import { BOTAO_OURO, CAMPO, TIPO_TX, dataBR, numero } from "./util";

// Depósito / saque / caixinha. Não entra no resultado de jogo: só move
// dinheiro entre a banca de jogo e o que está guardado.
export function FormularioTransacao({
  aberto,
  sugestoes,
  onFechar,
  onSalvar,
}: {
  aberto: boolean;
  sugestoes: { plataforma: string; moeda: string };
  onFechar: () => void;
  onSalvar: (t: Transaction) => void;
}) {
  const [tipo, setTipo] = useState<TransactionType>("deposito");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(todayISO());
  const [nota, setNota] = useState("");
  const [sala, setSala] = useState(sugestoes.plataforma);
  const [salaOutra, setSalaOutra] = useState("");
  const [moeda, setMoeda] = useState(sugestoes.moeda);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    if (!aberto) return;
    setValor("");
    setData(todayISO());
    setNota("");
    setSala(sugestoes.plataforma);
    setSalaOutra("");
    setMoeda(sugestoes.moeda);
    setAviso("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  function salvar() {
    const v = numero(valor);
    if (!(v > 0) || !data) {
      setAviso("Preencha o valor e a data.");
      return;
    }
    onSalvar({
      id: `tmp-${Date.now()}`,
      date: data,
      type: tipo,
      amount: v,
      note: nota,
      venue: (sala === OUTRO_PLATFORM ? salaOutra.trim() : sala) || undefined,
      currency: moeda,
    });
  }

  const explicacao: Record<TransactionType, string> = {
    deposito: "Dinheiro que entrou na banca de jogo.",
    saque: "Dinheiro que você tirou da banca pra uso pessoal.",
    caixinha: "Dinheiro separado da banca de jogo, mas que continua sendo seu (reserva).",
  };

  return (
    <Modal open={aberto} onClose={onFechar} title="Depósito, saque ou caixinha">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          salvar();
        }}
        className="flex flex-col gap-3"
      >
        <Escolhas valor={tipo} opcoes={(Object.keys(TIPO_TX) as TransactionType[]).map((t) => ({ value: t, label: TIPO_TX[t] }))} onChange={setTipo} />
        <p className="-mt-1 text-[12px] text-muted">{explicacao[tipo]} Não entra no resultado de jogo.</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-muted">Valor</span>
            <input autoFocus inputMode="decimal" placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} className={`${CAMPO} text-base tabular-nums`} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-muted">Moeda</span>
            <select value={moeda} onChange={(e) => setMoeda(e.target.value)} className={CAMPO}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-muted">Data</span>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={CAMPO} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-muted">Plataforma</span>
            <select value={sala} onChange={(e) => setSala(e.target.value)} className={CAMPO}>
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
              <option value={OUTRO_PLATFORM}>{OUTRO_PLATFORM}</option>
            </select>
          </label>
          {sala === OUTRO_PLATFORM && (
            <label className="col-span-2 flex flex-col gap-1">
              <span className="text-[11px] font-medium text-muted">Qual plataforma?</span>
              <input value={salaOutra} onChange={(e) => setSalaOutra(e.target.value)} className={CAMPO} />
            </label>
          )}
          <label className="col-span-2 flex flex-col gap-1">
            <span className="text-[11px] font-medium text-muted">Nota (opcional)</span>
            <input value={nota} onChange={(e) => setNota(e.target.value)} className={CAMPO} />
          </label>
        </div>
        {aviso && <p className="text-[12.5px] text-negative">{aviso}</p>}
        <button type="submit" className={`${BOTAO_OURO} w-full py-2.5`}>
          Registrar {TIPO_TX[tipo].toLowerCase()}
        </button>
      </form>
    </Modal>
  );
}

// Anotações no gráfico de evolução (ex.: "Subi pra NL100").
export function ModalAnotacoes({
  aberto,
  anotacoes,
  onFechar,
  onAdicionar,
  onRemover,
}: {
  aberto: boolean;
  anotacoes: Annotation[];
  onFechar: () => void;
  onAdicionar: (data: string, nota: string) => void;
  onRemover: (id: string) => void;
}) {
  const [data, setData] = useState(todayISO());
  const [nota, setNota] = useState("");

  function adicionar() {
    if (!nota.trim()) return;
    onAdicionar(data, nota);
    setNota("");
  }

  return (
    <Modal open={aberto} onClose={onFechar} title="Anotações no gráfico">
      <p className="text-[12px] text-muted">Marque momentos importantes (subida de stake, pausa, mudança de rotina). Aparecem como bolinha roxa na curva.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          adicionar();
        }}
        className="mt-3 grid grid-cols-[auto_1fr] gap-2"
      >
        <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={CAMPO} />
        <input placeholder="Ex.: Subi pra NL100" value={nota} onChange={(e) => setNota(e.target.value)} className={CAMPO} />
        <button type="submit" className={`${BOTAO_OURO} col-span-2 py-2.5`}>
          Adicionar
        </button>
      </form>
      {anotacoes.length > 0 && (
        <ul className="mt-4 flex flex-col gap-1.5">
          {[...anotacoes].reverse().map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2">
              <p className="text-[13px] text-ink">
                <span className="text-muted">{dataBR(a.date)}</span> · {a.note}
              </p>
              <button type="button" onClick={() => onRemover(a.id)} aria-label="Remover anotação" className="shrink-0 text-muted transition-colors hover:text-negative">
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
