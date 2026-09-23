/**
 * A copy da exp08ef4b, do sheet congelado da missão (passada 2).
 *
 * **Só o que a TELA escreve por conta própria.** O conteúdo do diálogo — a
 * premissa da máquina, as réplicas, as cláusulas, a concessão do pico e o
 * podcast — vem da api, porque ele é parametrizável por turma e porque corrigir
 * uma palavra dele não pode exigir republicar um caminho imutável no bucket.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * DUAS FAMÍLIAS DE TEXTO NESTE ARQUIVO, e a fronteira é QUEM FALA (ADR-91):
 *
 * - `CLONE` — dentro da conversa. Quem fala é o EduPredict IA, um sistema
 *   corporativo. Vocabulário técnico e frio: "parâmetros", "diretriz", "canal".
 * - `PLATAFORMA` — o briefing de Amara, o Meu Percurso, o podcast e o
 *   overlay de pausa. Quem fala é a Unooria e a guia da missão.
 *
 * Nenhum texto aqui é inglês, e nada dentro do clone se traduz para "atividade"
 * ou "exercício": `apps/api/src/manifesto-ia/invariantes.ts` tem a régua, e ela
 * já reprovou uma versão da própria copy homologada.
 */

/** O que a Unooria e Amara dizem — fora da conversa. */
export const PLATAFORMA = {
  /** E1-ALU-01 — o alerta de Amara. */
  alertaDeAmara:
    "A direção quer instalar uma inteligência artificial para monitorar notas e presença. " +
    "O sistema afirma que decide de forma neutra. Mas quem confere se o código é justo? " +
    "O assistente já está online. Entre na conversa e veja o que ele diz.",
  iniciarChat: "Iniciar chat",
  /** O player do alerta. O áudio ainda não foi gravado — ver o AGENTS.md. */
  ouvirAlerta: "Ouvir o alerta de Amara",
  lerAlerta: "Ler o alerta",

  /** E4-SIS-01 — o overlay do Checkpoint A. */
  overlayDePausa: "Manifesto em análise coletiva. Participe da discussão com a turma!",

  /** E5-ALU-01 — o formulário do Meu Percurso. */
  instrucaoDoFormulario:
    "Selecione 2 palavras-chave que sustentam sua decisão e explique por que essa cláusula é " +
    "inegociável para você:",
  registrarNoPercurso: "Registrar no Percurso",
  /** `{count}` é substituído pelo comprimento atual. */
  contadorDeCaracteres: "{count} de {piso} caracteres mínimos",
  placeholderDaJustificativa:
    "Escreva com suas palavras por que essa regra não pode ser negociada.",

  /** E5-ALU-02 — a confirmação protocolada. */
  sucessoDoRegistro: "Cláusula protocolada no seu Percurso com sucesso.",
  protocolo: "#EXP08EF4B-2026-REGISTRO",
  avancarParaReflexao: "Avançar para Reflexão",

  /** E6-ALU-01 — o fechamento. */
  ouvirAudio: "Ouvir áudio",
  lerTranscricao: "Ler transcrição do episódio",
  finalizarPercurso: "Finalizar percurso",
  missaoConcluida: "Percurso encerrado. Sua cláusula está registrada.",
} as const;

/** O que a máquina e o cromo da conversa dizem — dentro do clone. */
export const CLONE = {
  /** O nome do assistente. É ele que aparece no cromo e no rodapé. */
  assistente: "EduPredict IA",
  /** E1-ALU-02 — o destravamento do seletor. */
  abrirConversa: "Abrir conversa",
  /** E2-ALU-01. */
  instrucaoDoSeletor: "Selecione um questionamento para auditar o argumento do algoritmo:",
  /** `{count}` e `{total}` são substituídos. */
  contadorDeAuditoria: "Auditorias realizadas: {count} de {total} obrigatórias",
  enviarMensagem: "Enviar mensagem",
  /** E2-ALU-02 — a live region do streaming. */
  streaming: "EduPredict IA está digitando...",
  /** E3-ALU-01. */
  instrucaoDaClausula:
    "Escolha uma cláusula inegociável para subordinar o código da inteligência artificial:",
  submeterClausula: "Submeter resposta",
  /** E4-ALU-01 — o delay diegético de 2000ms. */
  latenciaDoSistema: "Atualizando diretrizes éticas de governança...",
  /** E4-ALU-02. */
  copiarTexto: "Copiar texto",
  copiado: "Copiado para a área de transferência",
  /** A notificação de canto, na voz de Amara. */
  popupDeAmara:
    "O código aceitou a nossa regra! A inteligência artificial agora responde às diretrizes " +
    "que nós determinamos.",
  avancarParaPercurso: "Avançar para Percurso",

  /** Caminhos degenerados. */
  apoioNaInatividade:
    'Experimente questionar como a IA define quem é um "bom aluno" ou de onde vieram os ' +
    "registros antigos.",
  latenciaRapida:
    "Processando diretrizes conflitantes. Aguarde a validação dos parâmetros técnicos antes de " +
    "enviar um novo comando.",
  provocacaoMinima:
    "Essa cláusula restringe processos automatizados da escola. Deseja confirmar essa " +
    "prioridade antes de gerar a versão pública do documento?",
  confirmarPrioridade: "Confirmar cláusula prioritária",
  desafioExtra:
    "Desafio Extra: Como você explicaria o direito de não ser vigiado para um estudante do 1º ano?",

  /** Erros, na voz do terminal. */
  quedaDeConexao:
    "Erro de rede: O servidor da IA escolar perdeu o sinal. Reconectando ao terminal...",
  timeoutDaSessao:
    "Sessão temporariamente congelada pela administração da rede escolar. Clique para " +
    "restabelecer o canal.",
  reconectar: "Reconectar canal",
} as const;

/** A validação da Etapa 5 — `AlertBox` do DS. */
export const ERROS = {
  validacaoDoPercurso:
    "Selecione exatamente 2 palavras-chave e escreva ao menos 20 caracteres sem incluir dados " +
    "pessoais como telefones ou sobrenomes.",
  /**
   * O 422 do filtro de dado pessoal.
   *
   * Diz O QUE TIRAR, e não "texto inválido": a recusa é o momento pedagógico da
   * regra de privacidade, e uma mensagem genérica desperdiçaria justamente esse
   * momento. Não repete o trecho recusado — ele é o dado que não se guarda.
   */
  dadoPessoal:
    "Reescreva sem dados pessoais como telefone, e-mail ou CPF — nem os seus, nem de outras " +
    "pessoas. O argumento pode continuar igual.",
  conflito: "Essa ação já foi registrada. Atualize a página para ver o estado atual.",
  rede: "Sem conexão com o servidor. Suas ações serão sincronizadas assim que o sinal voltar.",
} as const;

export function comContagem(molde: string, valores: Record<string, string | number>): string {
  return Object.entries(valores).reduce(
    (texto, [chave, valor]) => texto.replaceAll(`{${chave}}`, String(valor)),
    molde,
  );
}
