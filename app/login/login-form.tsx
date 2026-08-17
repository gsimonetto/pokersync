// app/login/login-form.tsx
"use client";

import { useState, type ComponentType } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { User, AtSign, Lock, Eye, EyeOff, ArrowLeft, Phone } from "lucide-react";
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
}

function Field({ icon: Icon, value, onChange, placeholder, type = "text", right }: FieldProps) {
  return (
    <div className="relative">
      <Icon size={20} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-lg border border-hairline bg-elevated py-3.5 pl-11 ${
          right ? "pr-12" : "pr-4"
        } text-sm text-ink outline-none transition focus:border-ink`}
      />
      {right && <div className="absolute right-3.5 top-1/2 -translate-y-1/2">{right}</div>}
    </div>
  );
}

// Mascara progressiva enquanto digita: (41) 9 9999-9999
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
  const expirado = searchParams.get("expirado") === "1";
  const senhaRedefinida = searchParams.get("senha_redefinida") === "1";

  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState(
    expirado ? "Sua sessao expirou por inatividade." : ""
  );
  const [ok, setOk] = useState(
    senhaRedefinida ? "Senha redefinida com sucesso! Faca login." : ""
  );
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
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: pass,
      });
      if (error) throw error;
      router.push("/modulos");
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      setErr(message || "Nao foi possivel entrar. Verifique suas credenciais.");
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
      setOk("Conta criada com sucesso! Faca login para continuar.");
    } catch (e) {
      const message = e instanceof Error ? e.message.toLowerCase() : "";
      if (message.includes("registered") || message.includes("already")) {
        setErr("Este e-mail ja esta cadastrado.");
      } else {
        setErr("Nao foi possivel criar a conta.");
      }
    } finally {
      setLoading(false);
    }
  }

  const submit = isSignup ? handleSignUp : handleSignIn;

  return (
    <div className="flex min-h-screen items-center justify-center overflow-y-auto px-6 py-8 sm:py-10">
      <main className="w-full max-w-sm sm:max-w-md">
        <section className="relative rounded-xl border border-hairline bg-surface/70 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl">
          {isSignup && (
            <button
              onClick={() => switchMode("signin")}
              aria-label="Voltar ao login"
              className="absolute left-4 top-4 grid h-9 w-9 place-items-center rounded-lg border border-hairline bg-elevated text-muted"
            >
              <ArrowLeft size={18} />
            </button>
          )}

          <div className="mb-6 flex justify-center">
            <Logo className="h-8 w-auto sm:h-10" />
          </div>

          <div className="flex flex-col gap-3.5">
            {isSignup && (
              <>
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-[0.08em] text-muted">
                    Nome completo
                  </span>
                  <Field icon={User} value={name} onChange={setName} placeholder="Seu nome" />
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
              </>
            )}

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-bold uppercase tracking-[0.08em] text-muted">
                E-mail
              </span>
              <Field icon={User} value={email} onChange={setEmail} placeholder="exemplo@pokersync.com" />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-bold uppercase tracking-[0.08em] text-muted">
                Senha
              </span>
              <Field
                icon={Lock}
                type={show ? "text" : "password"}
                value={pass}
                onChange={setPass}
                placeholder="........"
                right={
                  <button type="button" onClick={() => setShow((s) => !s)} className="text-muted">
                    {show ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                }
              />
            </div>

            {!isSignup && (
              <a
                href="/esqueci-senha"
                className="self-end text-xs text-muted transition hover:text-ink"
              >
                Esqueci minha senha
              </a>
            )}

            {err && <p className="text-sm text-negative">{err}</p>}
            {ok && <p className="text-sm text-positive">{ok}</p>}

            <button
              onClick={submit}
              disabled={loading}
              className="mt-1 rounded-lg bg-ink py-3 text-xs font-bold uppercase tracking-[0.08em] text-void transition hover:bg-white/90 disabled:opacity-80"
            >
              {loading
                ? isSignup
                  ? "Criando..."
                  : "Verificando..."
                : isSignup
                ? "Criar conta"
                : "Acessar Dashboard"}
            </button>
          </div>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-hairline" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-surface px-3 text-xs font-bold uppercase tracking-[0.08em] text-muted">
                Ou
              </span>
            </div>
          </div>

          <button
            onClick={() => switchMode(isSignup ? "signin" : "signup")}
            className="w-full rounded-lg border border-hairline py-3 text-xs font-bold uppercase tracking-[0.08em] transition hover:bg-white/5"
          >
            {isSignup ? "Ja tenho conta" : "Criar conta"}
          </button>
        </section>
      </main>
    </div>
  );
}
