import { MENSAGEM_MAX_CARACTERES, MORADORES, SERIE_HISTORICA, type ConteudoDoPacote } from "../conteudo";

/**
 * A RÉGUA do pacote — a mesma para a homologação do professor e para a saída
 * da IA (o `validar` do preparo). A forma (tamanhos, quantidades) é do Zod em
 * `contrato-de-rotas.ts`; aqui fica o que a forma não diz:
 *
 *   - a explicação da escala acompanha a escala: a variante 0 fala de 0% e não
 *     de 80%, e a variante 80 fala de 80% (o texto é o que vai NO post);
 *   - as reações são dos MESMOS três moradores nos dois ramos, na mesma ordem
 *     (o feed troca o tom, não as pessoas), e cada uma cabe nos 180 caracteres;
 *   - a nota técnica diz a estabilidade de 98% do resto da rede — é o
 *     contexto que a camada "contexto" resume e que o laudo usa;
 *   - os quatro períodos estão na mesma unidade de tempo (o bot diz "quatro
 *     períodos", e o eixo e a tabela leem os rótulos);
 *   - nenhum texto do pacote CRAVA outros números da série: 95, 94, 92 e 88
 *     são do servidor, e a IA que reescrevesse "caiu de 96 para 85" desmentiria
 *     a tabela. Os textos podem não citar número nenhum.
 *
 * Devolve as frases para o professor (vazio = dentro da régua).
 */
export function problemasDoConteudo(c: ConteudoDoPacote): string[] {
  const problemas: string[] = [];

  const zero = c.camadas.explicacao.zero;
  const oitenta = c.camadas.explicacao.oitenta;
  if (!/(^|\D)0\s?%/.test(zero) || /80\s?%/.test(zero)) problemas.push("A explicação da escala 0 precisa falar do eixo em 0% (e não de 80%).");
  if (!/80\s?%/.test(oitenta)) problemas.push("A explicação da escala 80 precisa falar do eixo recortado em 80%.");

  for (const ramo of ["zero", "oitenta"] as const) {
    if (c.reacoes[ramo].length !== MORADORES) problemas.push(`O ramo ${ramo} precisa de exatamente ${MORADORES} reações.`);
    for (const r of c.reacoes[ramo]) {
      if (r.texto.length > MENSAGEM_MAX_CARACTERES) problemas.push(`A reação de ${r.autor} passa de ${MENSAGEM_MAX_CARACTERES} caracteres.`);
    }
  }
  const autores = (ramo: "zero" | "oitenta") => c.reacoes[ramo].map((r) => r.autor.trim());
  if (autores("zero").join("|") !== autores("oitenta").join("|")) {
    problemas.push("As reações dos dois ramos precisam ser dos mesmos três moradores, na mesma ordem.");
  }
  if (c.posAha.conflito.texto.length > MENSAGEM_MAX_CARACTERES) problemas.push(`A fala do conflito passa de ${MENSAGEM_MAX_CARACTERES} caracteres.`);

  if (!/98\s?%/.test(c.notaTecnica.resumo)) problemas.push("O resumo da nota técnica precisa dizer a estabilidade de 98% no restante da rede.");

  if (c.servico.periodos.length !== SERIE_HISTORICA.length) problemas.push(`A tabela tem exatamente ${SERIE_HISTORICA.length} períodos.`);
  /* A unidade é a mesma nos quatro ("Semana 1"… ou "1º Quadrimestre"…): misturada, a tabela e o eixo do gráfico se desmentem. */
  const unidades = new Set(c.servico.periodos.map(unidadeDoPeriodo));
  if (unidades.size > 1) problemas.push("Os quatro períodos precisam estar na mesma unidade de tempo (ex.: Mês 1 a Mês 4).");
  if (c.servico.situacoes.length !== SERIE_HISTORICA.length) problemas.push(`A tabela tem exatamente ${SERIE_HISTORICA.length} situações.`);

  const permitidos = new Set(["0", "80", "98", "100", "7", "120", ...SERIE_HISTORICA.flatMap((s) => [s.valor, s.conformes, s.inconformes].map(String))]);
  for (const [onde, texto] of textosComNumero(c)) {
    for (const m of texto.matchAll(/(\d+(?:[.,]\d+)?)\s?%/g)) {
      if (!permitidos.has((m[1] ?? "").replace(",", "."))) problemas.push(`${onde} cita ${m[0]}, que não é um número da série (95, 94, 92, 88).`);
    }
  }
  return [...new Set(problemas)];
}

/** A unidade de um rótulo de período, sem o número nem o ordinal: "1º Quadrimestre" e "Quadrimestre 2" dão "quadrimestre". */
export function unidadeDoPeriodo(rotulo: string): string {
  return rotulo
    .replace(/\d+\s*[ºª°]?/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function textosComNumero(c: ConteudoDoPacote): Array<[string, string]> {
  return [
    ["O resumo da nota técnica", c.notaTecnica.resumo],
    ...c.notaTecnica.secoes.map((s, i): [string, string] => [`A seção ${i + 1} da nota técnica`, s.texto]),
    ["A camada de contexto", c.camadas.contexto],
    ["A camada de fonte", c.camadas.fonte],
    ...c.servico.situacoes.map((s, i): [string, string] => [`A situação do período ${i + 1}`, s]),
    ...[...c.reacoes.zero, ...c.reacoes.oitenta, c.posAha.conflito, c.posAha.coordenador].map((r): [string, string] => [`A fala de ${r.autor}`, r.texto]),
  ];
}
