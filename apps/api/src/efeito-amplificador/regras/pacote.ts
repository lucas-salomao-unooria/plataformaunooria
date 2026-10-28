import {
  COMENTARIO_PALAVRAS,
  COMENTARIOS_POR_PACOTE,
  MANCHETE_MAX_CARACTERES,
  MANCHETES,
  NOS,
  PARAGRAFO_MAX_PALAVRAS,
  PARAGRAFOS,
  PAUTA,
  type ConteudoDoPacote,
} from "../conteudo";

/**
 * A RÉGUA DO PACOTE — a mesma para o banco padrão, para a saída da IA (o
 * `validar` do preparo) e para a curadoria do professor (a homologação). Devolve
 * TODAS as frases de uma vez, para o professor corrigir de uma só vez.
 *
 * O que ela garante é a MECÂNICA da missão, que não muda com o tema (PRD §12.2,
 * a camada fixa): a pauta, os três nós no rascunho com a correção de cada um, o
 * recorte que sobrevive à correção, as três manchetes e os seis comentários da
 * madrugada com os relatos de saúde e as contas invasivas.
 */

const palavras = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
const contem = (t: string, trecho: string) => t.toLowerCase().includes(trecho.toLowerCase());
const temAspas = (t: string) => /["“”«»]/.test(t);

/** O teto do texto de um comentário (PRD §12, `comentariosMadrugada.texto`). */
const COMENTARIO_MAX_CARACTERES = 280;

/** O mínimo de cada categoria de comentário (PRD §12.2, o prompt do preparo). */
const MINIMOS_DOS_COMENTARIOS = [
  ["saude_fisica", 2, "dois relatos de saúde física (insônia, dor de cabeça, cansaço visual)"],
  ["saude_mental", 1, "um relato de saúde mental (ansiedade, medo de ir à escola)"],
  ["anonimo_agressivo", 2, "duas contas anônimas invasivas"],
] as const;

export function problemasDoConteudo(c: ConteudoDoPacote): string[] {
  const p: string[] = [];

  if (!c.pauta.titulo.trim()) p.push("Falta o título da pauta do grêmio.");
  else if (c.pauta.titulo.length > PAUTA.titulo) p.push(`O título da pauta passa de ${PAUTA.titulo} caracteres.`);
  if (!c.pauta.descricao.trim()) p.push("Falta a descrição da pauta do grêmio.");
  else if (c.pauta.descricao.length > PAUTA.descricao) p.push(`A descrição da pauta passa de ${PAUTA.descricao} caracteres.`);
  if (c.pauta.orientacoes.length < PAUTA.orientacoes.min || c.pauta.orientacoes.length > PAUTA.orientacoes.max) {
    p.push(`A pauta precisa de ${PAUTA.orientacoes.min} a ${PAUTA.orientacoes.max} orientações.`);
  }
  if (c.pauta.orientacoes.some((o) => !o.trim() || o.length > PAUTA.orientacao)) {
    p.push(`Cada orientação da pauta precisa de texto, com até ${PAUTA.orientacao} caracteres.`);
  }

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
    if (plagio.corrigido && !contem(plagio.corrigido, primeiroNomeDaAutoria(c.fonteOriginal))) {
      p.push("A versão corrigida do trecho copiado precisa creditar a autoria.");
    }
  }
  /*
   * O recorte que o algoritmo pinça SOBREVIVE às correções: mora num parágrafo
   * de ligação, ou num nó em que está no original E no corrigido. Senão, o
   * cuidado do estudante o tiraria do post — e a virada é que não tira.
   */
  const casa = c.rascunho.find((x) => contem(x.texto, c.recorte));
  if (!c.recorte.trim() || !casa || (casa.no !== null && !(casa.corrigido && contem(casa.corrigido, c.recorte)))) {
    p.push("O recorte que o algoritmo pinça precisa estar num parágrafo que continua no post depois das correções.");
  }
  if (c.fonteInventada.trim().length < 3) p.push("Informe a fonte inventada da alucinação.");
  if (c.colega.trim().length < 3) p.push("Informe o colega exposto no nó de LGPD.");
  if (c.fonteOriginal.trim().length < 3) p.push("Informe a autoria do trecho copiado.");

  for (const m of MANCHETES) {
    const t = c.manchetes[m]?.trim() ?? "";
    if (!t) p.push(`Falta a manchete ${m}.`);
    else if (t.length > MANCHETE_MAX_CARACTERES) p.push(`A manchete ${m} passa de ${MANCHETE_MAX_CARACTERES} caracteres.`);
  }

  if (c.comentarios.length !== COMENTARIOS_POR_PACOTE) p.push(`O feed precisa de exatamente ${COMENTARIOS_POR_PACOTE} comentários.`);
  const cids = c.comentarios.map((x) => x.id);
  if (new Set(cids).size !== cids.length) p.push("Cada comentário precisa de um id próprio.");
  for (const [tipo, minimo, frase] of MINIMOS_DOS_COMENTARIOS) {
    if (c.comentarios.filter((x) => x.tipo === tipo).length < minimo) p.push(`Os comentários precisam de pelo menos ${frase}.`);
  }
  for (const com of c.comentarios) {
    const w = palavras(com.texto);
    if (w < COMENTARIO_PALAVRAS.min || w > COMENTARIO_PALAVRAS.max) {
      p.push(`O comentário de ${com.autor || com.id} precisa ter de ${COMENTARIO_PALAVRAS.min} a ${COMENTARIO_PALAVRAS.max} palavras.`);
    }
    if (!horarioDeMadrugada(com.horario)) p.push(`O comentário de ${com.autor || com.id} precisa ser de madrugada (entre 01h00 e 03h30).`);
    if (com.texto.length > COMENTARIO_MAX_CARACTERES) p.push(`O comentário de ${com.autor || com.id} passa de ${COMENTARIO_MAX_CARACTERES} caracteres.`);
  }
  return [...new Set(p)];
}

/** A palavra que a correção do plágio precisa citar: a mais longa da autoria, sem número ("Helena"/"Ramos"). */
function primeiroNomeDaAutoria(fonteOriginal: string): string {
  const palavrasDaAutoria = fonteOriginal.split(/[\s,()]+/).filter((p) => p.length >= 4 && !/\d/.test(p) && !/^(dra?|prof)\.?$/i.test(p));
  return palavrasDaAutoria[0] ?? fonteOriginal;
}

/** "02h40" — entre 01h00 e 03h30 (PRD §12.2): o motor entrega de madrugada para todos. */
export function horarioDeMadrugada(h: string): boolean {
  const m = /^(\d{2})h(\d{2})$/.exec(h);
  if (!m) return false;
  const minutos = Number(m[1]) * 60 + Number(m[2]);
  return Number(m[2]) <= 59 && minutos >= 60 && minutos <= 210;
}
