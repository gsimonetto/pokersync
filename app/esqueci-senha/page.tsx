"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });

    if (error) {
      setErrorMsg("Não foi possível enviar o e-mail. Tente novamente.");
      setStatus("error");
      return;
    }
    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <div>
        <h1>Verifique seu e-mail</h1>
        <p>
          Se {email} estiver cadastrado, enviamos um link para redefinir sua senha.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1>Esqueci minha senha</h1>
      <form onSubmit={handleSubmit}>
        <label htmlFor="email">E-mail</label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {errorMsg && <p role="alert">{errorMsg}</p>}
        <button type="submit" disabled={status === "loading"}>
          {status === "loading" ? "Enviando..." : "Enviar link de recuperação"}
        </button>
      </form>
      <a href="/login">Voltar para o login</a>
    </div>
  );
}
