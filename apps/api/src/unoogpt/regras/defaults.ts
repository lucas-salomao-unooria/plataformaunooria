/**
 * Configuração-como-código: números de calibragem num lugar só, com o motivo
 * escrito — e que NÃO viram campo de formulário do professor.
 *
 * Três constantes do projeto de origem não vieram, e o porquê importa:
 *
 * - `RETENCAO_TRANSCRICAO_DIAS = 30` morreu com a coluna `expires_at`. Lá havia
 *   uma rota de cron para cumpri-la; esta plataforma não tem job agendado, de
 *   propósito, e prazo que nenhuma rotina cumpre é pior que prazo nenhum —
 *   quem lê o schema acredita nele. O caminho de exclusão que existe de fato é
 *   zerar a turma.
 * - `TIMEOUT_IA_MS` morreu porque o teto de tempo agora é do provider
 *   (`src/ai/vertex.provider.ts` tem dispatcher próprio) e do cliente
 *   (`timeoutMs` do SDK). Dois tetos no mesmo caminho só criam a dúvida de
 *   qual dos dois cortou.
 * - `TETO_CUSTO_SESSAO_CENTS` virou teto em TOKENS (abaixo). Centavo depende de
 *   tabela de preço do vendor, que muda sem aviso e não é conhecida aqui;
 *   token é o que o provider realmente devolve.
 */

/**
 * Teto de tokens de SAÍDA do Cientista, por chamada.
 *
 * Não é o que dá FORMA à resposta — quem faz isso é a guarda de 450 caracteres
 * com retry (`agente/tamanho.ts`). Isto é o batente contra a geração que não
 * para.
 *
 * MEDIDO no projeto de origem, não chutado. Com 600 aqui, quase todo turno era
 * rejeitado por MAX_TOKENS e só passava na segunda ou terceira tentativa — 15 a
 * 28 segundos por resposta e o dobro do custo. O motivo estava no log: o
 * RACIOCÍNIO do modelo conta dentro deste teto e gastava de 300 a 572 tokens,
 * enquanto a fala que chega ao estudante usa de 17 a 76. Quem estourava era o
 * pensamento, não a resposta. Com 1600 ainda cortava (raciocínio já observado
 * em 1.275). Apertar isto de novo sem olhar o log é repetir o erro.
 */
export const TETO_TOKENS_RESPOSTA = 3000;

/**
 * TETO DE CUSTO POR SESSÃO — o controle real de gasto desta experiência.
 *
 * A quota diária do `QuotaService` é fusível da plataforma inteira: ela protege
 * contra abuso, mas é por usuário/dia e não sabe que UMA partida desta missão
 * custa duas ordens de grandeza mais que um turno de tutor. O teto que importa
 * aqui é por sessão, porque é a sessão que tem começo e fim.
 *
 * MEDIDO com `gemini-3.6-flash` no endpoint `global`, em 2026-08-27:
 *
 *   - turno completo: 7.5k a 8k tokens (média de 7.711 em três turnos seguidos);
 *   - o que domina NÃO é o tamanho do contexto, é o NÚMERO DE VOLTAS de
 *     ferramenta: cada volta reenvia o histórico inteiro. Um turno de 2 voltas
 *     custou 11.481; o mesmo turno com 4 fontes já carregadas e histórico de
 *     6 falas, mas 1 volta, custou 8.463 — MENOS, com mais contexto;
 *   - latência de 3,6 a 9,7 segundos por turno.
 *
 * Daí o teto: uma partida completa (~10 turnos, dos quais só 3 podem ser
 * pergunta) fica na ordem de 77k. 150k é o dobro disso — cabe a partida inteira
 * com folga e ainda corta antes de o custo virar problema.
 */
export const TETO_TOKENS_SESSAO = 150_000;

/**
 * Teto de CHAMADAS por sessão. Existe junto com o de tokens porque os dois
 * pegam falhas diferentes: token pega a conversa longa; chamada pega o laço
 * (estudante — ou script — mandando mensagem sem parar), que estouraria a fila de
 * requisições muito antes de estourar o token.
 *
 * Ao custo medido (7,7k por turno), o teto de TOKENS morde primeiro, por volta
 * do 19º turno. Este aqui é a rede contra o laço, e não o controle de custo.
 */
export const TETO_CHAMADAS_SESSAO = 24;
