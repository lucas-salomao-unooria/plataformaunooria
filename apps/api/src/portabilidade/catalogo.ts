/**
 * O PERFIL PORTÁTIL: o que a criança leva quando sai da REDE.
 *
 * Transferência entre escolas do mesmo contrato já é resolvida pela lotação —
 * lá o dado fica onde foi produzido e a leitura atravessa por uma porta só
 * (`GET /estudantes/:id/historico`). Este módulo é para o outro caso: a criança sai
 * da rede estadual para a municipal, que é outro contrato, outra stack, outro
 * banco. Não há JOIN possível, e **não há garantia nenhuma de que a rede de
 * destino comprou o produto**.
 *
 * Por isso a saída não é integração, é DOCUMENTO. Um arquivo assinado que a
 * escola de origem emite a pedido do titular (LGPD art. 18 V, portabilidade) e
 * que a escola de destino importa como um ato dela. Para uma rede que nunca vai
 * instalar esta plataforma, o mesmo arquivo continua sendo um documento legível.
 */

/** Nome do documento. Vai dentro do arquivo para que ele se identifique sozinho. */
export const TIPO_DOCUMENTO = "perfil-portatil-unooria";

/**
 * Versão do FORMATO. Sobe quando o formato muda de modo incompatível; o
 * importador recusa versão que não conhece em vez de adivinhar meia leitura —
 * a mesma regra do `protocolVersion` da bridge.
 */
export const VERSAO_DOCUMENTO = 1;

/**
 * O QUE ENTRA NO DOCUMENTO, E POR QUÊ.
 *
 * - `trajetoria`: por onde a criança passou (escolas e turmas, com datas). É o
 *   que a escola de destino precisa para enturmar sem começar do zero.
 * - `participacoes`: em que experiências ela esteve e quando. Participação, não
 *   conteúdo.
 * - `resultados`: o que a plataforma sabe AFIRMAR sobre ela, com a versão do
 *   instrumento junto. Hoje só o retrato de valores da Vila do Lume, e ele só
 *   viaja com `versaoMapeamento` — sem a versão, dois retratos de gerações
 *   diferentes pareceriam comparáveis, que é exatamente o erro que o
 *   reprocessamento existe para evitar.
 *
 * O QUE NUNCA ENTRA, e isto é decisão, não lacuna:
 *
 * - **Bem-estar (exp-91)**. DASS-21 é dado de saúde (LGPD art.~11), a posse é do
 *   professor e não existe rota de gestor nem de agregado para ele em lugar
 *   nenhum desta plataforma. Um documento que o gestor emite não pode carregar o
 *   que nem o gestor pode ler.
 * - **Conteúdo de instrumento**: as respostas, as conversas, os textos que a
 *   criança escreveu. O documento diz o que ela fez e o que se mediu, nunca o
 *   material bruto — pela mesma razão que `GET /estudantes/:id/historico` devolve
 *   participações e não o conteúdo.
 * - **Texto livre de qualquer origem.** Pelo mesmo motivo que `eventos[].dados`
 *   da Vila só aceita vocabulário fechado: texto livre é o caminho por onde o
 *   nome de outra criança chegaria a um arquivo que sai da instalação.
 */
export const CONTEUDO_DO_DOCUMENTO = ["trajetoria", "participacoes", "resultados"] as const;

/** Resultado de um instrumento, por experiência. Vocabulário fechado. */
export const TIPOS_DE_RESULTADO = ["perfil-de-valores"] as const;
export type TipoDeResultado = (typeof TIPOS_DE_RESULTADO)[number];

/**
 * Como a assinatura foi conferida na importação.
 *
 * A diferença entre as duas é a coisa mais importante da tela: `verificada`
 * significa que falamos com o emissor e a chave dele confere; `nao-verificada`
 * significa que NÃO conseguimos falar com ele. Assinatura presente e
 * criptograficamente INVÁLIDA não é um terceiro estado — é recusa na
 * importação, porque isso é adulteração, não limitação de rede.
 */
export const VERIFICACOES = ["verificada", "nao-verificada"] as const;
export type Verificacao = (typeof VERIFICACOES)[number];
