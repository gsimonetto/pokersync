"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Camera, Check, Loader2, Pencil, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Chip } from "@/components/chip";
import { ModalPortal } from "@/components/modal-portal";
import { TeamBanner } from "@/components/time/team-banner";
import { useConfirm } from "@/components/confirm-dialog";
import { ACCENT } from "@/lib/modules-data";
import {
  calcularScore,
  createLabel,
  deleteLabel,
  deleteTeam,
  traduzErroTime,
  updateTeamInfo,
  uploadTeamLogo,
  type TeamDashboardRow,
  type TeamInfo,
  type TeamLabel,
  type TeamRole,
  type TeamStaff,
} from "@/lib/services/team-service";

// Blocos da aba Gestão do painel do time. Antes eram duas "abas" coladas
// (Perfil + Configurações) que repetiam a capa e a equipe; agora cada
// assunto aparece uma vez só, e o painel embrulha cada bloco na própria
// moldura de vidro (sem caixa dentro de caixa):
//   PerfilDoTime  -- capa, logo, nome, descrição e números (edita no lugar)
//   EquipeTecnica -- admins e coaches, com o score médio de cada coach
//   EtiquetasTime -- etiquetas que viram filtro na lista de jogadores
//   ExcluirTime   -- zona de perigo, só pro dono
// Admin e coach editam; jogador só lê.

const PAPEL: Record<TeamRole, string> = { admin: "Administrador", coach: "Coach", player: "Jogador" };

// ------------------------------------------------------------
// Perfil do time
// ------------------------------------------------------------

