"use client";

import { useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import { Lock, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/logo";

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

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");

    if (senha.length < 8) {
      setErrorMsg("A senha precisa ter no mínimo 8 caracteres.");
      return;
    }
    if (senha !== confirmar) {
      setErrorMsg("As senhas não coincidem.");
      return;
    }

    setStatus("loading");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: senha });

    if (error) {
      setErrorMsg("Não foi possível atualizar a senha. O link pode ter expirado.");
      setStatus("error");
      return;
    }

    router.push("/login?senha_redefinida=1");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-8">
      <main className="w-full max-w-sm">
        <section className="relative rounded-xl border border-hairline bg-surface/70 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl">
          <div className="mb-6 flex justify-center">
            <Logo className="h-9 w-auto sm:h-11" />
          </div>

          <div className="mb-5 text-center">
            <h1 className="text-sm font-bold uppercase tracking-[0.14em] text-ink">
              Definir nova senha
            </h1>
            <p className="mt-2 text-sm text-muted">
              Escolha uma nova senha para acessar sua conta.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
                Nova senha
              </span>
              <Field
                icon={Lock}
                type={show ? "text" : "password"}
                value={senha}
                onChange={setSenha}
                placeholder="........"
                right={
                  <button type="button" onClick={() => setShow((s) => !s)} className="text-muted">
                    {show ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                }
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
                Confirmar senha
              </span>
              <Field
                icon={Lock}
                type={show ? "text" : "password"}
                value={confirmar}
                onChange={setConfirmar}
                placeholder="........"
              />
            </div>

            {errorMsg && <p className="text-sm text-negative">{errorMsg}</p>}

            <button
              type="submit"
              disabled={status === "loading"}
              className="mt-1 rounded-lg bg-ink py-3 text-xs font-bold uppercase tracking-[0.14em] text-void transition hover:bg-white/90 disabled:opacity-80"
            >
              {status === "loading" ? "Salvando..." : "Salvar nova senha"}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
