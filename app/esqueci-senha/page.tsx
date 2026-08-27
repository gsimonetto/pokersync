"use client";

import { useState, type ComponentType } from "react";
import Link from "next/link";
import { AtSign, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/logo";

interface FieldProps {
  icon: ComponentType<{ size?: number; className?: string }>;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
}

function Field({ icon: Icon, value, onChange, placeholder, type = "text" }: FieldProps) {
  return (
    <div className="relative">
      <Icon size={20} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full rounded-lg border border-hairline bg-elevated py-3.5 pl-11 pr-4 text-sm text-ink outline-none transition focus:border-ink"
      />
    </div>
  );
}

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setOk("");

    if (!email) {
      setErr("Informe seu e-mail.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      });
      if (error) throw error;
      setOk("Link de recuperação enviado! Verifique seu e-mail.");
    } catch {
      setErr("Não foi possível enviar o link. Verifique o e-mail informado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-8">
      <main className="w-full max-w-sm">
        <section className="relative rounded-xl border border-hairline bg-surface/70 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl">
          <Link
            href="/login"
            aria-label="Voltar ao login"
            className="absolute left-4 top-4 grid h-9 w-9 place-items-center rounded-lg border border-hairline bg-elevated text-muted transition hover:text-ink"
          >
            <ArrowLeft size={18} />
          </Link>

          <div className="mb-6 flex justify-center">
            <Logo className="h-9 w-auto sm:h-11" />
          </div>

          <div className="mb-5 text-center">
            <h1 className="text-sm font-bold uppercase tracking-[0.14em] text-ink">
              Esqueci minha senha
            </h1>
            <p className="mt-2 text-sm text-muted">
              Informe seu e-mail e enviaremos um link para redefinir sua senha.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
                E-mail
              </span>
              <Field icon={AtSign} value={email} onChange={setEmail} placeholder="exemplo@pokersync.com" />
            </div>

            {err && <p className="text-sm text-negative">{err}</p>}
            {ok && <p className="text-sm text-positive">{ok}</p>}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 rounded-lg bg-ink py-3 text-xs font-bold uppercase tracking-[0.14em] text-void transition hover:bg-white/90 disabled:opacity-80"
            >
              {loading ? "Enviando..." : "Enviar link de recuperação"}
            </button>
          </form>

          <div className="mt-5 text-center">
            <Link href="/login" className="text-xs text-muted transition hover:text-ink">
              Voltar para o login
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
