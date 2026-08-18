// app/login/login-form.tsx
"use client";

import { useState, type ComponentType } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  User,
  AtSign,
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  Phone,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/logo";

type Mode = "signin" | "signup";

interface FieldProps {
  icon: ComponentType<{ size?: number; className?: string }>;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
  right?: React.ReactNode;
  autoFocus?: boolean;
}

function Field({ icon: Icon, value, onChange, placeholder, type = "text", right, autoFocus }: FieldProps) {
  return (
    <div className="group relative">
      <Icon
        size={18}
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted transition-colors group-focus-within:text-ink"
      />
      <input
        autoFocus={autoFocus}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-lg border border-hairline bg-elevated py-3.5 pl-11 ${
          right ? "pr-12" : "pr-4"
        } text-sm text-ink outline-none transition-all duration-200 placeholder:text-muted/60 focus:border-white/25 focus:bg-elevated/80 focus:shadow-[0_0_0_3px_rgba(255,255,255,0.04)]`}
      />
      {right && <div className="absolute right-3.5 top-1/2 -translate-y-1/2">{right}</div>}
    </div>
  );
}

// Máscara progressiva enquanto digita: (41) 9 9999-9999
function formatWhatsapp(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${ddd}`;
  if (rest.length <= 5) return `(${ddd}) ${rest}`;
  return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
}

const fieldVariants = {
  hidden: { opacity: 0, height: 0, y: -8 },
  visible: { opacity: 1, height: "auto", y: 0 },
  exit: { opacity: 0, height: 0, y: -8 },
};

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const expirado = searchParams.get("expirado") === "1";
  const senhaRedefinida = searchParams.get("senha_redefinida") === "1";

  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState(expirado ? "Sua sessão expirou por inatividade." : "");
  const [ok, setOk] = useState(senhaRedefinida ? "Senha redefinida com sucesso! Faça login." : "");
  const [loading, setLoading] = useState(false);

  const isSignup = mode === "signup";

  const reset = () => {
    setErr("");
    setOk("");
  };

  const switchMode = (next: Mode) => {
    reset();
    setPass("");
    setMode(next);
  };

  async function handleSignIn() {
    reset();
    if (!email || !pass) return setErr("Informe e-mail e senha.");
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (error) throw error;
      router.push("/modulos");
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      setErr(message || "Não foi possível entrar. Verifique suas credenciais.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp() {
    reset();
    if (!name || !nickname || !email || !pass || !whatsapp) {
      return setErr("Preencha nome, apelido, WhatsApp, e-mail e senha.");
    }
    if (pass.length < 6) return setErr("A senha precisa ter ao menos 6 caracteres.");
    setLoading(true);
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
      setMode("signin");
      setOk("Conta criada com sucesso! Faça login para continuar.");
    } catch (e) {
      const message = e instanceof Error ? e.message.toLowerCase() : "";
      if (message.includes("registered") || message.includes("already")) {
        setErr("Este e-mail já está cadastrado.");
      } else {
        setErr("Não foi possível criar a conta.");
      }
    } finally {
      setLoading(false);
    }
  }

  const submit = isSignup ? handleSignUp : handleSignIn;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-y-auto px-6 py-8 sm:py-10">
      {/* Glow ambiente de fundo, característico do dark mode PokerSync */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/3 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.03] blur-[120px]" />
      </div>

      <main className="relative w-full max-w-sm sm:max-w-md">
        <motion.section
          layout
          transition={{ layout: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } }}
          className="relative rounded-xl border border-hairline bg-surface/70 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl"
        >
          <AnimatePresence initial={false}>
            {isSignup && (
              <motion.button
                key="back"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => switchMode("signin")}
                aria-label="Voltar ao login"
                className="absolute left-4 top-4 grid h-9 w-9 place-items-center rounded-lg border border-hairline bg-elevated text-muted transition-colors hover:text-ink"
              >
                <ArrowLeft size={18} />
              </motion.button>
            )}
          </AnimatePresence>

          <motion.div layout="position" className="mb-6 flex justify-center">
            <Logo className="h-8 w-auto sm:h-10" />
          </motion.div>

          <div className="flex flex-col gap-3.5">
            <AnimatePresence initial={false}>
              {isSignup && (
                <motion.div
                  key="signup-fields"
                  variants={fieldVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="flex flex-col gap-3.5 overflow-hidden"
                >
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-bold uppercase tracking-[0.08em] text-muted">
                      Nome completo
                    </span>
                    <Field icon={User} value={name} onChange={setName} placeholder="Seu nome" autoFocus />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-bold uppercase tracking-[0.08em] text-muted">
                      Apelido
                    </span>
                    <Field icon={AtSign} value={nickname} onChange={setNickname} placeholder="Como quer ser chamado" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-bold uppercase tracking-[0.08em] text-muted">
                      WhatsApp
                    </span>
                    <Field
                      icon={Phone}
                      type="tel"
                      value={whatsapp}
                      onChange={(v) => setWhatsapp(formatWhatsapp(v))}
                      placeholder="(41) 99999-9999"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div layout="position" className="flex flex-col gap-1.5">
              <span className="text-xs font-bold uppercase tracking-[0.08em] text-muted">E-mail</span>
              <Field icon={AtSign} value={email} onChange={setEmail} placeholder="exemplo@pokersync.com" />
            </motion.div>

            <motion.div layout="position" className="flex flex-col gap-1.5">
              <span className="text-xs font-bold uppercase tracking-[0.08em] text-muted">Senha</span>
              <Field
                icon={Lock}
                type={show ? "text" : "password"}
                value={pass}
                onChange={setPass}
                placeholder="••••••••"
                right={
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    className="text-muted transition-colors hover:text-ink"
                    aria-label={show ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                }
              />
            </motion.div>

            {!isSignup && (
              <a href="/esqueci-senha" className="self-end text-xs text-muted transition hover:text-ink">
                Esqueci minha senha
              </a>
            )}

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
              layout="position"
              whileHover={{ scale: loading ? 1 : 1.01 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
              onClick={submit}
              disabled={loading}
              className="relative mt-1 flex items-center justify-center gap-2 overflow-hidden rounded-lg bg-ink py-3 text-xs font-bold uppercase tracking-[0.08em] text-void shadow-[0_0_20px_-4px_rgba(255,255,255,0.35)] transition hover:bg-white/90 hover:shadow-[0_0_24px_-2px_rgba(255,255,255,0.45)] disabled:cursor-not-allowed disabled:opacity-80 disabled:shadow-none"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading
                ? isSignup
                  ? "Criando..."
                  : "Verificando..."
                : isSignup
                ? "Criar conta"
                : "Acessar Dashboard"}
            </motion.button>
          </div>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-hairline" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-surface px-3 text-xs font-bold uppercase tracking-[0.08em] text-muted">Ou</span>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => switchMode(isSignup ? "signin" : "signup")}
            className="w-full rounded-lg border border-hairline py-3 text-xs font-bold uppercase tracking-[0.08em] transition hover:border-white/20 hover:bg-white/5"
          >
            {isSignup ? "Já tenho conta" : "Criar conta"}
          </motion.button>
        </motion.section>
      </main>
    </div>
  );
}
