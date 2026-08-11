"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
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
    <div>
      <h1>Definir nova senha</h1>
      <form onSubmit={handleSubmit}>
        <label htmlFor="senha">Nova senha</label>
        <input
          id="senha"
          type="password"
          required
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />
        <label htmlFor="confirmar">Confirmar senha</label>
        <input
          id="confirmar"
          type="password"
          required
          value={confirmar}
          onChange={(e) => setConfirmar(e.target.value)}
        />
        {errorMsg && <p role="alert">{errorMsg}</p>}
        <button type="submit" disabled={status === "loading"}>
          {status === "loading" ? "Salvando..." : "Salvar nova senha"}
        </button>
      </form>
    </div>
  );
}
