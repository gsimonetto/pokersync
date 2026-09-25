"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MotionConfig } from "framer-motion";
import {
  CalendarClock,
  Cake,
  Camera,
  Check,
  ChevronRight,
  Clock3,
  Copy,
  CreditCard,
  GraduationCap,
  ImagePlus,
  KeyRound,
  Loader2,
  LogOut,
  Spade,
  UserRound,
  X,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PainelVisual, Painel } from "@/components/dashboard/kit";
import { PerfEstilos } from "@/components/performance/perf-estilos";
import { AbasAnimadas } from "@/components/performance/abas-animadas";
import { Avatar, AVATARS } from "@/components/avatar";
import { AvatarNivel } from "@/components/avatar-nivel";
import { PreferenciasMesaPainel } from "@/components/preferencias-mesa";
import { BOTAO_OURO, BOTAO_VIDRO, CAMPO } from "@/components/banca/util";
import { createClient } from "@/lib/supabase/client";
import { sairDesteAparelho } from "@/lib/supabase/sair-deste-aparelho";
import { PERFIL_MUDOU } from "@/lib/eventos-perfil";
import {
  BANNER_DIMENSAO,
  DIA_SEMANA_LABEL,
  HORARIO_TREINO_LABEL,
  TEMPO_EXPERIENCIA_LABEL,
  fetchMeuBanner,
  fetchProfile,
  removeAvatarPhoto,
  removeBanner,
  updateAvatarIcon,
  updatePassword,
  updateProfileDetails,
  uploadAvatarPhoto,
  uploadBannerPhoto,
  type DiaSemana,
  type HorarioTreino,
  type Profile,
  type TempoExperiencia,
} from "@/lib/services/profile-service";

type Aba = "perfil" | "disponibilidade" | "mesa" | "conta";
const ABAS: Aba[] = ["perfil", "disponibilidade", "mesa", "conta"];

type Aviso = { tipo: "ok" | "err"; texto: string } | null;

// Configurações: antes uma janelinha por cima da tela, agora página
// própria no visual de vidro, com abas (pedido explícito). Tudo salva
// sozinho ao trocar (sem botão "Salvar"), menos a senha. Outras telas
// podem abrir direto numa aba com ?aba=disponibilidade (ex.: "Preencher"
// no cartão das Vagas, ver lib/eventos-perfil.ts).
export default function ConfiguracoesPage() {
  const [aba, setAba] = useState<Aba>("perfil");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [erroCarregar, setErroCarregar] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);

  // Lê ?aba= direto de window.location (não useSearchParams: esse hook
  // exige suspense boundary só pra um valor lido uma vez no mount).
  useEffect(() => {
    const pedida = new URLSearchParams(window.location.search).get("aba") as Aba | null;
    if (pedida && ABAS.includes(pedida)) setAba(pedida);
  }, []);

  useEffect(() => {
    fetchProfile()
      .then(setProfile)
      .catch(() => setErroCarregar(true));
  }, []);

  // O aviso some sozinho depois de uns segundos.
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 3500);
    return () => clearTimeout(t);
  }, [aviso]);

  function atualizar(p: Profile) {
    setProfile(p);
    window.dispatchEvent(new Event(PERFIL_MUDOU));
  }

  return (
    <AppShell>
      <PainelVisual value="vidro">
        <MotionConfig reducedMotion="user">
          <main className="perf w-full px-3 pb-12 pt-4 text-ink sm:px-4 sm:pt-6 md:px-6">
            <PerfEstilos />
            <header className="mb-3">
              <h1 className="text-[21px] font-semibold tracking-tight sm:text-3xl">Configurações</h1>
              <p className="mt-1 text-[12.5px] text-muted">Seu perfil, quando você treina, a mesa e a conta. Tudo salva sozinho.</p>
            </header>

            <div className="sticky top-0 z-30 -mx-3 mb-3.5 border-b border-white/[0.06] bg-black/70 px-3 pt-1 backdrop-blur-xl sm:-mx-4 sm:px-4 md:-mx-6 md:px-6">
              <AbasAnimadas
                value={aba}
                onChange={setAba}
                rotulo="Seções das Configurações"
                options={[
                  { value: "perfil", label: "Perfil", icon: UserRound },
                  { value: "disponibilidade", label: "Disponibilidade", icon: CalendarClock },
                  { value: "mesa", label: "Mesa", icon: Spade },
                  { value: "conta", label: "Conta", icon: KeyRound },
                ]}
              />
            </div>

            {erroCarregar ? (
              <section className="painel-vidro mx-auto max-w-lg rounded-3xl border border-white/10 p-6 text-center text-sm text-muted">
                Não foi possível carregar seu perfil. Recarregue a página.
              </section>
            ) : aba === "mesa" ? (
              <div className="max-w-3xl">
                <Painel titulo="Mesa (Treino e Revisor)" icone={<Spade size={16} className="text-[#d4af37]" />}>
                  <PreferenciasMesaPainel />
                </Painel>
              </div>
            ) : aba === "conta" ? (
              <AbaConta onAviso={setAviso} />
            ) : !profile ? (
              <div className="grid max-w-5xl gap-4 lg:grid-cols-2" aria-hidden>
                <div className="painel-esqueleto h-64 rounded-3xl" />
                <div className="painel-esqueleto h-64 rounded-3xl" />
              </div>
            ) : aba === "perfil" ? (
              <AbaPerfil profile={profile} onChange={atualizar} onAviso={setAviso} />
            ) : (
              <AbaDisponibilidade profile={profile} onChange={atualizar} onAviso={setAviso} />
            )}

            {aviso && (
              <div
                role="status"
                className={`painel-vidro fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-xl border px-4 py-2.5 text-[13px] shadow-lg shadow-black/50 ${
                  aviso.tipo === "ok" ? "border-positive/30 text-positive" : "border-negative/40 text-negative"
                }`}
              >
                {aviso.texto}
              </div>
            )}
          </main>
        </MotionConfig>
      </PainelVisual>
    </AppShell>
  );
}

