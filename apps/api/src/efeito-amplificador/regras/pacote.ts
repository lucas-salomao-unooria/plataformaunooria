import {
  COMENTARIO_PALAVRAS,
  COMENTARIOS_POR_PACOTE,
  MANCHETE_MAX_CARACTERES,
  MANCHETES,
  NOS,
  PARAGRAFO_MAX_PALAVRAS,
  PARAGRAFOS,
  type ConteudoDoPacote,
} from "../conteudo";

/**
 * A RÉGUA DO PACOTE — a mesma para o banco padrão, para a saída da IA (o
 * `validar` do preparo) e para a curadoria do professor (a homologação). Devolve
 * TODAS as frases de uma vez, para o professor corrigir de uma só vez.
 *
 * O que ela garante é a MECÂNICA da missão, que não muda com o tema (one-pager
 * §3, "camada fixa"): os três nós no rascunho, a correção de cada um que o
 * UnooriaAI entrega, o recorte que sobrevive à correção, as três manchetes e
 * os comentários da madrugada com as duas dimensões de saúde e o risco.
 */

const palavras = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
const contem = (t: string, trecho: string) => t.toLowerCase().includes(trecho.toLowerCase());
const temAspas = (t: string) => /["“”«»]/.test(t);

export function problemasDoConteudo(c: ConteudoDoPacote): string[] {
  const p: string[] = [];
  const n = c.rascunho.length;
  if (n < PARAGRAFOS.min || n > PARAGRAFOS.max) p.push(`O rascunho precisa de ${PARAGRAFOS.min} a ${PARAGRAFOS.max} parágrafos.`);
  const ids = c.rascunho.map((x) => x.id);
  if (new Set(ids).size !== ids.length) p.push("Cada parágrafo do rascunho precisa de um id próprio.");

  for (const no of NOS) {
    const doNo = c.rascunho.filter((x) => x.no === no);
    if (doNo.length !== 1) {
      p.push(`O rascunho precisa de exatamente um parágrafo com o nó "${no}".`);
      continue;
    }
    const par = doNo[0]!;
    if (!par.corrigido?.trim()) p.push(`O parágrafo do nó "${no}" precisa da versão corrigida que o UnooriaAI entrega.`);
    else if (par.corrigido.trim() === par.texto.trim()) p.push(`A versão corrigida do nó "${no}" é igual ao original.`);
  }
  for (const par of c.rascunho) {
    if (palavras(par.texto) > PARAGRAFO_MAX_PALAVRAS) p.push(`O parágrafo ${par.id} passa de ${PARAGRAFO_MAX_PALAVRAS} palavras.`);
    if (par.corrigido && palavras(par.corrigido) > PARAGRAFO_MAX_PALAVRAS) {
      p.push(`A versão corrigida do parágrafo ${par.id} passa de ${PARAGRAFO_MAX_PALAVRAS} palavras.`);
    }
    if (par.no === null && par.corrigido) p.push(`O parágrafo ${par.id} não é nó crítico e não tem versão corrigida.`);
  }

  const alucinacao = c.rascunho.find((x) => x.no === "alucinacao");
  const plagio = c.rascunho.find((x) => x.no === "plagio");
  const lgpd = c.rascunho.find((x) => x.no === "lgpd");
  if (alucinacao) {
    if (!contem(alucinacao.texto, c.fonteInventada)) p.push("A alucinação precisa citar a fonte inventada pelo nome.");
    if (alucinacao.corrigido && contem(alucinacao.corrigido, c.fonteInventada)) p.push("A versão corrigida da alucinação não pode citar a fonte inventada.");
  }
  if (lgpd) {
    if (!contem(lgpd.texto, c.colega)) p.push("O nó de LGPD precisa citar o colega exposto pelo nome.");
    if (lgpd.corrigido && contem(lgpd.corrigido, c.colega)) p.push("A versão corrigida do nó de LGPD não pode citar o colega.");
  }
  if (plagio) {
    if (temAspas(plagio.texto)) p.push("O trecho copiado precisa aparecer SEM aspas no original.");
    if (plagio.corrigido && !temAspas(plagio.corrigido)) p.push("A versão corrigida do trecho copiado precisa das aspas.");
    if (plagio.corrigido && !contem(plagio.corrigido, c.veiculo)) p.push("A versão corrigida do trecho copiado precisa creditar o veículo.");
    if (!contem(plagio.texto, c.recorte) || (plagio.corrigido && !contem(plagio.corrigido, c.recorte))) {
      p.push("O recorte que o algoritmo pinça precisa estar no trecho copiado, no original E na versão corrigida.");
    }
  }
  if (c.fonteInventada.trim().length < 3) p.push("Informe a fonte inventada da alucinação.");
  if (c.colega.trim().length < 3) p.push("Informe o colega exposto no nó de LGPD.");
  if (c.veiculo.trim().length < 3) p.push("Informe o veículo do trecho copiado.");

  for (const m of MANCHETES) {
    const t = c.manchetes[m]?.trim() ?? "";
    if (!t) p.push(`Falta a manchete ${m}.`);
    else if (t.length > MANCHETE_MAX_CARACTERES) p.push(`A manchete ${m} passa de ${MANCHETE_MAX_CARACTERES} caracteres.`);
  }

  if (c.comentarios.length !== COMENTARIOS_POR_PACOTE) p.push(`O feed precisa de exatamente ${COMENTARIOS_POR_PACOTE} comentários.`);
  const cids = c.comentarios.map((x) => x.id);
  if (new Set(cids).size !== cids.length) p.push("Cada comentário precisa de um id próprio.");
  const tipos = new Set(c.comentarios.map((x) => x.tipo));
  for (const [tipo, frase] of [
    ["saude_fisica", "um relato de saúde física (sono, dor, cansaço)"],
    ["saude_mental", "um relato de saúde mental (ansiedade, medo, humilhação)"],
    ["risco_seguranca", "uma conta suspeita ou invasiva"],
  ] as const) {
    if (!tipos.has(tipo)) p.push(`Os comentários precisam de pelo menos ${frase}.`);
  }
  for (const com of c.comentarios) {
    const w = palavras(com.texto);
    if (w < COMENTARIO_PALAVRAS.min || w > COMENTARIO_PALAVRAS.max) {
      p.push(`O comentário de ${com.autor || com.id} precisa ter de ${COMENTARIO_PALAVRAS.min} a ${COMENTARIO_PALAVRAS.max} palavras.`);
    }
    if (!horarioDeMadrugada(com.horario)) p.push(`O comentário de ${com.autor || com.id} precisa ser de madrugada (entre 01:00 e 03:59).`);
  }
  return [...new Set(p)];
}

/** "02:40" — entre 01:00 e 03:59: o motor entrega de madrugada para todos. */
export function horarioDeMadrugada(h: string): boolean {
  const m = /^(\d{2}):(\d{2})$/.exec(h);
  if (!m) return false;
  const hora = Number(m[1]);
  const minuto = Number(m[2]);
  return hora >= 1 && hora <= 3 && minuto <= 59;
}
