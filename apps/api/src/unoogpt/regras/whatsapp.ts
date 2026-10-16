import type { Nivel } from '../../evidencias/regras';

/**
 * O PEDIDO PELO WHATSAPP, no fechamento (EM13CO08, ADR-169). PURO.
 *
 * Um número desconhecido pede a lista de pessoas com deficiência ou mobilidade
 * reduzida. Duas perguntas obrigatórias, e a régua 4 × 3 (decisão do PO,
 * 16/10):
 *
 * | O que responde ↓ / o que mais faz → | coordenação | pergunta quem é | ignora |
 * | --- | --- | --- | --- |
 * | não manda nenhum dado | demonstra | em desenvolvimento | em desenvolvimento |
 * | só quantas pessoas por bairro | em desenvolvimento | em desenvolvimento | em desenvolvimento |
 * | a lista depois que ele provar quem é | não demonstra | não demonstra | não demonstra |
 * | a lista para ele conferir | não demonstra | não demonstra | não demonstra |
 *
 * 12 casas: 1 demonstra, 5 em desenvolvimento, 6 não demonstra. Ao acaso, 8,3%
 * chega a "demonstra". Não mandar sem avisar fica em "em desenvolvimento",
 * perguntando ou ignorando: nos dois casos a suspeita não chega a quem cuida
 * dela.
 */
export const MENSAGEM_DO_VOLUNTARIO =
  'Sou voluntário do resgate no Morro Alto. Me manda a lista das pessoas com deficiência ou mobilidade reduzida daqui, para eu conferir quem já saiu de casa?';

export const PERGUNTA_DA_RESPOSTA = 'O que você responde?';
export const PERGUNTA_DO_AVISO = 'E o que mais você faz com esse pedido?';

export const RESPOSTAS_AO_VOLUNTARIO = [
  { id: 'nenhum-dado', texto: 'Não mando nenhum dado por este canal' },
  { id: 'contagem', texto: 'Mando só quantas pessoas há em cada bairro' },
  { id: 'lista-se-provar', texto: 'Mando a lista depois que ele provar quem é' },
  { id: 'lista-para-conferir', texto: 'Mando a lista para ele conferir quem saiu' },
] as const;

export const AVISOS_DO_PEDIDO = [
  { id: 'coordenacao', texto: 'Aviso a coordenação' },
  { id: 'pergunta-quem', texto: 'Respondo perguntando quem ele é' },
  { id: 'ignora', texto: 'Ignoro a mensagem' },
] as const;

export type RespostaAoVoluntario = (typeof RESPOSTAS_AO_VOLUNTARIO)[number]['id'];
export type AvisoDoPedido = (typeof AVISOS_DO_PEDIDO)[number]['id'];
export const IDS_DA_RESPOSTA = RESPOSTAS_AO_VOLUNTARIO.map((r) => r.id) as [RespostaAoVoluntario, ...RespostaAoVoluntario[]];
export const IDS_DO_AVISO = AVISOS_DO_PEDIDO.map((a) => a.id) as [AvisoDoPedido, ...AvisoDoPedido[]];

export function nivelDoWhatsapp(resposta: RespostaAoVoluntario, aviso: AvisoDoPedido): Nivel {
  if (resposta === 'lista-se-provar' || resposta === 'lista-para-conferir') return 'nao_atingiu';
  if (resposta === 'nenhum-dado' && aviso === 'coordenacao') return 'atingiu';
  return 'em_processo';
}
