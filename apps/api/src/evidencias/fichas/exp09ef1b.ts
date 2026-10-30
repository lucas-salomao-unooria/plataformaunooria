import type { FichaPedagogica } from "./tipos";

/**
 * A FICHA de O DOSSIÊ INVISÍVEL (exp09ef1b, 9º ano do EF, unidade 1) —
 * versão 1, de 2026-10-29 (ADR-202): 100% Canal A, sem perguntas (o Canal B
 * e o "motivo estruturado" do 2º voto saíram, decisão do Lucas). A régua é a
 * do one-pager v5 §12a com as correções do PO de 28 e 29/10 — o código está em
 * `dossie-invisivel/regras/evidencia.ts`:
 *
 *   - **EF09CO07** no "Enviar Proposta" do Editor de Protocolo (E5) — a
 *     Etapa 6 (Lia e Davi) não existe nesta versão e não mede nada;
 *   - **EF09CO08** no "Registrar Decisão" (quem investigou a lacuna já atinge)
 *     e no "Confirmar Decisão Final" (o conjunto: caminho, projeto e os dois
 *     rankings). A porta `marcar` guarda a melhor.
 *
 * Quem não chega ao gesto fica "Não avaliado". A atividade é o PACOTE; a
 * rodada, o "Zerar Turma".
 */
export const FICHA_EXP09EF1B: FichaPedagogica = {
  expId: "exp09ef1b",
  versao: 1,
  habilidades: [
    {
      codigo: "EF09CO07",
      marcadores: [{ id: "protocolo_assistente", tipo: "acao", rotulo: "Protocolo do assistente do conselho" }],
      criterios: {
        atingiu: "Posiciona os três blocos de salvaguarda nas verificações certas (auditar fontes, normalizar o impacto, sinalizar pendências) e descarta na lixeira o bloco que desclassifica projetos sem PDF.",
        em_processo: "Posiciona dois dos três blocos nas verificações certas, ou os três sem descartar o bloco danoso.",
        nao_atingiu: "Qualquer outra composição do protocolo.",
        observacao: 'Medida no "Enviar Proposta" (Etapa 5), que aceita qualquer composição com pelo menos um bloco: a régua é do servidor. Quem não envia fica "Não avaliado".',
      },
    },
    {
      codigo: "EF09CO08",
      marcadores: [{ id: "investigacao_e_revisao", tipo: "acao", rotulo: "Investigação da lacuna e revisão da decisão" }],
      criterios: {
        atingiu: "Investiga por conta própria a falta de registros do projeto em papel (caminho A1 ou A2), ou, no segundo voto, põe a urgência social acima da regularidade documental.",
        em_processo: "Não investigou a lacuna e, no segundo voto, troca de projeto ou reordena os critérios sem pôr a urgência social acima da regularidade documental.",
        nao_atingiu: "Não investigou a lacuna e mantém, no segundo voto, o mesmo projeto e o mesmo ranking de critérios.",
        observacao:
          'Medida no registro da escolha inicial (quem investigou) e na decisão final. A reordenação sem a urgência acima da regularidade entrou em "Em processo" por proposta da implementação (a régua do PO não cobria o caso). Quem não chega ao segundo voto sem ter investigado fica "Não avaliado".',
      },
    },
  ],
  perguntas: [],
};
