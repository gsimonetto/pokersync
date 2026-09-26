"use client";

import { useSyncExternalStore } from "react";
import { fetchPreferenciasMesa, salvarPreferenciasMesaNaConta } from "@/lib/services/profile-service";

// Preferências da mesa (Treino e Revisor). Ficam na CONTA (profiles.
// preferencias_mesa), pra acompanhar a pessoa em qualquer aparelho, com uma
// cópia no navegador: a mesa já abre com a escolha certa, sem esperar a
// rede, e a conta confirma logo depois. Um lugar só pra todas, com aviso
// pra quem está na tela: trocar o baralho nas Configurações muda as cartas
// na hora, sem recarregar, e uma troca feita em outra aba também chega.
export type CorFeltro = "padrao" | "verde" | "azul" | "vinho" | "grafite";
export type Baralho = "4cores" | "2cores";
export type UnidadeValor = "bb" | "fichas";
export type VelocidadeAnimacao = "normal" | "rapida" | "sem";
export type TempoDecisao = 0 | 10 | 15 | 20;
/** Estilo das cartas (ver components/drill/carta-estilos.tsx). */
export type EstiloCartaPref = "solido" | "classico" | "jumbo";
/** Estilo da mesa (ver TEMAS_MESA em components/drill/poker-table.tsx). */
export type EstiloMesa = "arena" | "luxo";

export interface PreferenciasMesa {
  /** Cor do feltro (M9). "padrao" = azul no Treino, vinho no Revisor. */
  feltro: CorFeltro;
  /** Baralho de 4 cores (padrão) ou 2 cores (M9). */
  baralho: Baralho;
  /** Valores da mesa do Revisor em BB ou em fichas (M8). */
  unidade: UnidadeValor;
  /** Velocidade das animações do Treino (M10). */
  animacao: VelocidadeAnimacao;
  /** Segundos pra decidir no Treino; 0 = sem tempo (M11). */
  tempo: TempoDecisao;
  /** Estilo das cartas: Cor Sólida Premium (padrão), Clássico de Cassino ou Índice Jumbo. */
  carta: EstiloCartaPref;
  /** Estilo da mesa: Arena (padrão) ou Luxo Moderno. */
  mesa: EstiloMesa;
}

const PADRAO: PreferenciasMesa = { feltro: "padrao", baralho: "4cores", unidade: "bb", animacao: "normal", tempo: 0, carta: "solido", mesa: "arena" };
const OPCOES: { [K in keyof PreferenciasMesa]: readonly PreferenciasMesa[K][] } = {
  feltro: ["padrao", "verde", "azul", "vinho", "grafite"],
  baralho: ["4cores", "2cores"],
  unidade: ["bb", "fichas"],
  animacao: ["normal", "rapida", "sem"],
  tempo: [0, 10, 15, 20],
  carta: ["solido", "classico", "jumbo"],
  mesa: ["arena", "luxo"],
};

const CHAVE = "pokersync:mesa:preferencias";
// Mesma aba: o "storage" do navegador só avisa as OUTRAS abas.
const EVENTO = "pokersync:mesa:preferencias";
// Várias trocas seguidas (ex.: clicando nas cores) viram UMA gravação.
const ESPERA_GRAVAR_MS = 600;

// Cache pra devolver o MESMO objeto enquanto nada mudou -- exigência do
// useSyncExternalStore (objeto novo a cada leitura = render sem fim).
let cache: PreferenciasMesa | null = null;
let carregouDaConta = false;
let ultimaTrocaEm = 0;
let gravacaoPendente: number | null = null;

function valida<K extends keyof PreferenciasMesa>(chave: K, valor: unknown): PreferenciasMesa[K] {
  return (OPCOES[chave] as readonly unknown[]).includes(valor) ? (valor as PreferenciasMesa[K]) : PADRAO[chave];
}

function normaliza(salvo: Record<string, unknown>): PreferenciasMesa {
  return {
    feltro: valida("feltro", salvo.feltro),
    baralho: valida("baralho", salvo.baralho),
    unidade: valida("unidade", salvo.unidade),
    animacao: valida("animacao", salvo.animacao),
    tempo: valida("tempo", salvo.tempo),
    carta: valida("carta", salvo.carta),
    mesa: valida("mesa", salvo.mesa),
  };
}

function guardarNoAparelho(p: PreferenciasMesa): void {
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(p));
  } catch {
    // modo privado -- vale só enquanto a tela estiver aberta
  }
}

function ler(): PreferenciasMesa {
  if (cache) return cache;
  let salvo: Record<string, unknown> = {};
  try {
    const bruto = window.localStorage.getItem(CHAVE);
    if (bruto) salvo = JSON.parse(bruto) ?? {};
  } catch {
    // modo privado / dado corrompido -- fica no padrão
  }
  cache = normaliza(salvo);
  return cache;
}

// Uma vez por carregamento de página: traz o que está salvo na conta. Se a
// pessoa trocou algo enquanto isso carregava, vale a troca (que já vai
// ser gravada na conta em seguida).
function carregarDaConta(): void {
  if (carregouDaConta) return;
  carregouDaConta = true;
  const inicio = Date.now();
  fetchPreferenciasMesa()
    .then((daConta) => {
      if (!daConta || ultimaTrocaEm > inicio) return;
      cache = normaliza(daConta);
      guardarNoAparelho(cache);
      window.dispatchEvent(new Event(EVENTO));
    })
    .catch(() => {
      // sem rede / sem sessão -- segue com a cópia do aparelho
    });
}

function assinar(avisar: () => void): () => void {
  carregarDaConta();
  // Outra aba mudou: relê do navegador. Mesma aba: o cache já foi
  // atualizado em salvarPreferenciaMesa (e vale mesmo sem localStorage).
  const outraAba = (e: StorageEvent) => {
    if (e.key !== null && e.key !== CHAVE) return;
    cache = null;
    avisar();
  };
  window.addEventListener("storage", outraAba);
  window.addEventListener(EVENTO, avisar);
  return () => {
    window.removeEventListener("storage", outraAba);
    window.removeEventListener(EVENTO, avisar);
  };
}

export function usePreferenciasMesa(): PreferenciasMesa {
  // No servidor (e na 1ª pintura) vale o padrão -- é o visual de sempre.
  return useSyncExternalStore(assinar, ler, () => PADRAO);
}

export function salvarPreferenciaMesa<K extends keyof PreferenciasMesa>(chave: K, valor: PreferenciasMesa[K]): void {
  cache = { ...ler(), [chave]: valor };
  ultimaTrocaEm = Date.now();
  guardarNoAparelho(cache);
  window.dispatchEvent(new Event(EVENTO));
  if (gravacaoPendente != null) window.clearTimeout(gravacaoPendente);
  gravacaoPendente = window.setTimeout(() => {
    gravacaoPendente = null;
    salvarPreferenciasMesaNaConta({ ...ler() }).catch(() => {
      // sem rede agora -- a cópia do aparelho continua valendo
    });
  }, ESPERA_GRAVAR_MS);
}
