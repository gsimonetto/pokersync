"use client";

import { useEffect, useState } from "react";
import { Shuffle, X } from "lucide-react";
import { Card } from "@/components/drill/card";
import { Modal } from "@/components/ui/modal";
import { ModalPortal } from "@/components/modal-portal";
import { BOTAO_OURO, BOTAO_VIDRO, CAMPO } from "@/components/banca/util";
import { BARALHO, GRADE, NAIPES, lerCarta, cartaTexto } from "@/lib/ranges/cartas";
import { lerBoard, texturaDoBoard } from "@/lib/ranges/acertos";
import { CartaMini, Chip, Rotulo, simboloNaipe } from "./pecas";

// Board do Construtor: flop, turn e river. Clique num espaço pra escolher
// as cartas (ou sorteie um flop); embaixo, a textura em palavras.

export function sortearCartas(quantas: number, ocupadas: Set<string>): string[] {
  const livres = BARALHO.filter((c) => !ocupadas.has(c));
  const out: string[] = [];
  while (out.length < quantas && livres.length) out.push(livres.splice(Math.floor(Math.random() * livres.length), 1)[0]);
  return out;
}

type Escolha = { quantas: 1 | 3; posicao: 0 | 3 | 4 };

export function SeletorBoard({
  board,
  onBoard,
  aguardando,
}: {
  board: string[];
  onBoard: (cartas: string[]) => void;
  /** Espaço que está esperando carta (depois de "Levar pro turn"). */
  aguardando: 4 | 5 | null;
}) {
  const [escolha, setEscolha] = useState<Escolha | null>(null);
  const textura = texturaDoBoard(lerBoard(board));

  function abrir(i: number) {
    if (i < 3) setEscolha({ quantas: 3, posicao: 0 });
    else if (i === 3 && board.length >= 3) setEscolha({ quantas: 1, posicao: 3 });
    else if (i === 4 && board.length >= 4) setEscolha({ quantas: 1, posicao: 4 });
  }

  function escolher(cartas: string[]) {
    if (!escolha) return;
    if (escolha.posicao === 0) {
      // flop novo: turn e river ficam se não repetirem carta
      const resto = board.slice(3).filter((c) => !cartas.includes(c));
      onBoard([...cartas, ...(resto.length === board.slice(3).length ? resto : [])]);
    } else {
      const novo = board.slice(0, escolha.posicao);
      novo[escolha.posicao] = cartas[0];
      if (escolha.posicao === 3 && board[4] && board[4] !== cartas[0]) novo.push(board[4]);
      onBoard(novo);
    }
    setEscolha(null);
  }

  const ocupadas = new Set(
    escolha ? board.filter((_, i) => (escolha.posicao === 0 ? i >= 3 : i !== escolha.posicao)) : [],
  );

  return (
    <section className="painel-vidro rounded-2xl border border-white/10 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <Rotulo>Board</Rotulo>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => onBoard(sortearCartas(3, new Set()))}
            className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11.5px] text-ink/85 transition hover:bg-white/[0.07]"
          >
            <Shuffle size={12} /> {board.length ? "Outro flop" : "Sortear flop"}
          </button>
          {board.length > 0 && (
            <button
              type="button"
              onClick={() => onBoard([])}
              title="Voltar pro pré-flop"
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11.5px] text-ink/85 transition hover:bg-white/[0.07]"
            >
              <X size={12} /> Limpar
            </button>
          )}
        </div>
      </div>
      <div className="mt-2.5 flex items-center gap-1.5 sm:gap-2">
        {[0, 1, 2, 3, 4].map((i) => {
          const carta = board[i];
          const nome = i < 3 ? "Flop" : i === 3 ? "Turn" : "River";
          const liberado = i < 3 || board.length >= i;
          const esperando = aguardando === i + 1;
          if (carta)
            return (
              <button key={i} type="button" onClick={() => abrir(i)} title={`Trocar ${nome.toLowerCase()}`} className="rounded-[8px] transition hover:brightness-110 active:scale-[0.97]">
                <Card card={carta} size="board" />
              </button>
            );
          return (
            <button
              key={i}
              type="button"
              disabled={!liberado}
              onClick={() => abrir(i)}
              className={`grid h-[80px] w-[56px] shrink-0 place-items-center rounded-[8px] border text-[11px] transition ${
                esperando
                  ? "animate-pulse border-2 border-dashed border-[#d4af37]/80 font-semibold text-[#e8cb6a]"
                  : liberado
                    ? "border-dashed border-white/25 text-muted hover:border-white/45 hover:text-ink"
                    : "border-dashed border-white/10 text-muted/50"
              }`}
            >
              {nome}
            </button>
          );
        })}
      </div>
      {textura.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {textura.map((t) => (
            <Chip key={t}>{t}</Chip>
          ))}
        </div>
      ) : (
        <p className="m-0 mt-2.5 text-[11.5px] text-muted">Sem board: você está vendo o range no pré-flop.</p>
      )}
      {/* Portal: o card de vidro (backdrop-filter) prenderia o modal
          "fixed" dentro dele em vez da tela inteira. */}
      {escolha && (
        <ModalPortal>
          <SeletorCartas
            aberto
            quantas={escolha.quantas}
            titulo={escolha.posicao === 3 ? "Escolha o turn" : escolha.posicao === 4 ? "Escolha o river" : "Escolha as 3 cartas do flop"}
            ocupadas={ocupadas}
            onEscolher={escolher}
            onFechar={() => setEscolha(null)}
          />
        </ModalPortal>
      )}
    </section>
  );
}

