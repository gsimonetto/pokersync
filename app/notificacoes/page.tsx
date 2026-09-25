"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MotionConfig } from "framer-motion";
import { Bell, CheckCheck, Inbox, ListChecks, Settings, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PainelVisual } from "@/components/dashboard/kit";
import { PerfEstilos } from "@/components/performance/perf-estilos";
import { AbasAnimadas } from "@/components/performance/abas-animadas";
import { ItemNotificacao } from "@/components/notifications-menu";
import { BOTAO_VIDRO } from "@/components/banca/util";
import {
  deleteNotification,
  fetchNotifications,
  fetchUnreadCountByCategory,
  markAllAsRead,
  markAsRead,
  type Notification,
  type NotificationCategory,
} from "@/lib/services/notification-service";

// Historico completo. O sino mostra so o que esta por ler; aqui fica
// tudo, lido ou nao, com filtro por categoria. Mesmo visual de vidro das
// outras telas (casca, abas animadas e o cartao da janela do sino).

type Filtro = NotificationCategory | "todas";

function quando(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function NotificacoesPage() {
  const router = useRouter();
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [items, setItems] = useState<Notification[]>([]);
  const [naoLidas, setNaoLidas] = useState<Record<NotificationCategory, number>>({
    sistema: 0,
    tarefas: 0,
    team: 0,
  });
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [lista, contagem] = await Promise.all([
        fetchNotifications(100, { category: filtro }),
        fetchUnreadCountByCategory().catch(() => ({ sistema: 0, tarefas: 0, team: 0 })),
      ]);
      setItems(lista);
      setNaoLidas(contagem);
    } catch {
      // createClient() (dentro de fetchNotifications) lanca sincrono se
      // as envs do Supabase nao estiverem configuradas -- sem o catch
      // isso escapava como rejeicao nao tratada (o `finally` sozinho
      // nao capturava a excecao, so' garantia o setLoading(false)).
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filtro]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function abrir(n: Notification) {
    if (!n.read) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setNaoLidas((prev) => ({ ...prev, [n.category]: Math.max(0, prev[n.category] - 1) }));
      markAsRead(n.id).catch(() => carregar());
    }
    if (n.action_url) router.push(n.action_url);
  }

  async function lerTudo() {
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
    setNaoLidas({ sistema: 0, tarefas: 0, team: 0 });
    markAllAsRead().catch(() => carregar());
  }

  async function excluir(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setItems((prev) => prev.filter((x) => x.id !== id));
    deleteNotification(id).catch(() => carregar());
  }

  const totalNaoLidas = naoLidas.sistema + naoLidas.tarefas + naoLidas.team;

  return (
    <AppShell>
      <PainelVisual value="vidro">
        <MotionConfig reducedMotion="user">
          <main className="perf w-full px-3 pb-12 pt-4 text-ink sm:px-4 sm:pt-6 md:px-6">
            <PerfEstilos />
            <header className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <h1 className="text-[21px] font-semibold tracking-tight sm:text-3xl">Notificações</h1>
                <p className="mt-1 text-[12.5px] text-muted">{totalNaoLidas > 0 ? `${totalNaoLidas} por ler` : "Tudo lido"}</p>
              </div>
              {totalNaoLidas > 0 && (
                <button onClick={lerTudo} className={`${BOTAO_VIDRO} self-start sm:self-auto`}>
                  <CheckCheck size={15} /> Ler tudo
                </button>
              )}
            </header>

            <div className="sticky top-0 z-30 -mx-3 mb-3.5 border-b border-white/[0.06] bg-black/70 px-3 pt-1 backdrop-blur-xl sm:-mx-4 sm:px-4 md:-mx-6 md:px-6">
              <AbasAnimadas<Filtro>
                value={filtro}
                onChange={setFiltro}
                rotulo="Categorias de notificação"
                options={[
                  { value: "todas", label: "Todas", icon: Inbox, badge: totalNaoLidas || undefined },
                  { value: "sistema", label: "Sistema", icon: Settings, badge: naoLidas.sistema || undefined },
                  { value: "tarefas", label: "Tarefas", icon: ListChecks, badge: naoLidas.tarefas || undefined },
                  { value: "team", label: "Time", icon: Users, badge: naoLidas.team || undefined },
                ]}
              />
            </div>

            <section className="painel-vidro max-w-4xl rounded-3xl border border-white/10 p-2 sm:p-3">
              {loading ? (
                <div className="flex flex-col gap-2 p-1" aria-hidden>
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="painel-esqueleto h-[74px] rounded-2xl" />
                  ))}
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
                  <span className="grid size-11 place-items-center rounded-2xl border border-white/10 bg-white/[0.03] text-[#d4af37]">
                    <Bell size={20} />
                  </span>
                  <p className="text-[13px] font-medium text-ink">Nada por aqui</p>
                  <p className="text-[12px] text-muted">Nenhuma notificação nesta categoria.</p>
                </div>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {items.map((n) => (
                    <ItemNotificacao key={n.id} n={n} quando={quando(n.created_at)} onAbrir={() => abrir(n)} onExcluir={(e) => excluir(n.id, e)} />
                  ))}
                </ul>
              )}
            </section>
          </main>
        </MotionConfig>
      </PainelVisual>
    </AppShell>
  );
}
