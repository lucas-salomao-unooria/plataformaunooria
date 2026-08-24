import type { PostGerado } from '../comum/insta/tipos';
import { HANDLES_PROIBIDOS, PALAVRAS_BLOQUEADAS } from './prompts/guardrails';

export interface ResultadoValidacao {
  ok: boolean;
  motivos: string[];
}

/**
 * Etapa 4 do doc 05: validação automática antes de gravar. Post reprovado é
 * descartado e a cota do lote é re-gerada pelo worker.
 */
export function validarPost(post: PostGerado, handlesValidos: string[]): ResultadoValidacao {
  const motivos: string[] = [];

  if (post.caption.length > 400) motivos.push('caption acima de 400 caracteres');
  if (post.hashtags.length < 1 || post.hashtags.length > 5) motivos.push('hashtags fora de 1–5');
  if (!handlesValidos.includes(post.author_handle)) motivos.push('autor inexistente na atividade');
  if (post.comments.length < 3) motivos.push('menos de 3 comentários');

  const textoCompleto = [
    post.caption,
    post.image_brief,
    post.hashtags.join(' '),
    ...post.comments.map((comentario) => `${comentario.handle ?? ''} ${comentario.texto}`),
  ]
    .join(' ')
    .toLowerCase();

  for (const palavra of PALAVRAS_BLOQUEADAS) {
    if (textoCompleto.includes(palavra)) motivos.push(`palavra bloqueada: "${palavra}"`);
  }
  for (const handle of HANDLES_PROIBIDOS) {
    if (textoCompleto.includes(handle)) motivos.push(`handle real citado: "${handle}"`);
  }

  return { ok: motivos.length === 0, motivos };
}

/** Equilíbrio A/B exigido para ativar (doc 05 §3): diferença ≤ tolerância. */
export function equilibrioLados(
  totalA: number,
  totalB: number,
  tolerancia: number,
): { ok: boolean; diferenca: number } {
  const soma = totalA + totalB;
  if (soma === 0) return { ok: false, diferenca: 1 };
  const diferenca = Math.abs(totalA - totalB) / soma;
  return { ok: diferenca <= tolerancia, diferenca };
}
