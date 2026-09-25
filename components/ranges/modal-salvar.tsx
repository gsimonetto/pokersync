"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { BOTAO_OURO, BOTAO_VIDRO, CAMPO } from "@/components/banca/util";
import { NOME_ACAO, type Acao } from "@/lib/ranges/prontos";
import type { RangeAtual } from "./use-construtor";

// Salvar o range como seu (ou mudar o nome e o spot de um que já é seu).
// O spot -- posição, contra quem, stack e ação -- é o que agrupa e acha o
// range depois (e liga com o Revisor).

export const POSICOES = ["UTG", "UTG+1", "MP", "MP+1", "HJ", "CO", "BTN", "SB", "BB"];
const ACOES = Object.keys(NOME_ACAO) as Acao[];

export interface DadosRange {
  nome: string;
  posicao: string | null;
  vsPosicao: string | null;
  stack: number | null;
  acao: string | null;
}

function nomeSugerido(r: RangeAtual): string {
  if (r.origem === "pronto") return `${r.nome} (meu)`;
  if (r.origem === "real") return r.nome.replace("Seu range de verdade", "Meu range real");
  if (r.origem === "time") return `${r.nome} (cópia)`;
  if (r.origem === "novo") return "";
  return r.nome;
}

export function ModalSalvar({
  aberto,
  range,
  editar,
  onSalvar,
  onFechar,
}: {
  aberto: boolean;
  range: RangeAtual;
  /** true = mudar os dados de um range que já é seu. */
  editar: boolean;
  onSalvar: (d: DadosRange) => Promise<void>;
  onFechar: () => void;
}) {
  const [d, setD] = useState<DadosRange>({ nome: "", posicao: null, vsPosicao: null, stack: null, acao: null });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto) return;
    setD({
      nome: editar ? range.nome : nomeSugerido(range),
      posicao: range.posicao,
      vsPosicao: range.vsPosicao,
      stack: range.stack,
      acao: range.acao,
    });
    setErro(null);
    setSalvando(false);
  }, [aberto, editar, range]);

  async function salvar() {
    if (!d.nome.trim()) {
      setErro("Dê um nome pro range.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await onSalvar({ ...d, nome: d.nome.trim() });
      onFechar();
    } catch {
      setErro("Não consegui salvar agora. Tente de novo.");
      setSalvando(false);
    }
  }

  const select = `${CAMPO} !py-2`;
  return (
    <Modal open={aberto} onClose={onFechar} title={editar ? "Dados do range" : "Salvar como meu"}>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          salvar();
        }}
      >
        <label className="flex flex-col gap-1.5 text-[12.5px] text-muted">
          Nome
          <input value={d.nome} onChange={(e) => setD({ ...d, nome: e.target.value })} placeholder="Ex.: BTN abre · 40bb" className={CAMPO} autoFocus maxLength={80} />
        </label>
        <div className="grid grid-cols-2 gap-2.5">
          <label className="flex flex-col gap-1.5 text-[12.5px] text-muted">
            Posição
            <select value={d.posicao ?? ""} onChange={(e) => setD({ ...d, posicao: e.target.value || null })} className={select}>
              <option value="">—</option>
              {POSICOES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-[12.5px] text-muted">
            Contra
            <select value={d.vsPosicao ?? ""} onChange={(e) => setD({ ...d, vsPosicao: e.target.value || null })} className={select}>
              <option value="">—</option>
              {POSICOES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-[12.5px] text-muted">
            Stack (bb)
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={1000}
              value={d.stack ?? ""}
              onChange={(e) => setD({ ...d, stack: e.target.value ? Math.max(1, Math.min(1000, Math.round(Number(e.target.value)))) : null })}
              placeholder="40"
              className={CAMPO}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[12.5px] text-muted">
            Ação
            <select value={d.acao ?? ""} onChange={(e) => setD({ ...d, acao: e.target.value || null })} className={select}>
              <option value="">—</option>
              {ACOES.map((a) => (
                <option key={a} value={a}>
                  {NOME_ACAO[a]}
                </option>
              ))}
            </select>
          </label>
        </div>
        {erro && <p className="m-0 text-[12px] text-negative">{erro}</p>}
        <div className="mt-1 flex justify-end gap-2">
          <button type="button" onClick={onFechar} className={BOTAO_VIDRO}>
            Cancelar
          </button>
          <button type="submit" disabled={salvando} className={BOTAO_OURO}>
            {salvando && <Loader2 size={15} className="animate-spin" />} Salvar
          </button>
        </div>
      </form>
    </Modal>
  );
}
