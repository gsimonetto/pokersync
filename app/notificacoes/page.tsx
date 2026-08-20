"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Trash2, Info, CheckCircle2, AlertTriangle } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import {
  CATEGORIA_LABEL,
  deleteNotification,
  fetchNotifications,
  fetchUnreadCountByCategory,
  markAllAsRead,
  markAsRead,
  type Notification,
  type NotificationCategory,
} from "@/lib/services/notification-service";

// Historico completo. O sino mostra so o que esta por ler; aqui fica
// tudo, lido ou nao, com filtro por categoria.
// Espacamento de borda seguindo Banca/Revisor: max-w-6xl px-6 py-10.

const KIND_ICON = {
  info: { Icon: Info, color: "#60a5fa" },
  success: { Icon: CheckCircle2, color: "#4ade80" },
  warning: { Icon: AlertTriangle, color: "#fbbf24" },
} as const;

const FILTROS: { key: NotificationCategory | "todas"; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "sistema", label: "Sistema" },
  { key: "tarefas", label: "Tarefas" },
  { key: "team", label: "Time" },
];

export default function NotificacoesPage() {
  const router = useRouter();
  const [filtro, setFiltro] = useState<NotificationCategory | "todas">("todas");
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
    <main className="mx-auto max-w-6xl px-6 py-10 text-ink">
      <AppHeader
        backHref="/modulos"
        icon={Bell}
        iconColor="var(--color-evolution)"
        title="Notificações"
        subtitle={totalNaoLidas > 0 ? `${totalNaoLidas} por ler` : "Tudo lido"}
        right={
          totalNaoLidas > 0 && (
            <button
              onClick={lerTudo}
              className="flex items-center gap-1.5 rounded-lg border border-hairline bg-elevated px-3 py-2 text-[13px] text-muted transition-colors hover:border-ink/40 hover:text-ink"
            >
              <CheckCheck size={15} />
              Ler tudo
            </button>
          )
        }
      />

      <div className="mb-4 flex flex-wrap gap-1 rounded-lg border border-hairline bg-elevated p-1">
        {FILTROS.map((f) => {
          const pendentes = f.key === "todas" ? totalNaoLidas : naoLidas[f.key];
          return (
            <button
              key={f.key}
              onClick={() => setFiltro(f.key)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] transition-all ${
                filtro === f.key ? "bg-ink text-void" : "text-muted hover:text-ink"
              }`}
            >
              {f.label}
              {pendentes > 0 && (
                <span
                  className={`rounded-full px-1.5 text-[9px] leading-4 ${
                    filtro === f.key ? "bg-void/20 text-void" : "bg-evolution text-void"
                  }`}
                >
                  {pendentes}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <section className="overflow-hidden rounded-xl border border-hairline bg-surface">
        {loading ? (
          <p className="p-6 text-sm text-muted">Carregando…</p>
        ) : items.length === 0 ? (
          <p className="p-6 text-sm text-muted">Nenhuma notificação nesta categoria.</p>
        ) : (
          items.map((n) => {
            const meta = KIND_ICON[n.kind as keyof typeof KIND_ICON] || KIND_ICON.info;
            const Icon = meta.Icon;
            return (
              <div
                key={n.id}
                onClick={() => abrir(n)}
                className={`flex cursor-pointer gap-3 border-b border-hairline px-4 py-3.5 transition-colors last:border-b-0 ${
                  n.read ? "" : "bg-evolution/[0.06]"
                } hover:bg-elevated`}
              >
                <Icon size={16} color={meta.color} className="mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="flex-1 text-[13px] font-semibold">{n.title}</span>
                    <span className="shrink-0 text-[11px] text-muted">
                      {new Date(n.created_at).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  {n.body && <p className="mt-0.5 text-xs leading-relaxed text-muted">{n.body}</p>}
                  <span className="mt-1.5 inline-block rounded-full border border-hairline px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-muted">
                    {CATEGORIA_LABEL[n.category] ?? "Sistema"}
                  </span>
                </div>
                <button
                  onClick={(e) => excluir(n.id, e)}
                  title="Excluir"
                  className="shrink-0 self-start p-0.5 text-muted transition-colors hover:text-negative"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })
        )}
      </section>
    </main>
  );
}
