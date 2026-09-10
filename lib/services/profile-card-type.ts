// Formato comum devolvido pelas RPCs public_profile_cards/teammates_birthdays/
// friends_profile_info/presence_last_seen (ver migração fix_profiles_pii_leak) —
// substituem `.from("profiles").select(...)` direto pra ler dado de OUTRO
// usuário, porque a tabela só permite cada um ler a própria linha agora.
// Sem tipos gerados do Supabase pro schema, o cliente não tem como inferir
// sozinho a forma de retorno de uma função nova — as anotações abaixo
// fecham esse buraco nos call sites.
export interface ProfileCard {
  id: string;
  nome: string | null;
  apelido: string | null;
  avatar_id: number | null;
  avatar_url: string | null;
}
