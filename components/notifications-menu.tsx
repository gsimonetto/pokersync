"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, CheckCheck, Trash2, Info, CheckCircle2, AlertTriangle, ChevronRight } from "lucide-react";
import { JanelaVidro, CabecalhoJanela } from "@/components/ui/janela-vidro";
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
    <JanelaVidro onClose={onClose} rotulo="Notificações">
      <CabecalhoJanela
        icone={<Bell size={17} />}
        titulo="Notificações"
        subtitulo={unread > 0 ? `${unread} por ler` : "Tudo em dia"}
        onClose={onClose}
        acoes={
          unread > 0 && (
            <button
              onClick={handleMarkAll}
              title="Marcar tudo como lido"
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[12px] text-muted transition hover:border-white/20 hover:text-ink"
            >
              <CheckCheck size={14} /> Ler tudo
            </button>
          )
        }
      />

      <div className="painel-scroll max-h-[min(460px,65vh)] overflow-y-auto p-2">
        {loading && items.length === 0 ? (
          <div className="flex flex-col gap-2 p-1" aria-hidden>
            {[0, 1, 2].map((i) => (
              <div key={i} className="painel-esqueleto h-16 rounded-2xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <span className="grid size-11 place-items-center rounded-2xl border border-white/10 bg-white/[0.03] text-[#d4af37]">
              <CheckCheck size={20} />
            </span>
            <p className="text-[13px] font-medium text-ink">Você está em dia</p>
            <p className="text-[12px] text-muted">Nada por ler agora. O histórico fica em &quot;Ver todas&quot;.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {items.map((n) => (
              <ItemNotificacao key={n.id} n={n} quando={timeAgo(n.created_at)} onAbrir={() => handleItemClick(n)} onExcluir={(e) => handleDelete(n.id, e)} />
            ))}
          </ul>
        )}
      </div>

      <Link
        href="/notificacoes"
        onClick={onClose}
        className="flex items-center justify-center gap-1 border-t border-white/[0.07] px-4 py-3 text-[12.5px] font-semibold text-muted transition-colors hover:bg-white/[0.03] hover:text-[#d4af37]"
      >
        Ver todas
        <ChevronRight size={14} />
      </Link>
    </JanelaVidro>
  );
}

// Uma notificação no visual de vidro -- a mesma na janela do sino e na
// página /notificacoes. Não lida ganha um pontinho dourado.
export function ItemNotificacao({
  n,
  quando,
  onAbrir,
  onExcluir,
}: {
  n: Notification;
  quando: string;
  onAbrir: () => void;
  onExcluir: (e: React.MouseEvent) => void;
}) {
  const meta = KIND_ICON[n.kind as keyof typeof KIND_ICON] || KIND_ICON.info;
  const Icon = meta.Icon;
  return (
    <li
      onClick={onAbrir}
      className={`painel-bloco group flex cursor-pointer gap-3 rounded-2xl border px-3 py-3 transition-colors ${
        n.read ? "border-white/[0.05]" : "border-[#d4af37]/20"
      } hover:border-white/15`}
    >
      <span
        className="grid size-8 shrink-0 place-items-center rounded-xl"
        style={{ background: `${meta.color}1A`, color: meta.color }}
      >
        <Icon size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          {!n.read && <span className="size-1.5 shrink-0 -translate-y-0.5 rounded-full bg-[#d4af37]" aria-label="Não lida" />}
          <span className="min-w-0 flex-1 text-[13px] font-semibold text-ink">{n.title}</span>
          <span className="shrink-0 text-[11px] tabular-nums text-muted">{quando}</span>
        </div>
        {n.body && <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{n.body}</p>}
        <div className="mt-1.5 flex items-center gap-2">
          <span className="rounded-full border border-white/10 px-2 py-px text-[10px] font-medium text-muted">
            {CATEGORIA_LABEL[n.category] ?? "Sistema"}
          </span>
          {n.action_url && (
            <span className="flex items-center gap-0.5 text-[11px] text-muted/70 transition-colors group-hover:text-[#d4af37]">
              Abrir <ChevronRight size={12} />
            </span>
          )}
        </div>
      </div>
      <button
        onClick={onExcluir}
        title="Excluir"
        aria-label="Excluir notificação"
        className="grid size-7 shrink-0 place-items-center self-start rounded-lg text-muted/50 transition hover:bg-negative/10 hover:text-negative"
      >
        <Trash2 size={13} />
      </button>
    </li>
  );
}