export function PerfilDoTime({
  info,
  podeEditar,
  enviandoBanner,
  onUploadBanner,
  onRemoveBanner,
  onChange,
  onErro,
}: {
  info: TeamInfo;
  podeEditar: boolean;
  enviandoBanner: boolean;
  onUploadBanner: () => void;
  onRemoveBanner: () => void;
  onChange: () => void;
  onErro: (s: string) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(info.name);
  const [desc, setDesc] = useState(info.description ?? "");
  const [cor, setCor] = useState(info.accent);
  const [salvando, setSalvando] = useState(false);
  const [enviandoLogo, setEnviandoLogo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function abrirEdicao() {
    setNome(info.name);
    setDesc(info.description ?? "");
    setCor(info.accent);
    setEditando(true);
  }

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

  return (
    <div className="space-y-4">
      <TeamBanner
        name={info.name}
        accent={info.accent}
        logoUrl={info.logoUrl}
        bannerUrl={info.bannerUrl}
        editable={podeEditar}
        uploading={enviandoBanner}
        onUploadClick={onUploadBanner}
        onRemoveClick={onRemoveBanner}
      />

      {/* Logo e nome já estão na capa: aqui só a descrição e as ações. */}
      {editando ? (
        <div className="space-y-3">
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            maxLength={40}
            aria-label="Nome do time"
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
          <div className="flex flex-wrap gap-2">
            {Object.values(ACCENT).map((c) => (
              <button
                key={c}
                onClick={() => setCor(c)}
                aria-label={`Cor ${c}`}
                aria-pressed={cor === c}
                className={`h-7 w-7 rounded-full transition-transform hover:scale-110 ${
                  cor === c ? "ring-2 ring-ink ring-offset-2 ring-offset-surface" : ""
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setEditando(false)}
              className="flex-1 rounded-lg border border-hairline px-3 py-2 text-[13px] text-ink transition-colors hover:border-ink/40 sm:flex-none"
            >
              Cancelar
            </button>
            <button
              onClick={salvar}
              disabled={salvando}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-[13px] font-semibold text-void disabled:opacity-50 sm:flex-none"
            >
              <Check size={15} />
              {salvando ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <p className="min-w-0 max-w-2xl text-[13px] leading-relaxed text-muted">
            {info.description || "Sem descrição. Conte em poucas linhas qual é o foco do time."}
          </p>
          {podeEditar && (
            <div className="flex shrink-0 gap-2 print:hidden">
              <button
                onClick={() => fileRef.current?.click()}
                disabled={enviandoLogo}
                className="flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-1.5 text-[12.5px] text-ink transition-colors hover:border-ink/40 disabled:opacity-50"
              >
                {enviandoLogo ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
                Logo
              </button>
              <button
                onClick={abrirEdicao}
                className="flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-1.5 text-[12.5px] text-ink transition-colors hover:border-ink/40"
              >
                <Pencil size={13} />
                Editar
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
            </div>
          )}
        </div>
      )}

      {!editando && (
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { rotulo: "Criado em", valor: info.createdAt ? new Date(info.createdAt).toLocaleDateString("pt-BR") : "—" },
            { rotulo: "Jogadores", valor: String(info.totalJogadores) },
            { rotulo: "Coaches", valor: String(info.totalCoaches) },
            { rotulo: "Aguardando aprovação", valor: String(info.totalPendentes), destaque: info.totalPendentes > 0 },
          ].map((n) => (
            <div key={n.rotulo} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
              <dt className="truncate text-[10.5px] text-muted/70">{n.rotulo}</dt>
              <dd className={`text-[14px] font-semibold tabular-nums ${n.destaque ? "text-evolution" : "text-ink"}`}>{n.valor}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

// ------------------------------------------------------------
// Equipe técnica
// ------------------------------------------------------------

export function EquipeTecnica({ info, staff, jogadores }: { info: TeamInfo; staff: TeamStaff[]; jogadores: TeamDashboardRow[] }) {
  // Score médio dos jogadores de cada coach -- a comparação objetiva que
  // uma staking house com mais de um coach precisa.
  function statsDoCoach(coachId: string) {
    const doCoach = jogadores.filter((j) => j.coachId === coachId);
    if (doCoach.length === 0) return null;
    const scores = doCoach.map(calcularScore);
    const media = Math.round(scores.reduce((a, s) => a + s.valor, 0) / scores.length);
    const emRiscoAlto = scores.filter((s) => s.risco === "alto").length;
    return { media, emRiscoAlto };
  }

  if (staff.length === 0) return <p className="text-sm text-muted">Nenhum administrador ou coach ainda.</p>;

  return (
    <ul className="divide-y divide-white/[0.06]">
      {staff.map((s) => {
        const stats = s.isCoach ? statsDoCoach(s.userId) : null;
        return (
          <li key={s.userId} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <Avatar id={s.avatarId} url={s.avatarUrl} size={36} />
            <div className="min-w-0 flex-1">
              <p className="flex min-w-0 items-center gap-2 text-sm font-medium">
                <span className="truncate">{s.nome}</span>
                {s.userId === info.ownerId && (
                  <span className="flex shrink-0 items-center gap-1 rounded-full border border-hairline px-2 py-px text-[10px] font-bold uppercase tracking-wider text-muted">
                    <ShieldCheck size={10} /> Dono
                  </span>
                )}
              </p>
              <p className="truncate text-xs text-muted">
                {PAPEL[s.role]}
                {s.role === "admin" && s.isCoach && " · também revisa mãos"}
                {" · desde "}
                {new Date(s.joinedAt).toLocaleDateString("pt-BR")}
              </p>
            </div>
            {s.isCoach && (
              <div className="shrink-0 text-right text-xs text-muted">
                <p className="tabular-nums">
                  {s.jogadores} jogador{s.jogadores === 1 ? "" : "es"}
                </p>
                {stats && (
                  <p
                    className={`tabular-nums ${stats.media >= 70 ? "text-positive" : stats.media >= 40 ? "text-evolution" : "text-negative"}`}
                    title="Média do Score de evolução dos jogadores atribuídos a este coach"
                  >
                    Score {stats.media}
                    {stats.emRiscoAlto > 0 && ` · ${stats.emRiscoAlto} em risco`}
                  </p>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ------------------------------------------------------------
// Etiquetas
// ------------------------------------------------------------

export function EtiquetasTime({
  info,
  labels,
  podeEditar,
  onChange,
  onErro,
}: {
  info: TeamInfo;
  labels: TeamLabel[];
  podeEditar: boolean;
  onChange: () => void;
  onErro: (s: string) => void;
}) {
  const confirm = useConfirm();
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
    <div>
      <p className="text-[13px] text-muted">
        Separe o time por buy-in ou perfil — Recreativo, Pro, Elite. Cada jogador recebe uma etiqueta, e ela vira filtro na lista de jogadores.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {labels.length === 0 && <p className="text-sm text-muted">Nenhuma etiqueta criada.</p>}
        {labels.map((l) => (
          <Chip key={l.id} color={l.color}>
            {l.name}
            {podeEditar && (
              <button
                onClick={async () => {
                  if (!(await confirm({ title: "Excluir etiqueta", message: `Os jogadores com "${l.name}" ficam sem etiqueta.`, confirmLabel: "Excluir" }))) return;
                  try {
                    await deleteLabel(l.id);
                    onChange();
                  } catch (e) {
                    onErro(traduzErroTime(e));
                  }
                }}
                aria-label={`Excluir etiqueta ${l.name}`}
                className="opacity-70 transition-opacity hover:opacity-100"
              >
                <Trash2 size={11} />
              </button>
            )}
          </Chip>
        ))}
      </div>

      {podeEditar && (
        <div className="mt-4 space-y-2.5 print:hidden">
          <div className="flex gap-2">
            <input
              value={nova}
              onChange={(e) => setNova(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && criar()}
              maxLength={24}
              placeholder="Nova etiqueta"
              aria-label="Nome da nova etiqueta"
              className="min-w-0 flex-1 rounded-lg border border-hairline bg-elevated px-3 py-2 text-[13px] text-ink outline-none placeholder:text-muted/50 focus:border-ink/40 sm:max-w-[240px]"
            />
            <button
              onClick={criar}
              disabled={salvando || !nova.trim()}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-hairline bg-elevated px-3 py-2 text-[13px] text-ink transition-colors hover:border-ink/40 disabled:opacity-40"
            >
              <Plus size={14} />
              Criar
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Object.values(ACCENT).map((c) => (
              <button
                key={c}
                onClick={() => setCor(c)}
                aria-label={`Cor ${c}`}
                aria-pressed={cor === c}
                className={`h-6 w-6 rounded-full transition-transform hover:scale-110 ${cor === c ? "ring-2 ring-ink ring-offset-2 ring-offset-surface" : ""}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------
// Zona de perigo: excluir o time (só o dono)
// ------------------------------------------------------------

export function ExcluirTime({ info, onExcluido }: { info: TeamInfo; onExcluido: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [digitado, setDigitado] = useState("");
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const confere = digitado.trim().toLowerCase() === info.name.trim().toLowerCase();

  async function excluir() {
    if (!confere) return;
    setExcluindo(true);
    setErro(null);
    try {
      await deleteTeam(info.id, digitado);
      onExcluido();
    } catch (e) {
      setErro(traduzErroTime(e));
      setExcluindo(false);
    }
  }

  function fechar() {
    if (excluindo) return;
    setAberto(false);
    setDigitado("");
    setErro(null);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-semibold text-ink">Excluir time</p>
        <p className="mt-0.5 text-[13px] text-muted">Apaga o time para todos. Não dá para desfazer.</p>
      </div>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-negative/50 px-4 py-2 text-[13px] font-semibold text-negative transition-colors hover:bg-negative/10"
      >
        <Trash2 size={14} />
        Excluir time
      </button>

      {aberto && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 grid place-items-center bg-void/75 p-4" onClick={fechar}>
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="excluir-time-titulo"
              className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-negative/30 bg-surface p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-negative/15 text-negative">
                  <AlertTriangle size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 id="excluir-time-titulo" className="text-base font-semibold">
                    Excluir {info.name}?
                  </h2>
                  <p className="mt-0.5 text-[13px] text-muted">Isso não pode ser desfeito.</p>
                </div>
                <button onClick={fechar} aria-label="Fechar" className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:text-ink">
                  <X size={16} />
                </button>
              </div>

              <div className="mt-4 space-y-3 text-[13px] leading-relaxed">
                <div>
                  <p className="font-semibold text-ink">Some junto com o time</p>
                  <p className="text-muted">
                    Funil, calendário, convites, etiquetas, metas, mensagens do time e vagas do Marketplace. Todos os jogadores e coaches saem do time e recebem um aviso.
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-ink">Continua com cada um</p>
                  <p className="text-muted">
                    Treinos, mãos, resultados e ranges (deixam só de ser compartilhados). O histórico de cada jogador continua mostrando que passou pelo time.
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-ink">Sua assinatura</p>
                  <p className="text-muted">O plano é da sua conta, não do time: nada muda na cobrança. Para cancelar, use a página Planos.</p>
                </div>
              </div>

              <label className="mt-4 block text-[12.5px] text-muted" htmlFor="excluir-time-nome">
                Digite <b className="text-ink">{info.name}</b> para confirmar
              </label>
              <input
                id="excluir-time-nome"
                value={digitado}
                onChange={(e) => setDigitado(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && excluir()}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                className="mt-1.5 w-full rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm text-ink outline-none focus:border-negative/60"
              />
              {erro && <p className="mt-2 text-[12.5px] text-negative">{erro}</p>}

              <div className="mt-4 flex gap-2">
                <button
                  onClick={fechar}
                  disabled={excluindo}
                  className="flex-1 rounded-lg border border-hairline px-3 py-2.5 text-[13px] font-semibold text-ink transition-colors hover:border-ink/40 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={excluir}
                  disabled={!confere || excluindo}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-negative px-3 py-2.5 text-[13px] font-semibold text-void transition-opacity disabled:opacity-35"
                >
                  {excluindo ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  {excluindo ? "Excluindo…" : "Excluir para sempre"}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