// ------------------------------------------------------------
// Perfil: foto (ou avatar pronto), banner da ficha e a tag de amigo.
// ------------------------------------------------------------
function AbaPerfil({ profile, onChange, onAviso }: { profile: Profile; onChange: (p: Profile) => void; onAviso: (a: Aviso) => void }) {
  const fotoRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  // undefined = banco ainda sem a coluna do banner (bloco some).
  const [banner, setBanner] = useState<string | null | undefined>(undefined);
  const [enviandoBanner, setEnviandoBanner] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    fetchMeuBanner()
      .then(setBanner)
      .catch(() => setBanner(undefined));
  }, []);

  const tag = `@${profile.apelido || profile.nome}#${profile.friend_code}`;
  const erro = (e: unknown, padrao: string) => onAviso({ tipo: "err", texto: e instanceof Error ? e.message : padrao });

  async function enviarFoto(file: File) {
    setEnviandoFoto(true);
    try {
      const url = await uploadAvatarPhoto(file);
      onChange({ ...profile, avatar_url: url });
      onAviso({ tipo: "ok", texto: "Foto atualizada." });
    } catch (e) {
      erro(e, "Falha ao enviar a foto.");
    } finally {
      setEnviandoFoto(false);
      if (fotoRef.current) fotoRef.current.value = "";
    }
  }

  async function tirarFoto() {
    try {
      await removeAvatarPhoto();
      onChange({ ...profile, avatar_url: null });
      onAviso({ tipo: "ok", texto: "Foto removida." });
    } catch (e) {
      erro(e, "Falha ao remover a foto.");
    }
  }

  async function escolherAvatar(id: number) {
    if (id === profile.avatar_id && !profile.avatar_url) return;
    try {
      await updateAvatarIcon(id);
      onChange({ ...profile, avatar_id: id, avatar_url: null });
      onAviso({ tipo: "ok", texto: "Avatar atualizado." });
    } catch (e) {
      erro(e, "Falha ao salvar avatar.");
    }
  }

  async function enviarBanner(file: File) {
    setEnviandoBanner(true);
    try {
      setBanner(await uploadBannerPhoto(file));
      onAviso({ tipo: "ok", texto: "Banner atualizado." });
    } catch (e) {
      erro(e, "Falha ao enviar o banner.");
    } finally {
      setEnviandoBanner(false);
      if (bannerRef.current) bannerRef.current.value = "";
    }
  }

  async function tirarBanner() {
    try {
      await removeBanner();
      setBanner(null);
      onAviso({ tipo: "ok", texto: "Banner removido." });
    } catch (e) {
      erro(e, "Falha ao remover o banner.");
    }
  }

  async function copiarTag() {
    try {
      await navigator.clipboard.writeText(tag);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      // sem permissão de área de transferência -- a tag já está na tela
    }
  }

  return (
    <div className="grid max-w-5xl gap-4 lg:grid-cols-2">
      <Painel titulo="Foto e avatar" icone={<Camera size={16} className="text-[#d4af37]" />}>
        <div className="flex items-center gap-4">
          <AvatarNivel userId={profile.id} avatarId={profile.avatar_id} avatarUrl={profile.avatar_url} tamanho={72} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold text-ink">{profile.nome || "Jogador"}</p>
            {profile.apelido && <p className="text-[12.5px] text-muted">@{profile.apelido}</p>}
            <div className="mt-2.5 flex flex-wrap gap-2">
              <button type="button" onClick={() => fotoRef.current?.click()} disabled={enviandoFoto} className={`${BOTAO_OURO} !px-3 !py-1.5 !text-[12.5px]`}>
                {enviandoFoto ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                {enviandoFoto ? "Enviando…" : "Enviar foto"}
              </button>
              {profile.avatar_url && (
                <button type="button" onClick={tirarFoto} className={`${BOTAO_VIDRO} !px-3 !py-1.5 !text-[12.5px]`}>
                  <X size={14} /> Remover foto
                </button>
              )}
            </div>
            <input
              ref={fotoRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && enviarFoto(e.target.files[0])}
            />
          </div>
        </div>

        <p className="mb-2 mt-5 text-[12px] text-muted">Ou escolha um avatar pronto:</p>
        <div className="flex flex-wrap gap-2.5">
          {AVATARS.map((a) => {
            const selecionado = a.id === profile.avatar_id && !profile.avatar_url;
            return (
              <div key={a.id} className={`relative rounded-full p-0.5 ${selecionado ? "ring-2 ring-[#d4af37]" : ""}`}>
                <Avatar id={a.id} size={42} onClick={() => escolherAvatar(a.id)} title={`Avatar ${a.id}`} />
                {selecionado && (
                  <span className="absolute -bottom-0.5 -right-0.5 grid size-4 place-items-center rounded-full border-2 border-black bg-[#d4af37]">
                    <Check size={9} className="text-black" strokeWidth={3} />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </Painel>

      <div className="flex flex-col gap-4">
        {banner !== undefined && (
          <Painel
            titulo="Banner da ficha"
            icone={<ImagePlus size={16} className="text-[#d4af37]" />}
            action={
              banner && (
                <button type="button" onClick={tirarBanner} className="flex items-center gap-1 text-[12px] text-muted hover:text-ink">
                  <X size={12} /> Remover
                </button>
              )
            }
          >
            {/* Prévia na mesma proporção da capa (5:1). */}
            <button
              type="button"
              onClick={() => bannerRef.current?.click()}
              disabled={enviandoBanner}
              className="group relative block aspect-[5/1] w-full overflow-hidden rounded-2xl border border-dashed border-white/15 bg-white/[0.03] transition-colors hover:border-[#d4af37]/60"
            >
              {banner && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={banner} alt="Seu banner" className="absolute inset-0 size-full object-cover" />
              )}
              <span
                className={`absolute inset-0 flex items-center justify-center gap-1.5 text-[12.5px] font-semibold transition-opacity ${
                  banner ? "bg-black/55 text-ink opacity-0 group-hover:opacity-100" : "text-muted group-hover:text-ink"
                }`}
              >
                {enviandoBanner ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
                {enviandoBanner ? "Enviando…" : banner ? "Trocar banner" : "Incluir banner"}
              </span>
            </button>
            <p className="mt-2 text-[11.5px] leading-snug text-muted">
              Tamanho ideal: <strong className="text-ink/85">{BANNER_DIMENSAO.largura} × {BANNER_DIMENSAO.altura} px</strong> (JPG, PNG ou WEBP, até
              5 MB). Deixe o mais importante no centro: no celular as laterais são cortadas.
            </p>
            <input
              ref={bannerRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && enviarBanner(e.target.files[0])}
            />
          </Painel>
        )}

        <Painel titulo="Sua tag de amigo" icone={<UserRound size={16} className="text-[#d4af37]" />}>
          <button
            type="button"
            onClick={copiarTag}
            title="Copiar sua tag"
            className="painel-bloco flex w-full items-center gap-2 rounded-2xl border border-white/[0.07] px-3.5 py-3 text-left transition-colors hover:border-[#d4af37]/40"
          >
            <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">{tag}</span>
            {copiado ? <Check size={15} className="shrink-0 text-positive" /> : <Copy size={15} className="shrink-0 text-muted" />}
          </button>
          <p className="mt-2 text-[11.5px] text-muted">Passe essa tag pra alguém te adicionar no chat.</p>
        </Painel>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Disponibilidade: dados que aparecem no cartão das Vagas e ajudam o
// time a te conhecer. Cada campo salva sozinho ao trocar.
// ------------------------------------------------------------
function AbaDisponibilidade({ profile, onChange, onAviso }: { profile: Profile; onChange: (p: Profile) => void; onAviso: (a: Aviso) => void }) {
  const [salvando, setSalvando] = useState(false);

  async function salvar(patch: Parameters<typeof updateProfileDetails>[0], atualiza: Partial<Profile>) {
    setSalvando(true);
    try {
      await updateProfileDetails(patch);
      onChange({ ...profile, ...atualiza });
      onAviso({ tipo: "ok", texto: "Salvo." });
    } catch (e) {
      onAviso({ tipo: "err", texto: e instanceof Error ? e.message : "Falha ao salvar." });
    } finally {
      setSalvando(false);
    }
  }

  function alternarDia(dia: DiaSemana) {
    const atual = profile.dias_treino_semana ?? [];
    const novo = atual.includes(dia) ? atual.filter((d) => d !== dia) : [...atual, dia];
    salvar({ diasTreinoSemana: novo.length ? novo : null }, { dias_treino_semana: novo.length ? novo : null });
  }

  return (
    <div className="grid max-w-5xl gap-4 lg:grid-cols-2">
      <Painel titulo="Sobre você" icone={<GraduationCap size={16} className="text-[#d4af37]" />}>
        <div className="flex flex-col gap-3.5">
          <Campo icone={<Cake size={13} />} rotulo="Data de nascimento">
            <input
              type="date"
              defaultValue={profile.data_nascimento ?? ""}
              onBlur={(e) => {
                const v = e.target.value || null;
                if (v !== profile.data_nascimento) salvar({ dataNascimento: v }, { data_nascimento: v });
              }}
              disabled={salvando}
              className={`${CAMPO} disabled:opacity-60`}
            />
          </Campo>
          <Campo icone={<GraduationCap size={13} />} rotulo="Tempo de experiência">
            <select
              value={profile.tempo_experiencia ?? ""}
              onChange={(e) => {
                const v = (e.target.value || null) as TempoExperiencia | null;
                salvar({ tempoExperiencia: v }, { tempo_experiencia: v });
              }}
              disabled={salvando}
              className={`${CAMPO} disabled:opacity-60`}
            >
              <option value="">Não informado</option>
              {(Object.entries(TEMPO_EXPERIENCIA_LABEL) as [TempoExperiencia, string][]).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </Campo>
        </div>
      </Painel>

      <Painel titulo="Quando você treina" icone={<CalendarClock size={16} className="text-[#d4af37]" />}>
        <div className="flex flex-col gap-3.5">
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Campo icone={<Clock3 size={13} />} rotulo="Horário preferido">
              <select
                value={profile.horario_treino ?? ""}
                onChange={(e) => {
                  const v = (e.target.value || null) as HorarioTreino | null;
                  salvar({ horarioTreino: v }, { horario_treino: v });
                }}
                disabled={salvando}
                className={`${CAMPO} disabled:opacity-60`}
              >
                <option value="">Não informado</option>
                {(Object.entries(HORARIO_TREINO_LABEL) as [HorarioTreino, string][]).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo icone={<Clock3 size={13} />} rotulo="Horas por dia">
              <input
                type="number"
                min={0}
                max={24}
                defaultValue={profile.horas_treino_dia ?? ""}
                onBlur={(e) => {
                  const v = e.target.value ? Number(e.target.value) : null;
                  if (v !== profile.horas_treino_dia) salvar({ horasTreinoDia: v }, { horas_treino_dia: v });
                }}
                disabled={salvando}
                placeholder="Ex: 2"
                className={`${CAMPO} disabled:opacity-60`}
              />
            </Campo>
          </div>
          <Campo icone={<CalendarClock size={13} />} rotulo="Dias da semana">
            <div className="flex flex-wrap gap-1.5">
              {(Object.entries(DIA_SEMANA_LABEL) as [DiaSemana, string][]).map(([v, label]) => {
                const marcado = (profile.dias_treino_semana ?? []).includes(v);
                return (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={marcado}
                    disabled={salvando}
                    onClick={() => alternarDia(v)}
                    className={`rounded-xl border px-3 py-2 text-[12px] font-semibold transition-colors disabled:opacity-60 ${
                      marcado ? "border-[#d4af37]/50 bg-[#d4af37]/15 text-[#f1d78a]" : "border-white/10 bg-white/[0.03] text-muted hover:border-white/20 hover:text-ink"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </Campo>
        </div>
      </Painel>
    </div>
  );
}

function Campo({ icone, rotulo, children }: { icone: React.ReactNode; rotulo: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1.5 text-[12px] font-medium text-muted">
        {icone} {rotulo}
      </span>
      {children}
    </label>
  );
}

// ------------------------------------------------------------
// Conta: troca de senha, atalho pro plano/faturas e sair.
// ------------------------------------------------------------
function AbaConta({ onAviso }: { onAviso: (a: Aviso) => void }) {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function trocarSenha(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (senha.length < 8) return setErro("Mínimo 8 caracteres.");
    if (senha !== senha2) return setErro("As senhas não coincidem.");
    setSalvando(true);
    try {
      await updatePassword(senha);
      setSenha("");
      setSenha2("");
      onAviso({ tipo: "ok", texto: "Senha alterada com sucesso." });
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível trocar a senha.");
    } finally {
      setSalvando(false);
    }
  }

  async function sair() {
    try {
      await sairDesteAparelho(createClient());
    } catch {
      // segue o logout mesmo se a chamada falhar
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="grid max-w-5xl gap-4 lg:grid-cols-2">
      <Painel titulo="Trocar senha" icone={<KeyRound size={16} className="text-[#d4af37]" />}>
        <form onSubmit={trocarSenha} className="flex flex-col gap-2.5">
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Nova senha (mínimo 8 caracteres)"
            autoComplete="new-password"
            className={CAMPO}
          />
          <input
            type="password"
            value={senha2}
            onChange={(e) => setSenha2(e.target.value)}
            placeholder="Confirmar nova senha"
            autoComplete="new-password"
            className={CAMPO}
          />
          {erro && <p className="text-[12px] text-negative">{erro}</p>}
          <button type="submit" disabled={salvando || !senha} className={`${BOTAO_OURO} mt-1 self-start`}>
            {salvando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            {salvando ? "Salvando…" : "Salvar nova senha"}
          </button>
        </form>
      </Painel>

      <div className="flex flex-col gap-4">
        <Painel titulo="Plano e faturas" icone={<CreditCard size={16} className="text-[#d4af37]" />}>
          <Link
            href="/minha-conta"
            className="painel-bloco flex items-center gap-3 rounded-2xl border border-white/[0.07] px-3.5 py-3 transition-colors hover:border-[#d4af37]/40"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-medium text-ink">Meu plano</span>
              <span className="block text-[12px] text-muted">Ver plano, faturas, cancelar ou excluir a conta</span>
            </span>
            <ChevronRight size={16} className="shrink-0 text-muted" />
          </Link>
        </Painel>

        <Painel titulo="Sair" icone={<LogOut size={16} className="text-negative" />}>
          <p className="mb-3 text-[12.5px] text-muted">Encerra a sessão só neste aparelho.</p>
          <button
            type="button"
            onClick={sair}
            className="inline-flex items-center gap-2 rounded-xl border border-negative/40 px-3.5 py-2 text-sm font-medium text-negative transition hover:bg-negative/10"
          >
            <LogOut size={15} /> Sair deste aparelho
          </button>
        </Painel>
      </div>
    </div>
  );
}
