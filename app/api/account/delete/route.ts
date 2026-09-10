// app/api/account/delete/route.ts
//
// Exclusão de conta (LGPD art. 18, VI — direito ao esquecimento), feita
// pelo próprio usuário dentro do produto. Dois passos:
// 1. RPC delete_own_account() (Postgres, SECURITY DEFINER travado no
//    próprio auth.uid() de quem chama) apaga os dados pessoais em todas
//    as tabelas do produto -- ver a migration para o escopo exato e o
//    que fica de fora (conteúdo de time criado como coach/admin).
// 2. Exclusão do usuário no Supabase Auth via service role
//    (auth.admin.deleteUser) -- só depois do passo 1 dar certo, pra
//    nunca ficar com dado órfão sem dono nenhum capaz de reclamá-lo.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sessão expirada." }, { status: 401 });

  const { error: rpcError } = await supabase.rpc("delete_own_account");
  if (rpcError) {
    console.error("[account/delete] rpc", rpcError);
    return NextResponse.json(
      { ok: false, error: "Não foi possível apagar seus dados. Tente de novo ou fale com o suporte." },
      { status: 500 }
    );
  }

  const service = createServiceClient();
  const { error: authError } = await service.auth.admin.deleteUser(user.id);
  if (authError) {
    // Dados já apagados, mas a conta de login ainda existe -- registra
    // pra investigação manual em vez de deixar o usuário achar que
    // falhou tudo (a parte que importa pra LGPD, os dados, já foi).
    console.error("[account/delete] auth admin deleteUser", authError);
    return NextResponse.json(
      {
        ok: false,
        error: "Seus dados foram apagados, mas houve um problema ao encerrar o login. Fale com o suporte.",
      },
      { status: 500 }
    );
  }

  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
