import type { FichaPedagogica } from "./tipos";

/**
 * A FICHA DO JÚRI ESTADUAL DE PROJETOS (exp06ef1b, 6º ano, unidade 1) —
 * versão 6, de 2026-10-20 (ADR-176, os ajustes do time que rodou a missão),
 * sobre a versão 5 (ADR-174, só o Canal A). Toda habilidade é medida pelo que
 * a criança FAZ, contra o TEXTO OFICIAL da BNCC; as enquetes P1–P3 saíram,
 * como no 4º, 5º, 7º e 8º anos e na 2ª série. O PO reordenou o foco:
 *
 *   - **EF06CO01** (a primária) pela SEPARAÇÃO nas PASTAS: no próprio feed, o
 *     "Salvar" do post abre as quatro pastas da mostra, e a criança guarda cada
 *     estande na área dele; o servidor corrige no voto
 *     (`juri-estadual/regras/classificacao.ts#nivelDaClassificacao`). A régua
 *     é a da versão 5; o que mudou foi ONDE a criança separa — por isso a
 *     versão sobe, e as marcas da 5 ficam com a delas;
 *   - **EF06CO03** pela REGRA SE … ENTÃO montada com peças, depois da revisão do
 *     voto (`juri-estadual/regras/regra.ts#nivelDaRegra`).
 *
 * A **EF06CO10 saiu da missão**: o texto oficial (consumo de tecnologia,
 * produção, obsolescência, sustentabilidade) não é o que o Júri trabalha. A
 * galeria continua, como experiência, sem marcar nada.
 *
 * Uma tentativa em cada tarefa: o nível é o que a criança sabia ANTES de ver a
 * resposta. Toda rodada mede de novo (ADR-145). Quem não fez a tarefa fica "Não
 * avaliado" — a AUSÊNCIA de marca —, nunca "não atingiu", e o professor ajusta.
 * Os níveis da versão 4 (auditoria, cadeia, enquetes) ficam no histórico,
 * gravados com a versão deles; `regra` é marcador NOVO para a régua nova não se
 * misturar com a contagem de tentativas da cadeia.
 */
export const FICHA_EXP06EF1B: FichaPedagogica = {
  expId: "exp06ef1b",
  versao: 6,
  habilidades: [
    {
      codigo: "EF06CO01",
      marcadores: [{ id: "classificacao", tipo: "acao", rotulo: "Pastas dos estandes" }],
      criterios: {
        atingiu:
          "Durante o feed, guarda nas pastas das quatro áreas os estandes que viu e acerta 9 ou 10 de cada 10 (90% ou mais).",
        em_processo: "Guarda os estandes nas pastas das áreas e acerta de 5 a 8 de cada 10 (de 50% a 89%).",
        nao_atingiu: "Guarda os estandes nas pastas das áreas e acerta 4 ou menos de cada 10.",
        observacao:
          'É o "classificar informações, agrupando-as em coleções" da BNCC: cada pasta é uma coleção, como as coleções de posts salvos de uma rede social, e a criança associa cada estande a ela. O voto só fecha com todo estande visto numa pasta, e a correção acontece no voto, antes da Galeria Oculta. O post mostra o perfil e a hashtag da área: a pasta certa está ao alcance de quem lê o post com atenção. Quem viu menos de quatro estandes fica "Não avaliado", e você pode ajustar.',
      },
    },
    {
      codigo: "EF06CO03",
      marcadores: [{ id: "regra", tipo: "acao", rotulo: "Regra SE … ENTÃO" }],
      criterios: {
        atingiu: "Monta a regra que o programa do feed executou com a condição certa no SE e a ação certa no ENTÃO.",
        em_processo: "Monta a regra com só uma das duas partes certa.",
        nao_atingiu: "Monta a regra com as duas partes erradas.",
        observacao:
          'É o "descrever com precisão a solução, construindo o programa" da BNCC: a criança escolhe a instrução, não só a reconhece. Uma tentativa; depois, a tela mostra a regra certa ligada ao feed dela. Sem a regra enviada, a habilidade fica "Não avaliado", e você pode ajustar.',
      },
    },
  ],
  perguntas: [],
};
