"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, CircleHelp, FileText, Mail, Search, Settings, ShieldCheck } from "lucide-react";
import { JanelaVidro, CabecalhoJanela } from "@/components/ui/janela-vidro";

type Faq = { q: string; a: string };

// Perguntas por assunto -- a busca procura na pergunta e na resposta.
const GRUPOS: { titulo: string; itens: Faq[] }[] = [
  {
    titulo: "Começando",
    itens: [
      {
        q: "Como registrar uma sessão de bankroll?",
        a: "Acesse Gestão de Banca → Registrar sessão. Preencha data, formato, buy-in e cashout. O sistema calcula ROI e leaks automaticamente.",
      },
      {
        q: "Como funciona o Modo Treino?",
        a: "As mãos (spots) são resolvidas com solver GTO e ficam num catálogo compartilhado. Seu desempenho, porém, é individual e privado.",
      },
    ],
  },
  {
    titulo: "Conta e privacidade",
    itens: [
      {
        q: "Meus dados ficam privados?",
        a: "Sim. Cada usuário só acessa suas próprias sessões, notificações e histórico de treinos — garantido por políticas de segurança no banco (RLS).",
      },
      {
        q: "Esqueci minha senha, o que faço?",
        a: "Na tela de login, clique em 'Esqueci minha senha' e siga as instruções enviadas no seu e-mail. Logado, você troca a senha em Configurações → Conta.",
      },
      {
        q: "Onde mudo foto, banner e dias de treino?",
        a: "Em Configurações (menu lateral, embaixo). A aba Perfil tem foto e banner; a aba Disponibilidade tem horários e dias de treino.",
      },
    ],
  },
];

const SUPORTE = "suporte@pokersync.com.br";

export function HelpMenu({ onClose }: { onClose: () => void }) {
  const [aberta, setAberta] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  const grupos = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return GRUPOS;
    return GRUPOS.map((g) => ({
      ...g,
      itens: g.itens.filter((f) => f.q.toLowerCase().includes(termo) || f.a.toLowerCase().includes(termo)),
    })).filter((g) => g.itens.length > 0);
  }, [busca]);

  return (
    <JanelaVidro onClose={onClose} rotulo="Central de Ajuda">
      <CabecalhoJanela icone={<CircleHelp size={17} />} titulo="Central de Ajuda" subtitulo="Dúvidas comuns e contato" onClose={onClose} />

      <div className="border-b border-white/[0.07] p-3">
        <label className="relative flex items-center">
          <Search size={14} className="pointer-events-none absolute left-3 text-muted" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar uma dúvida…"
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-9 pr-3 text-[13px] text-ink outline-none transition-colors placeholder:text-muted/60 focus:border-[#d4af37]/60"
          />
        </label>
      </div>

      <div className="painel-scroll max-h-[min(420px,55vh)] overflow-y-auto p-3">
        {grupos.length === 0 ? (
          <p className="px-2 py-8 text-center text-[12.5px] text-muted">Nada encontrado. Tente outra palavra ou fale com o suporte abaixo.</p>
        ) : (
          grupos.map((g) => (
            <div key={g.titulo} className="mb-3 last:mb-0">
              <p className="px-1 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted/50">{g.titulo}</p>
              <ul className="flex flex-col gap-1.5">
                {g.itens.map((f) => {
                  const isOpen = aberta === f.q;
                  return (
                    <li key={f.q} className={`painel-bloco rounded-2xl border transition-colors ${isOpen ? "border-[#d4af37]/25" : "border-white/[0.05]"}`}>
                      <button
                        onClick={() => setAberta(isOpen ? null : f.q)}
                        aria-expanded={isOpen}
                        className="flex w-full items-center gap-2 px-3.5 py-3 text-left text-[13px] font-medium text-ink"
                      >
                        <span className="flex-1">{f.q}</span>
                        <ChevronDown size={15} className={`shrink-0 transition-transform ${isOpen ? "rotate-180 text-[#d4af37]" : "text-muted"}`} />
                      </button>
                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.p
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="overflow-hidden px-3.5 text-[12.5px] leading-relaxed text-muted"
                          >
                            <span className="block pb-3">{f.a}</span>
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>

      {/* Ainda com dúvida: suporte por e-mail e atalhos úteis. */}
      <div className="flex flex-col gap-2 border-t border-white/[0.07] p-3">
        <a
          href={`mailto:${SUPORTE}`}
          className="flex items-center gap-3 rounded-2xl border border-[#d4af37]/25 bg-[#d4af37]/[0.07] px-3.5 py-2.5 transition-colors hover:bg-[#d4af37]/[0.12]"
        >
          <Mail size={16} className="shrink-0 text-[#d4af37]" />
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-semibold text-ink">Falar com o suporte</span>
            <span className="block truncate text-[11.5px] text-muted">{SUPORTE}</span>
          </span>
        </a>
        <div className="flex flex-wrap gap-1.5">
          <Atalho href="/configuracoes" onClose={onClose} icone={<Settings size={13} />}>
            Configurações
          </Atalho>
          <Atalho href="/termos" onClose={onClose} icone={<FileText size={13} />}>
            Termos
          </Atalho>
          <Atalho href="/privacidade" onClose={onClose} icone={<ShieldCheck size={13} />}>
            Privacidade
          </Atalho>
        </div>
      </div>
    </JanelaVidro>
  );
}

function Atalho({ href, onClose, icone, children }: { href: string; onClose: () => void; icone: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      onClick={onClose}
      className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[12px] text-muted transition hover:border-white/20 hover:text-ink"
    >
      {icone}
      {children}
    </Link>
  );
}
