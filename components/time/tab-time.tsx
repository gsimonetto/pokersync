"use client";

import { useRef, useState } from "react";
import { Camera, Check, ImagePlus, Pencil, Plus, ShieldCheck, Trash2, Users, X } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { TeamBanner } from "@/components/time/team-banner";
import { ACCENT } from "@/lib/modules-data";
import {
  createLabel,
  deleteLabel,
  traduzErroTime,
  updateTeamInfo,
  uploadTeamBanner,
  uploadTeamLogo,
  type TeamInfo,
  type TeamLabel,
  type TeamRole,
  type TeamStaff,
} from "@/lib/services/team-service";

// Identidade do time. Modo leitura por padrao, edicao sob demanda —
// evita uma tela de formulario permanente para algo que muda uma vez
// por ano. Admin e coach editam; jogador so le.

const PAPEL: Record<TeamRole, string> = { admin: "Administrador", coach: "Coach", player: "Jogador" };

export function TabTime({
  info,
  staff,
  labels,
  podeEditar,
  onChange,
  onErro,
}: {
  info: TeamInfo;
  staff: TeamStaff[];
  labels: TeamLabel[];
  podeEditar: boolean;
  onChange: () => void;
  onErro: (s: string) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(info.name);
  const [desc, setDesc] = useState(info.description ?? "");
  const [cor, setCor] = useState(info.accent);
  const [salvando, setSalvando] = useState(false);
  const [enviandoLogo, setEnviandoLogo] = useState(false);
  const [enviandoBanner, setEnviandoBanner] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

  async function salvar() {
    if (!nome.trim()) return onErro("O time precisa de um nome.");
    setSalvando(true);
    try {
      await updateTeamInfo({ name: nome.trim(), description: desc.trim() || null, accent: cor });
      setEditando(false);
      onChange();
    } catch (e) {
      onErro(traduzErroTime(e));
    } finally {
      setSalvando(false);
    }
  }

  async function enviarLogo(file: File) {
    if (file.size > 2 * 1024 * 1024) return onErro("Imagem muito grande (máximo 2 MB).");
    setEnviandoLogo(true);
    try {
      await uploadTeamLogo(info.id, file);
      onChange();
    } catch (e) {
      onErro(traduzErroTime(e));
    } finally {
      setEnviandoLogo(false);
    }
  }

  async function enviarBanner(file: File) {
    if (file.size > 4 * 1024 * 1024) return onErro("Imagem muito grande (máximo 4 MB).");
    setEnviandoBanner(true);
    try {
      await uploadTeamBanner(info.id, file);
      onChange();
    } catch (e) {
      onErro(traduzErroTime(e));
    } finally {
      setEnviandoBanner(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="relative">
        <TeamBanner name={info.name} accent={info.accent} logoUrl={info.logoUrl} bannerUrl={info.bannerUrl} />
        {podeEditar && (
          <>
            <button
              onClick={() => bannerRef.current?.click()}
              disabled={enviandoBanner}
              className="absolute right-4 top-4 flex items-center gap-1.5 rounded-lg border border-white/25 bg-void/60 px-3 py-1.5 text-[12px] font-medium text-white backdrop-blur-sm transition-colors hover:bg-void/80 print:hidden"
            >
              <ImagePlus size={13} />
              {enviandoBanner ? "Enviando…" : info.bannerUrl ? "Trocar banner" : "Adicionar banner"}
            </button>
            <input
              ref={bannerRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) enviarBanner(f);
                e.target.value = "";
              }}
            />
          </>
        )}
      </div>

      <section className="rounded-xl border border-hairline bg-surface p-5">
        <div className="flex flex-wrap items-start gap-5">
          <div className="relative shrink-0">
            <div
              className="grid h-24 w-24 place-items-center overflow-hidden rounded-2xl border border-hairline"
              style={{ backgroundColor: `${info.accent}18` }}
            >
              {info.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={info.logoUrl} alt={info.name} className="h-full w-full object-cover" />
              ) : (
                <Users size={30} style={{ color: info.accent }} />
              )}
            </div>
            {podeEditar && (
              <>
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={enviandoLogo}
                  aria-label="Alterar foto do time"
                  className="absolute -bottom-1.5 -right-1.5 grid h-8 w-8 place-items-center rounded-full border border-hairline bg-elevated text-muted transition-colors hover:text-ink print:hidden"
                >
                  <Camera size={14} />
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) enviarLogo(f);
                    e.target.value = "";
                  }}
                />
              </>
            )}
          </div>

          <div className="min-w-0 flex-1">
            {editando ? (
              <div className="space-y-3">
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  maxLength={40}
                  className="w-full rounded-lg border border-hairline bg-elevated px-3 py-2 text-sm text-ink outline-none focus:border-ink/40"
                />
                <textarea
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  rows={3}
                  maxLength={400}
                  placeholder="Descreva o time: foco, formatos, rotina de estudo…"
                  className="w-full resize-none rounded-lg border border-hairline bg-elevated px-3 py-2 text-[13px] text-ink outline-none placeholder:text-muted/50 focus:border-ink/40"
                />
                <div className="flex flex-wrap items-center gap-2">
                  {Object.values(ACCENT).map((c) => (
                    <button
                      key={c}
                      onClick={() => setCor(c)}
                      aria-label={`Cor ${c}`}
                      className={`h-7 w-7 rounded-full transition-transform hover:scale-110 ${
                        cor === c ? "ring-2 ring-ink ring-offset-2 ring-offset-surface" : ""
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <div className="ml-auto flex gap-2">
                    <button onClick={() => setEditando(false)}
                      className="grid h-9 w-9 place-items-center rounded-lg border border-hairline text-muted hover:text-ink">
                      <X size={15} />
                    </button>
                    <button onClick={salvar} disabled={salvando}
                      className="flex items-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-[13px] font-semibold text-void disabled:opacity-50">
                      <Check size={15} />
                      {salvando ? "Salvando…" : "Salvar"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold">{info.name}</h2>
                  {podeEditar && (
                    <button onClick={() => setEditando(true)} aria-label="Editar informações do time"
                      className="grid h-7 w-7 place-items-center rounded-lg border border-hairline text-muted transition-colors hover:text-ink print:hidden">
                      <Pencil size={13} />
                    </button>
                  )}
                </div>
                <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-muted">
                  {info.description || "Sem descrição. Conte em poucas linhas qual é o foco do time."}
                </p>
                <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
                  <span>
                    Criado em{" "}
                    <strong className="text-ink/85">
                      {info.createdAt ? new Date(info.createdAt).toLocaleDateString("pt-BR") : "—"}
                    </strong>
                  </span>
                  <span>Jogadores <strong className="text-ink/85">{info.totalJogadores}</strong></span>
                  <span>Coaches <strong className="text-ink/85">{info.totalCoaches}</strong></span>
                  {info.totalPendentes > 0 && (
                    <span className="text-evolution">
                      {info.totalPendentes} aguardando aprovação
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-hairline bg-surface p-5">
        <h2 className="text-[15px] font-semibold">Equipe técnica</h2>
        <p className="mt-1 text-sm text-muted">Administradores e coaches do time.</p>

        <ul className="mt-4 divide-y divide-hairline">
          {staff.map((s) => (
            <li key={s.userId} className="flex flex-wrap items-center gap-3 py-3">
              <Avatar id={s.avatarId} url={s.avatarUrl} size={36} />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 truncate text-sm font-medium">
                  {s.nome}
                  {s.userId === info.ownerId && (
                    <span className="flex items-center gap-1 rounded-full border border-hairline px-2 py-px text-[10px] font-bold uppercase tracking-wider text-muted">
                      <ShieldCheck size={10} /> Dono
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted">
                  {PAPEL[s.role]}
                  {s.role === "admin" && s.isCoach && " · também revisa mãos"}
                  {" · desde "}
                  {new Date(s.joinedAt).toLocaleDateString("pt-BR")}
                </p>
              </div>
              {s.isCoach && (
                <span className="text-xs text-muted">
                  {s.jogadores} jogador{s.jogadores === 1 ? "" : "es"}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <EtiquetasCard info={info} labels={labels} podeEditar={podeEditar} onChange={onChange} onErro={onErro} />
    </div>
  );
}

function EtiquetasCard({
  info, labels, podeEditar, onChange, onErro,
}: {
  info: TeamInfo; labels: TeamLabel[]; podeEditar: boolean; onChange: () => void; onErro: (s: string) => void;
}) {
  const [nova, setNova] = useState("");
  const [cor, setCor] = useState(ACCENT.blue);
  const [salvando, setSalvando] = useState(false);

  async function criar() {
    if (!nova.trim()) return;
    setSalvando(true);
    try {
      await createLabel(info.id, nova, cor);
      setNova("");
      onChange();
    } catch (e) {
      onErro(traduzErroTime(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="rounded-xl border border-hairline bg-surface p-5">
      <h2 className="text-[15px] font-semibold">Etiquetas</h2>
      <p className="mt-1 text-sm text-muted">
        Separe o time por buy-in ou perfil — Recreativo, Pro, Elite. Cada jogador recebe uma etiqueta, e ela vira filtro
        na lista de jogadores.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {labels.length === 0 && <p className="text-sm text-muted">Nenhuma etiqueta criada.</p>}
        {labels.map((l) => (
          <span key={l.id}
            className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold"
            style={{ backgroundColor: `${l.color}22`, color: l.color }}>
            {l.name}
            {podeEditar && (
              <button
                onClick={async () => {
                  if (!confirm(`Excluir a etiqueta "${l.name}"? Os jogadores ficam sem etiqueta.`)) return;
                  try { await deleteLabel(l.id); onChange(); } catch (e) { onErro(traduzErroTime(e)); }
                }}
                aria-label={`Excluir etiqueta ${l.name}`}
                className="opacity-60 transition-opacity hover:opacity-100"
              >
                <Trash2 size={12} />
              </button>
            )}
          </span>
        ))}
      </div>

      {podeEditar && (
        <div className="mt-4 flex flex-wrap items-center gap-2 print:hidden">
          <input
            value={nova}
            onChange={(e) => setNova(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && criar()}
            maxLength={24}
            placeholder="Nova etiqueta"
            className="w-44 rounded-lg border border-hairline bg-elevated px-3 py-2 text-[13px] text-ink outline-none placeholder:text-muted/50 focus:border-ink/40"
          />
          <div className="flex gap-1.5">
            {Object.values(ACCENT).map((c) => (
              <button key={c} onClick={() => setCor(c)} aria-label={`Cor ${c}`}
                className={`h-6 w-6 rounded-full transition-transform hover:scale-110 ${
                  cor === c ? "ring-2 ring-ink ring-offset-2 ring-offset-surface" : ""
                }`}
                style={{ backgroundColor: c }} />
            ))}
          </div>
          <button onClick={criar} disabled={salvando || !nova.trim()}
            className="flex items-center gap-1.5 rounded-lg border border-hairline bg-elevated px-3 py-2 text-[13px] text-ink transition-colors hover:border-ink/40 disabled:opacity-40">
            <Plus size={14} />
            Criar
          </button>
        </div>
      )}
    </section>
  );
}
