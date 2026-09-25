import type { SupabaseClient } from "@supabase/supabase-js";

// Sair da conta SÓ neste navegador. O padrão do Supabase (`signOut()` sem
// argumento) é `scope: "global"`: encerra TODAS as sessões da conta — o
// Radar PokerSync no computador do jogador e o site no celular caíam
// juntos a cada "Sair" e a cada saída automática por inatividade (bug
// relatado: "o radar não fica logado quando liga o pc"). Sair de tudo só
// faz sentido quando a conta é excluída (app/api/account/delete).
export function sairDesteAparelho(supabase: { auth: SupabaseClient["auth"] }) {
  return supabase.auth.signOut({ scope: "local" });
}
