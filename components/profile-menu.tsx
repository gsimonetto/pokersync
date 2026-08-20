"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, KeyRound, Check, Camera, Loader2, X, Cake, GraduationCap, Clock3 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AVATARS } from "./avatar";
import {
  updateAvatarIcon,
  uploadAvatarPhoto,
  removeAvatarPhoto,
  updatePassword,
  updateProfileDetails,
  TEMPO_EXPERIENCIA_LABEL,
  HORARIO_TREINO_LABEL,
  type Profile,
  type TempoExperiencia,
  type HorarioTreino,
} from "@/lib/services/profile-service";

export function ProfileMenu({
  profile,
  onProfileChange,
  onClose,
}: {
  profile: Profile;
  onProfileChange: (p: Profile) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"home" | "password">("home");
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [msg, setMsg] = useState<{ type: "" | "ok" | "err"; text: string }>({ type: "", text: "" });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [salvandoDetalhes, setSalvandoDetalhes] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function salvarDetalhe(patch: Parameters<typeof updateProfileDetails>[0], atualiza: Partial<Profile>) {
    setSalvandoDetalhes(true);
    try {
      await updateProfileDetails(patch);
      onProfileChange({ ...profile, ...atualiza });
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "Falha ao salvar." });
    } finally {
      setSalvandoDetalhes(false);
    }
  }

  async function pickIcon(id: number) {
    if (id === profile.avatar_id && !profile.avatar_url) return;
    try {
      await updateAvatarIcon(id);
      onProfileChange({ ...profile, avatar_id: id, avatar_url: null });
      setMsg({ type: "ok", text: "Avatar atualizado." });
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "Falha ao salvar avatar." });
    }
  }

  async function handlePhotoUpload(file: File) {
    setUploading(true);
    setMsg({ type: "", text: "" });
    try {
      const url = await uploadAvatarPhoto(file);
      onProfileChange({ ...profile, avatar_url: url });
      setMsg({ type: "ok", text: "Foto atualizada." });
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "Falha ao enviar a foto." });
    } finally {
      setUploading(false);
    }
  }

  async function handleRemovePhoto() {
    try {
      await removeAvatarPhoto();
      onProfileChange({ ...profile, avatar_url: null });
      setMsg({ type: "ok", text: "Foto removida." });
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "Falha ao remover a foto." });
    }
  }

  async function submitPassword() {
    setMsg({ type: "", text: "" });
    if (pass.length < 6) return setMsg({ type: "err", text: "Mínimo 6 caracteres." });
    if (pass !== pass2) return setMsg({ type: "err", text: "As senhas não coincidem." });
    setLoading(true);
    try {
      await updatePassword(pass);
      setPass("");
      setPass2("");
      setMsg({ type: "ok", text: "Senha alterada com sucesso." });
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "Não foi possível trocar a senha." });
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    const supabase = createClient();
    try {
      await supabase.auth.signOut();
    } catch {
      // segue o logout mesmo se a chamada falhar
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-16" onClick={onClose}>
      <div
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-hairline bg-surface/[0.98] shadow-2xl shadow-black/60 backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-hairline p-4">
          <div className="relative">
            <Avatar id={profile.avatar_id} url={profile.avatar_url} size={44} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              title="Trocar foto"
              className="absolute -bottom-1 -right-1 grid size-6 place-items-center rounded-full border-2 border-surface bg-ink text-void"
            >
              {uploading ? <Loader2 size={11} className="animate-spin" /> : <Camera size={11} />}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handlePhotoUpload(e.target.files[0])}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-ink">{profile.nome || "Jogador"}</div>
            {profile.apelido && <div className="text-xs text-muted">@{profile.apelido}</div>}
          </div>
          <button onClick={onClose} className="grid size-7 shrink-0 place-items-center rounded-lg text-muted hover:text-ink" aria-label="Fechar">
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto">
          {tab === "home" && (
            <>
              <div className="border-b border-hairline p-4">
                <div className="mb-2.5 flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-[0.08em] text-muted">Avatar</span>
                  {profile.avatar_url && (
                    <button onClick={handleRemovePhoto} className="flex items-center gap-1 text-[11px] text-muted hover:text-ink">
                      <X size={11} /> Remover foto
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2.5">
                  {AVATARS.map((a) => {
                    const selected = a.id === profile.avatar_id && !profile.avatar_url;
                    return (
                      <div key={a.id} className="relative">
                        <Avatar id={a.id} size={40} onClick={() => pickIcon(a.id)} title={`Avatar ${a.id}`} />
                        {selected && (
                          <span className="absolute -bottom-0.5 -right-0.5 grid size-4 place-items-center rounded-full border-2 border-surface bg-ink">
                            <Check size={9} className="text-void" strokeWidth={3} />
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Info opcional pra futura curadoria de comunidade — cada
                  campo salva sozinho ao trocar, sem precisar de um botao
                  "Salvar" separado (mesmo padrao do avatar acima). */}
              <div className="flex flex-col gap-3 border-b border-hairline p-4">
                <label className="flex flex-col gap-1.5">
                  <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.08em] text-muted">
                    <Cake size={12} /> Data de nascimento
                  </span>
                  <input
                    type="date"
                    defaultValue={profile.data_nascimento ?? ""}
                    onBlur={(e) => salvarDetalhe({ dataNascimento: e.target.value || null }, { data_nascimento: e.target.value || null })}
                    disabled={salvandoDetalhes}
                    className="w-full rounded-lg border border-hairline bg-void px-3 py-2 text-[13px] text-ink outline-none focus:border-ink disabled:opacity-60"
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.08em] text-muted">
                    <GraduationCap size={12} /> Tempo de experiência
                  </span>
                  <select
                    value={profile.tempo_experiencia ?? ""}
                    onChange={(e) => {
                      const v = (e.target.value || null) as TempoExperiencia | null;
                      salvarDetalhe({ tempoExperiencia: v }, { tempo_experiencia: v });
                    }}
                    disabled={salvandoDetalhes}
                    className="w-full rounded-lg border border-hairline bg-void px-3 py-2 text-[13px] text-ink outline-none focus:border-ink disabled:opacity-60"
                  >
                    <option value="">Não informado</option>
                    {(Object.entries(TEMPO_EXPERIENCIA_LABEL) as [TempoExperiencia, string][]).map(([v, label]) => (
                      <option key={v} value={v}>{label}</option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.08em] text-muted">
                    <Clock3 size={12} /> Horário preferido pra treinar
                  </span>
                  <select
                    value={profile.horario_treino ?? ""}
                    onChange={(e) => {
                      const v = (e.target.value || null) as HorarioTreino | null;
                      salvarDetalhe({ horarioTreino: v }, { horario_treino: v });
                    }}
                    disabled={salvandoDetalhes}
                    className="w-full rounded-lg border border-hairline bg-void px-3 py-2 text-[13px] text-ink outline-none focus:border-ink disabled:opacity-60"
                  >
                    <option value="">Não informado</option>
                    {(Object.entries(HORARIO_TREINO_LABEL) as [HorarioTreino, string][]).map(([v, label]) => (
                      <option key={v} value={v}>{label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <button
                onClick={() => {
                  setMsg({ type: "", text: "" });
                  setTab("password");
                }}
                className="flex w-full items-center gap-2.5 border-b border-hairline px-4 py-3 text-left text-[13px] text-ink hover:bg-white/[0.03]"
              >
                <KeyRound size={16} /> <span>Trocar senha</span>
              </button>
              <button onClick={handleLogout} className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-[13px] text-negative hover:bg-white/[0.03]">
                <LogOut size={16} /> <span>Sair</span>
              </button>
            </>
          )}

          {tab === "password" && (
            <div className="flex flex-col gap-2.5 p-4">
              <span className="text-[11px] uppercase tracking-[0.08em] text-muted">Nova senha</span>
              <input
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full rounded-lg border border-hairline bg-void px-3 py-2.5 text-[13px] text-ink outline-none focus:border-ink"
              />
              <input
                type="password"
                value={pass2}
                onChange={(e) => setPass2(e.target.value)}
                placeholder="Confirmar nova senha"
                className="w-full rounded-lg border border-hairline bg-void px-3 py-2.5 text-[13px] text-ink outline-none focus:border-ink"
              />
              <div className="mt-1 flex gap-2">
                <button onClick={() => setTab("home")} className="flex-1 rounded-lg border border-hairline bg-void py-2.5 text-[13px] text-ink">
                  Voltar
                </button>
                <button
                  onClick={submitPassword}
                  disabled={loading}
                  className="flex-1 rounded-lg bg-ink py-2.5 text-[13px] font-semibold text-void disabled:opacity-60"
                >
                  {loading ? "Salvando…" : "Salvar"}
                </button>
              </div>
            </div>
          )}
        </div>

        {msg.text && (
          <div className={`border-t border-hairline px-4 py-2.5 text-xs ${msg.type === "ok" ? "text-positive" : "text-negative"}`}>
            {msg.text}
          </div>
        )}
      </div>
    </div>
  );
}
