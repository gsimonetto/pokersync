// app/login/login-form.tsx
"use client";

import React, { useState, useRef, useEffect, type ComponentType } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  User,
  AtSign,
  Phone,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/logo";

type Mode = "login" | "register";

interface FieldProps {
  icon: ComponentType<{ className?: string }>;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
  right?: React.ReactNode;
  mono?: boolean;
  label: string;
  labelRight?: React.ReactNode;
}

function Field({ icon: Icon, value, onChange, placeholder, type = "text", right, mono, label, labelRight }: FieldProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</label>
        {labelRight}
      </div>
      <div className="relative">
        <Icon className="pointer-events-none w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type={type}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full bg-elevated border border-hairline rounded-lg pl-10 ${
            right ? "pr-10" : "pr-4"
          } py-2 text-sm text-ink placeholder-muted/50 outline-none focus:border-white/30 transition-all ${
            mono ? "font-mono" : "font-sans"
          }`}
        />
        {right && <div className="absolute right-3.5 top-1/2 -translate-y-1/2">{right}</div>}
      </div>
    </div>
  );
}

// Ícone do Google (SVG oficial multicolor)
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47c-.28 1.5-1.13 2.77-2.4 3.62v3h3.88c2.27-2.09 3.57-5.17 3.57-8.81z"
        fill="#4285F4"
      />
      <path
        d="M12 24c3.24 0 5.96-1.07 7.95-2.92l-3.88-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.26v3.11C3.24 21.3 7.28 24 12 24z"
        fill="#34A853"
      />
      <path
        d="M5.27 14.27c-.24-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.62H1.26A11.97 11.97 0 000 12c0 1.94.46 3.77 1.26 5.38l4.01-3.11z"
        fill="#FBBC05"
      />
      <path
        d="M12 4.77c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0 7.28 0 3.24 2.7 1.26 6.62l4.01 3.11c.95-2.85 3.6-4.96 6.73-4.96z"
        fill="#EA4335"
      />
    </svg>
  );
}

// Máscara progressiva: (41) 99999-9999
function formatWhatsapp(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${ddd}`;
  if (rest.length <= 5) return `(${ddd}) ${rest}`;
  return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
}

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Capturados uma unica vez (nao recalculados a cada render): a URL e'
  // limpa logo abaixo (?expirado=1 etc. some da barra de enderecos
  // depois de lida), entao ler searchParams.get direto mais adiante
  // devolveria null e perderia o destino/mensagem.
  const [redirectTo] = useState(() => searchParams.get("redirectTo") || "/modulos");
  const [expirado] = useState(() => searchParams.get("expirado") === "1");
  const [senhaRedefinida] = useState(() => searchParams.get("senha_redefinida") === "1");
  const [emailConfirmado] = useState(() => searchParams.get("email_confirmado") === "1");
  const [erroConfirmacao] = useState(() => searchParams.get("erro_confirmacao") === "1");

  // Some da URL assim que lida -- sem isso "?expirado=1" ficava preso
  // no endereco (dava pra ver no F5 ou copiando o link), e um usuario
  // relatou nao conseguir logar de novo por essa tela sem antes editar
  // a URL na mao pra tirar o parametro.
  useEffect(() => {
    if (window.location.search) router.replace("/login", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [activeTab, setActiveTab] = useState<Mode>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  const [err, setErr] = useState(
    expirado
      ? "Sua sessão expirou por inatividade."
      : erroConfirmacao
      ? "O link de confirmação é inválido ou expirou. Tente se cadastrar novamente."
      : ""
  );
  const [ok, setOk] = useState(
    senhaRedefinida
      ? "Senha redefinida com sucesso! Faça login."
      : emailConfirmado
      ? "E-mail confirmado com sucesso! Faça login para continuar."
      : ""
  );

  const isRegister = activeTab === "register";

  // Spotlight do mouse
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const reset = () => {
    setErr("");
    setOk("");
  };

  const switchTab = (tab: Mode) => {
    reset();
    setPass("");
    setActiveTab(tab);
  };

  async function handleLogin() {
    reset();
    if (!email || !pass) return setErr("Informe e-mail e senha.");
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (error) throw error;
      // Hard navigation em vez de router.push: garante que a proxima
      // pagina carregue com os cookies de sessao recem-gravados
      // refletidos de verdade, sem depender de cache/estado do router
      // client-side (era o suspeito da falha "logar de novo" relatada
      // vindo de /login?expirado=1).
      window.location.href = redirectTo;
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      setErr(message || "Não foi possível entrar. Verifique suas credenciais.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRegister() {
    reset();
    if (!name || !nickname || !email || !pass || !whatsapp) {
      return setErr("Preencha nome, apelido, WhatsApp, e-mail e senha.");
    }
    if (pass.length < 6) return setErr("A senha precisa ter ao menos 6 caracteres.");
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password: pass,
        options: { data: { nome: name, apelido: nickname, whatsapp } },
      });
      if (error) throw error;

      if (data.session) {
        await supabase.auth.signOut();
      }

      setPass("");
      setActiveTab("login");
      setOk("Quase lá! Enviamos um link de confirmação para seu e-mail. Clique nele para poder entrar.");
    } catch (e) {
      const message = e instanceof Error ? e.message.toLowerCase() : "";
      if (message.includes("registered") || message.includes("already")) {
        setErr("Este e-mail já está cadastrado.");
      } else {
        setErr("Não foi possível criar a conta.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGoogleLogin() {
    reset();
    setIsGoogleLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/confirm`,
        },
      });
      if (error) throw error;
      // Não precisa fazer mais nada aqui: o navegador é redirecionado
      // para o Google e depois para /auth/confirm.
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      setErr(message || "Não foi possível entrar com o Google.");
      setIsGoogleLoading(false);
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    isRegister ? handleRegister() : handleLogin();
  };

  return (
    <div className="relative min-h-screen w-full bg-void text-ink flex items-center justify-center p-4 overflow-hidden font-sans selection:bg-white selection:text-black">
      {/* Background Grid & Glow — monocromático */}
      <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:32px_32px] opacity-[0.04] pointer-events-none" />
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-white/[0.06] rounded-full blur-[140px] pointer-events-none" />

      {/* Card Principal */}
      <motion.div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        layout
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-md rounded-xl border border-hairline bg-surface p-8 backdrop-blur-2xl shadow-2xl shadow-black/60 overflow-hidden group"
      >
        {/* Spotlight do Mouse — branco sutil */}
        <div
          className="pointer-events-none absolute -inset-px transition-opacity duration-300 opacity-0 group-hover:opacity-100"
          style={{
            background: `radial-gradient(400px circle at ${mousePos.x}px ${mousePos.y}px, rgba(255, 255, 255, 0.06), transparent 40%)`,
          }}
        />

        {/* Cabeçalho */}
        <div className="flex flex-col items-center space-y-3 text-center mb-6">
          <Logo className="h-14 w-auto" />
        </div>

        {/* Seletor de Abas */}
        <div className="relative flex rounded-lg bg-void/60 p-1 border border-hairline mb-6">
          {(["login", "register"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => switchTab(tab)}
              className="relative flex-1 py-1.5 text-xs font-medium transition-colors z-10 cursor-pointer text-muted data-[active=true]:text-ink"
              data-active={activeTab === tab}
            >
              {activeTab === tab && (
                <motion.div
                  layoutId="activeTabPill"
                  className="absolute inset-0 bg-elevated rounded-md border border-white/10 shadow-sm"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10">{tab === "login" ? "Entrar" : "Criar Conta"}</span>
            </button>
          ))}
        </div>

        {/* Formulário Animado */}
        <AnimatePresence mode="wait">
          <motion.form
            key={activeTab}
            initial={{ opacity: 0, x: isRegister ? 10 : -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isRegister ? -10 : 10 }}
            transition={{ duration: 0.2 }}
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            {isRegister && (
              <>
                <Field icon={User} label="Nome completo" value={name} onChange={setName} placeholder="Seu nome" />
                <Field
                  icon={AtSign}
                  label="Apelido"
                  value={nickname}
                  onChange={setNickname}
                  placeholder="Como quer ser chamado"
                />
                <Field
                  icon={Phone}
                  label="WhatsApp"
                  type="tel"
                  value={whatsapp}
                  onChange={(v) => setWhatsapp(formatWhatsapp(v))}
                  placeholder="(41) 99999-9999"
                />
              </>
            )}

            <Field icon={Mail} label="E-mail" type="email" value={email} onChange={setEmail} placeholder="jogador@pokersync.com.br" />

            <Field
              icon={Lock}
              label="Senha"
              type={showPassword ? "text" : "password"}
              value={pass}
              onChange={setPass}
              placeholder="••••••••"
              mono
              labelRight={
                !isRegister ? (
                  <a href="/esqueci-senha" className="text-xs text-muted hover:text-ink transition-colors">
                    Esqueceu?
                  </a>
                ) : undefined
              }
              right={
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="text-muted hover:text-ink transition-colors"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
            />

            <AnimatePresence mode="wait">
              {err && (
                <motion.p
                  key="err"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="flex items-center gap-1.5 text-sm text-negative"
                >
                  <AlertCircle size={14} className="shrink-0" />
                  {err}
                </motion.p>
              )}
              {ok && !err && (
                <motion.p
                  key="ok"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="flex items-center gap-1.5 text-sm text-positive"
                >
                  <CheckCircle2 size={14} className="shrink-0" />
                  {ok}
                </motion.p>
              )}
            </AnimatePresence>

            <motion.button
              whileHover={{ scale: isLoading ? 1 : 1.01 }}
              whileTap={{ scale: isLoading ? 1 : 0.99 }}
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 bg-ink hover:bg-white/90 text-void font-semibold text-sm py-2.5 px-4 rounded-lg shadow-lg shadow-black/40 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-void/30 border-t-void rounded-full animate-spin" />
              ) : (
                <>
                  <span>{isRegister ? "Criar Conta" : "Entrar"}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </motion.button>

            {!isRegister && (
              <>
                {/* Divisor */}
                <div className="flex items-center gap-3 pt-2">
                  <div className="h-px flex-1 bg-hairline" />
                  <span className="text-[11px] uppercase tracking-wider text-muted">ou</span>
                  <div className="h-px flex-1 bg-hairline" />
                </div>

                {/* Botão Google */}
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isGoogleLoading || isLoading}
                  className="w-full bg-elevated hover:bg-white/10 border border-hairline text-ink font-medium text-sm py-2.5 px-4 rounded-lg flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGoogleLoading ? (
                    <div className="w-4 h-4 border-2 border-ink/30 border-t-ink rounded-full animate-spin" />
                  ) : (
                    <>
                      <GoogleIcon className="w-4 h-4" />
                      <span>Entrar com Google</span>
                    </>
                  )}
                </button>
              </>
            )}
          </motion.form>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
