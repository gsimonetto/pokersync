"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCheck, Trash2, Info, CheckCircle2, AlertTriangle, ChevronRight, X } from "lucide-react";
import { ModalPortal } from "./modal-portal";
import { useEscapeToClose } from "@/lib/hooks/use-escape-to-close";
import {
  fetchNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  CATEGORIA_LABEL,
  type Notification,
} from "@/lib/services/notification-service";

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "agora";
  if (s < 3600) return `${Math.floor(s / 60)}min`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

const KIND_ICON = {
  info: { Icon: Info, color: "#60a5fa" },
  success: { Icon: CheckCircle2, color: "#4ade80" },
  warning: { Icon: AlertTriangle, color: "#fbbf24" },
} as const;

export function NotificationsMenu({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  useEscapeToClose(onClose);

  const unread = items.length;

  async function load() {
    setLoading(true);
    try {
      // So nao lidas: ao marcar como lida, o item sai daqui e fica no
      // historico completo em /notificacoes.
      setItems(await fetchNotifications(20, { onlyUnread: true }));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);

  async function handleItemClick(n: Notification) {
    if (!n.read) {
      setItems((prev) => prev.filter((x) => x.id !== n.id));
      try {
        await markAsRead(n.id);
      } catch {
        load();
      }
    }
    if (n.action_url) {
      onClose();
      router.push(n.action_url);
    }
  }

  async function handleMarkAll() {
    setItems([]);
    try {
      await markAllAsRead();
    } catch {
      load();
    }
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setItems((prev) => prev.filter((x) => x.id !== id));
    try {
      await deleteNotification(id);
    } catch {
      load();
    }
  }

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-16" onClick={onClose}>
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-hairline bg-surface/[0.98] shadow-2xl shadow-black/60 backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
          <span className="text-sm font-bold text-ink">Notificações</span>
          <div className="flex items-center gap-3">
            {unread > 0 && (
              <button onClick={handleMarkAll} title="Marcar tudo como lido" className="flex items-center gap-1 text-xs text-muted hover:text-ink">
                <CheckCheck size={14} /> Ler tudo
              </button>
            )}
            <button onClick={onClose} className="grid size-6 place-items-center rounded-lg text-muted hover:text-ink" aria-label="Fechar">
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="max-h-[460px] overflow-y-auto">
        {loading && items.length === 0 ? (
          <p className="p-5 text-center text-[13px] text-muted">Carregando…</p>
        ) : items.length === 0 ? (
          <p className="p-6 text-center text-[13px] text-muted">Você está em dia. Nada por ler. 👌</p>
        ) : (
          items.map((n) => {
            const meta = KIND_ICON[n.kind as keyof typeof KIND_ICON] || KIND_ICON.info;
            const Icon = meta.Icon;
            return (
              <div
                key={n.id}
                onClick={() => handleItemClick(n)}
                className={`flex cursor-pointer gap-2.5 border-b border-hairline px-4 py-3 transition-colors ${n.action_url ? "hover:bg-review/[0.08]" : "hover:bg-elevated"}`}
              >
                <Icon size={16} color={meta.color} className="mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="flex-1 text-[13px] font-semibold text-ink">{n.title}</span>
                    <span className="shrink-0 text-[11px] text-muted">{timeAgo(n.created_at)}</span>
                  </div>
                  {n.body && <p className="mt-0.5 text-xs leading-relaxed text-muted">{n.body}</p>}
                  <span className="mt-1 inline-block rounded-full border border-hairline px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-muted">
                    {CATEGORIA_LABEL[n.category] ?? "Sistema"}
                  </span>
                </div>
                <button onClick={(e) => handleDelete(n.id, e)} title="Excluir" className="shrink-0 p-0.5 text-muted">
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })
        )}
        </div>

        <Link
          href="/notificacoes"
          onClick={onClose}
          className="flex items-center justify-center gap-1 border-t border-hairline px-4 py-2.5 text-[12px] font-semibold text-muted transition-colors hover:bg-elevated hover:text-ink"
        >
          Ver todas
          <ChevronRight size={13} />
        </Link>
      </div>
    </div>
    </ModalPortal>
  );
}
