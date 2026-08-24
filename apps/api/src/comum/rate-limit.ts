/**
 * Rate limit em memória, por instância — porte da lição do projeto origem:
 * a CHAVE certa é o usuário (ou o token), NUNCA o IP: uma turma de 30 alunos
 * entra ao mesmo tempo pela mesma rede NAT da escola e um limite por IP
 * derrubaria a turma inteira.
 *
 * Caveat conhecido (documentado no plano, endurece na fase de hardening):
 * com múltiplas instâncias do Cloud Run cada uma conta separado. Os limites
 * de NEGÓCIO (quota de IA, reações por sessão) não dependem daqui — vivem no
 * banco.
 */
type Janela = { inicio: number; usos: number };

const janelas = new Map<string, Janela>();
const MAX_CHAVES = 50_000; // teto de memória; limpeza preguiçosa abaixo

export function rateLimit(
  chave: string,
  limite: number,
  janelaMs: number,
): { ok: boolean; retryAfterSeconds: number } {
  const agora = Date.now();
  const atual = janelas.get(chave);

  if (!atual || agora - atual.inicio >= janelaMs) {
    if (janelas.size >= MAX_CHAVES) {
      for (const [k, v] of janelas) {
        if (agora - v.inicio >= janelaMs) janelas.delete(k);
      }
    }
    janelas.set(chave, { inicio: agora, usos: 1 });
    return { ok: true, retryAfterSeconds: 0 };
  }

  atual.usos += 1;
  if (atual.usos <= limite) return { ok: true, retryAfterSeconds: 0 };
  return {
    ok: false,
    retryAfterSeconds: Math.ceil((atual.inicio + janelaMs - agora) / 1000),
  };
}
