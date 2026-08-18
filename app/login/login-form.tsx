// app/login/login-form.tsx
"use client";

import React, { useState, useRef, type ComponentType } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Spade,
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
        <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">{label}</label>
        {labelRight}
      </div>
      <div className="relative">
        <Icon className="pointer-events-none w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
        <input
          type={type}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full bg-neutral-950/80 border border-neutral-800 rounded-lg pl-10 ${
            right ? "pr-10" : "pr-4"
          } py-2 text-sm text-white placeholder-neutral-600 outline-none focus:border-emerald-500/50 transition-all ${
            mono ? "font-mono" : "font-sans"
          }`}
        />
        {right && <div className="absolute right-3.5 top-1/2 -translate-y-1/2">{right}</div>}
      </div>
    </div>
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
  const redirectTo = searchParams.get("redirectTo") || "/modulos";
  const expirado = searchParams.get("expirado") === "1";
  const senhaRedefinida = searchParams.get("senha_redefinida") === "1";

  const [activeTab, setActiveTab] = useState<Mode>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  const [err, setErr] = useState(expirado ? "Sua sessão expirou por inatividade." : "");
  const [ok, setOk] = useState(senhaRedefinida ? "Senha redefinida com sucesso! Faça login." : "");

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
      router.push(redirectTo);
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
      setOk("Conta criada com sucesso! Faça login para continuar.");
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    isRegister ? handleRegister() : handleLogin();
  };

  return (
    <div className="relative min-h-screen w-full bg-neutral-950 text-neutral-100 flex items-center justify-center p-4 overflow-hidden font-sans selection:bg-emerald-500 selection:text-black">
      {/* Background Grid & Glows */}
      <div className="absolute inset-0 bg-[radial-gradient(#22c55e_1px,transparent_1px)] [background-size:32px_32px] opacity-10 pointer-events-none" />
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-500/15 rounded-full blur-[140px] pointer-events-none" />

      {/* Card Principal */}
      <motion.div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        layout
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-md rounded-xl border border-hairline bg-surface p-8 backdrop-blur-2xl shadow-2xl overflow-hidden group"
      >
        {/* Spotlight do Mouse */}
        <div
          className="pointer-events-none absolute -inset-px transition-opacity duration-300 opacity-0 group-hover:opacity-100"
          style={{
            background: `radial-gradient(400px circle at ${mousePos.x}px ${mousePos.y}px, rgba(16, 185, 129, 0.12), transparent 40%)`,
          }}
        />

        {/* Cabeçalho */}
        <div className="flex flex-col items-center space-y-2 text-center mb-6">
          <motion.div
            whileHover={{ rotate: 180, scale: 1.05 }}
            transition={{ type: "spring", stiffness: 300, damping: 15 }}
            className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner"
          >
            <Spade className="w-6 h-6 fill-current" />
          </motion.div>
          <h1 className="text-2xl font-bold tracking-tight text-white">PokerSync</h1>
          <p className="text-xs text-neutral-400">Workspace de Alta Performance GTO</p>
        </div>

        {/* Seletor de Abas */}
        <div className="relative flex rounded-lg bg-neutral-950/80 p-1 border border-neutral-800/80 mb-6">
          {(["login", "register"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => switchTab(tab)}
              className="relative flex-1 py-1.5 text-xs font-medium transition-colors z-10 cursor-pointer text-neutral-300"
            >
              {activeTab === tab && (
                <motion.div
                  layoutId="activeTabPill"
                  className="absolute inset-0 bg-neutral-800 rounded-md border border-white/10 shadow-sm"
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
                  <a href="/esqueci-senha" className="text-xs text-emerald-400 hover:underline">
                    Esqueceu?
                  </a>
                ) : undefined
              }
              right={
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="text-neutral-500 hover:text-neutral-300"
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
              className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm py-2.5 px-4 rounded-lg shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>{isRegister ? "Criar Conta" : "Acessar Workspace"}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </motion.button>
          </motion.form>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