export function SeletorCartas({
  aberto,
  quantas,
  titulo,
  ocupadas,
  onEscolher,
  onFechar,
}: {
  aberto: boolean;
  quantas: 1 | 3;
  titulo: string;
  ocupadas: Set<string>;
  onEscolher: (cartas: string[]) => void;
  onFechar: () => void;
}) {
  const [escolhidas, setEscolhidas] = useState<string[]>([]);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (aberto) {
      setEscolhidas([]);
      setTexto("");
      setErro(null);
    }
  }, [aberto]);

  function tocar(c: string) {
    if (escolhidas.includes(c)) {
      setEscolhidas(escolhidas.filter((x) => x !== c));
      return;
    }
    const novas = [...escolhidas, c].slice(-quantas);
    setEscolhidas(novas);
    if (novas.length === quantas) onEscolher(novas);
  }

  function usarTexto() {
    const limpo = texto.replace(/[\s,]/g, "").replace(/10/g, "T");
    const pedacos = limpo.match(/.{1,2}/g) ?? [];
    const cartas = pedacos.map((p) => lerCarta(p));
    if (cartas.length !== quantas || cartas.some((c) => !c)) {
      setErro(quantas === 3 ? "Digite 3 cartas, tipo Kh9d4s (h copas, d ouros, c paus, s espadas)." : "Digite 1 carta, tipo 2c.");
      return;
    }
    const txt = cartas.map((c) => cartaTexto(c!));
    if (new Set(txt).size !== txt.length || txt.some((c) => ocupadas.has(c))) {
      setErro("Tem carta repetida.");
      return;
    }
    onEscolher(txt);
  }

  return (
    <Modal open={aberto} onClose={onFechar} title={titulo} wide>
      <div className="flex flex-col gap-1.5">
        {NAIPES.map((n) => (
          <div key={n} className="grid gap-1" style={{ gridTemplateColumns: "repeat(13, minmax(0, 1fr))" }}>
            {GRADE.map((v) => {
              const c = v + n;
              const usada = ocupadas.has(c);
              const marcada = escolhidas.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  disabled={usada}
                  onClick={() => tocar(c)}
                  aria-label={`${v === "T" ? "10" : v}${simboloNaipe(n)}`}
                  aria-pressed={marcada}
                  className="rounded-[6px] transition active:scale-[0.95] disabled:cursor-not-allowed"
                  style={{ outline: marcada ? "2px solid #e8cb6a" : undefined, outlineOffset: 1, opacity: usada ? 0.2 : marcada ? 1 : 0.92 }}
                >
                  <CartaMini carta={c} className="aspect-[3/4] w-full text-[clamp(9px,2.6vw,13px)]" />
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <p className="m-0 mt-3 text-[12px] text-muted">
        {quantas === 3 ? `Toque em 3 cartas (${escolhidas.length} de 3).` : "Toque numa carta."} Ou digite:
      </p>
      <form
        className="mt-1.5 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          usarTexto();
        }}
      >
        <input
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setErro(null);
          }}
          placeholder={quantas === 3 ? "Kh9d4s" : "2c"}
          aria-label="Cartas digitadas"
          className={`${CAMPO} !py-2`}
        />
        <button type="submit" className={BOTAO_OURO}>
          Usar
        </button>
        <button type="button" onClick={() => onEscolher(sortearCartas(quantas, ocupadas))} className={`${BOTAO_VIDRO} whitespace-nowrap`}>
          <Shuffle size={14} /> Sortear
        </button>
      </form>
      {erro && <p className="m-0 mt-2 text-[12px] text-negative">{erro}</p>}
    </Modal>
  );
}
