"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, Trash2, Info, CheckCircle2, AlertTriangle } from "lucide-react";
import { fetchNotifications, markAsRead, markAllAsRead, deleteNotification, type Notification } from "@/lib/services/notification-service";

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
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const unread = items.filter((n) => !n.read).length;

  async function load() {
    setLoading(true);
    try {
      setItems(await fetchNotifications());
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

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [onClose]);

  async function handleItemClick(n: Notification) {
    if (n.read) return;
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    try {
      await markAsRead(n.id);
    } catch {
      load();
    }
  }

  async function handleMarkAll() {
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
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
    <div
      ref={ref}
      className="absolute right-0 top-[46px] z-50 w-[340px] overflow-hidden rounded-2xl border border-hairline bg-surface/[0.98] shadow-2xl shadow-black/60 backdrop-blur-xl"
    >
      <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
        <span className="text-sm font-bold text-ink">Notificações</span>
        {unread > 0 && (
          <button onClick={handleMarkAll} title="Marcar tudo como lido" className="flex items-center gap-1 text-xs text-muted hover:text-ink">
            <CheckCheck size={14} /> Ler tudo
          </button>
        )}
      </div>

      <div className="max-h-[400px] overflow-y-auto">
        {loading && items.length === 0 ? (
          <p className="p-5 text-center text-[13px] text-muted">Carregando…</p>
        ) : items.length === 0 ? (
          <p className="p-6 text-center text-[13px] text-muted">Você está em dia. Sem notificações. 👌</p>
        ) : (
          items.map((n) => {
            const meta = KIND_ICON[n.kind as keyof typeof KIND_ICON] || KIND_ICON.info;
            const Icon = meta.Icon;
            return (
              <div
                key={n.id}
                onClick={() => handleItemClick(n)}
                className={`flex cursor-pointer gap-2.5 border-b border-hairline px-4 py-3 ${n.read ? "" : "bg-evolution/[0.06]"}`}
              >
                <Icon size={16} color={meta.color} className="mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="flex-1 text-[13px] font-semibold text-ink">{n.title}</span>
                    <span className="shrink-0 text-[11px] text-muted">{timeAgo(n.created_at)}</span>
                  </div>
                  {n.body && <p className="mt-0.5 text-xs leading-relaxed text-muted">{n.body}</p>}
                </div>
                <button onClick={(e) => handleDelete(n.id, e)} title="Excluir" className="shrink-0 p-0.5 text-muted">
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
