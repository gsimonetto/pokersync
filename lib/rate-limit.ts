// Limite de tentativas simples, em memória, sem serviço externo. Corta
// abuso óbvio (flood com um token de agente vazado, tentativas repetidas
// de adivinhar um código de login) mesmo sem Redis/Upstash.
//
// Limitação conhecida e aceita: cada instância do servidor tem sua
// própria janela (não é compartilhado entre instâncias serverless). Não
// é uma defesa perfeita contra um atacante distribuído, mas já impede o
// caso comum -- um cliente batendo repetido na mesma rota.
const buckets = new Map<string, { count: number; resetAt: number }>();

let lastSweep = Date.now();
const SWEEP_INTERVAL_MS = 60_000;

function sweep(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, entry] of buckets) {
    if (now > entry.resetAt) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

/**
 * @param key identifica quem está sendo limitado (ex.: `"agent-sync:" + ip`)
 * @param limit quantas requisições permitidas dentro da janela
 * @param windowMs duração da janela em milissegundos
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const entry = buckets.get(key);
  if (!entry || now > entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (entry.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

// x-forwarded-for pode trazer uma cadeia "cliente, proxy1, proxy2" --
// o primeiro IP é o mais próximo do cliente real atrás do proxy da Vercel.
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export function rateLimitResponse(retryAfterSeconds: number) {
  return Response.json(
    { ok: false, error: "Muitas tentativas — aguarde um pouco e tente de novo." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  );
}
