/**
 * O vocabulário do currículo. Estes tipos são o contrato entre o dado extraído
 * dos PDFs oficiais (`dados/*.ts`, gerados) e tudo que consulta currículo: o
 * catálogo servido à app-92, o gerador de plano anual e o de plano de período.
 *
 * A fonte é o PDF HOMOLOGADO do MEC (dez/2018), extraído por
 * `scripts/extrair-bncc.mjs`. Não é o dataset de terceiro nem a planilha do
 * portal de download — os dois existem, mas num contrato B2G a pergunta "de
 * onde veio esse texto?" precisa terminar no documento oficial, e a página do
 * Ensino Médio do próprio MEC serve um RASCUNHO cujos textos divergem do
 * homologado (`EM13MAT101` perdeu "criticamente" e "fatos relativos").
 */

/** `1EF`..`9EF`, `1EM`..`3EM` — o mesmo formato de `comum/series.ts`. */
export type Ano = string;

/**
 * Uma habilidade da BNCC, como ela existe no documento.
 *
 * `anos` é uma LISTA porque o código carrega uma faixa: `EF15LP01` vale do 1º
 * ao 5º ano. 330 das 1.304 habilidades do EF pertencem a mais de um ano, e a
 * habilidade continua sendo UMA — o professor do 3º ano precisa vê-la tanto
 * quanto o do 1º. Modelar como 1:1 com ano duplicaria o texto e faria o código,
 * que é a identidade natural, deixar de ser chave.
 */
export interface HabilidadeBncc {
  /** `EF15LP01`, `EM13MAT101`, `EF03CO04`. Identidade natural. */
  readonly codigo: string;
  readonly descricao: string;
  readonly etapa: "EF" | "EM";
  readonly anos: readonly Ano[];
  /** Slug do componente, ou da ÁREA quando o EM só organiza por área. */
  readonly componente: string;
  readonly area: string | null;

  /**
   * O organizador imediatamente acima do objeto de conhecimento. O nome muda
   * conforme o componente, e a BNCC não é uniforme nisso: sete componentes
   * chamam de "unidade temática", Língua Portuguesa usa prática de linguagem
   * dentro de campo de atuação, e Língua Inglesa usa "eixo". Guardamos o rótulo
   * como veio do documento; `tipoDeOrganizador()` diz como chamá-lo na tela.
   */
  readonly unidadeTematica?: string | null;
  readonly objetoDeConhecimento?: string | null;

  /**
   * Só no EM, e só nas habilidades de ÁREA: o primeiro dos três dígitos do
   * código é a competência específica a que a habilidade responde
   * (`EM13MAT101` → competência 1). As 54 habilidades de Língua Portuguesa do
   * EM fogem do padrão — são `EM13LP01`..`EM13LP54`, sequenciais no componente
   * — e por isso vêm com `null`.
   */
  readonly competenciaEspecifica?: number | null;

  /** Só na Computação: Pensamento Computacional, Mundo Digital, Cultura Digital. */
  readonly eixo?: string | null;
  /**
   * Só na Computação, e é o ativo mais valioso dela: as colunas "EXPLICAÇÃO DA
   * HABILIDADE" e "EXEMPLOS" do anexo do Parecer CNE/CEB 2/2022. Texto
   * pedagógico pronto, que nenhum dataset público da BNCC empacota.
   */
  readonly explicacao?: string | null;
  readonly exemplos?: string | null;
}

/**
 * Um componente curricular como ele aparece na MATRIZ DA REDE — que não é a
 * mesma lista da BNCC. A distinção é o centro do produto:
 *
 * No Ensino Fundamental os dois coincidem: existe "História", e existem
 * habilidades `EF__HI__`.
 *
 * No Ensino Médio NÃO coincidem. A matriz da rede tem Biologia, Física e
 * Química; a BNCC do EM organiza habilidades por ÁREA — as três compartilham as
 * habilidades de Ciências da Natureza e suas Tecnologias. O mesmo vale para
 * História, Geografia, Filosofia e Sociologia, que dividem as de Ciências
 * Humanas e Sociais Aplicadas. Um produto que ignore isso mostra "nenhuma
 * habilidade encontrada" ao professor de Biologia do 2º ano, que é o caso mais
 * comum do Ensino Médio.
 *
 * `componenteBncc` é por onde as habilidades são buscadas; `slug` é o que o
 * professor escolhe.
 */
export interface ComponenteCurricular {
  readonly slug: string;
  readonly rotulo: string;
  readonly area: string;
  /** Onde buscar as habilidades: o próprio slug no EF, a área no EM. */
  readonly componenteBncc: string;
  /** Anos em que a rede oferta o componente. */
  readonly anos: readonly Ano[];
  /**
   * `true` quando a habilidade encontrada é da ÁREA e não do componente — a
   * tela precisa dizer isso ao professor, senão ele lê "as habilidades de
   * Biologia" onde estão as de Ciências da Natureza inteira.
   */
  readonly habilidadesPorArea?: boolean;
  /**
   * Matrícula facultativa ao estudante (LDB art. 33, Ensino Religioso) ou
   * oferta minoritária entre as redes (Língua Inglesa nos anos iniciais).
   */
  readonly opcional?: boolean;
  readonly observacao?: string;
}

/** Como chamar o organizador na tela, por componente. A BNCC não é uniforme. */
export type TipoDeOrganizador =
  | "unidade-tematica"
  | "pratica-de-linguagem"
  | "eixo"
  | "competencia";
