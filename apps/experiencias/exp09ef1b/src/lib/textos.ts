/**
 * Só o que a TELA escreve sem vir da api. A copy da missão (as falas, os
 * rótulos do clone, Amara, os critérios e os blocos) vem da api em
 * `sessao.textos` — corrigir uma palavra não pode exigir republicar um caminho
 * imutável no bucket. Em pt-BR (ADR-91). `[PROTÓTIPO]` = está no HTML aprovado
 * e não na copy 06.
 */
export const TEXTOS = {
  erroDeAbertura: "Não deu para abrir a sessão do conselho agora. Tente de novo em instantes.",
  esperaDoPacote: "Aguarde a abertura da sessão deliberativa pela presidência da mesa.",
  enviar: "Enviar",
  /** [PROTÓTIPO] o rótulo dos chips. */
  anexos: "Anexos indexados:",
  /** [PROTÓTIPO] E3-ALU-01 "projeto marcado". */
  reorganize: "Reorganize a ordem dos critérios para habilitar a trava:",
  confirmarOrdem: "Confirmar esta ordem",
  ordemConfirmada: "Ordem confirmada",
  /** O nome do "digitando" para o leitor de tela, quando a tela não recebe o da api. */
  digitando: "Assistente digitando",
  ocrTitulo: "Reconhecimento Óptico de Caracteres (OCR)",
  ocrEstagio1: "Estágio 1 de 2: leitura óptica de caligrafia em papel de campo.",
  ocrEstagio2: "Estágio 2 de 2: validação de 180 assinaturas diárias.",
  /** [PROTÓTIPO] E4-ALU-02 "contrafactual A1". */
  contrafactualTitulo: "Simulação Contrafactual",
  revisaoTitulo: "Revisão de Parecer — Segundo Voto",
  documentoCongelado: "Documento histórico congelado",
  votoAnterior: (projeto: string) => `Voto: ${projeto}`,
  prioridade1: (criterio: string) => `Prioridade 1: ${criterio}`,
  selecioneFinal: "Selecione o projeto final:",
  homologada: "Decisão Final Registrada nos Autos",
  homologadaProjeto: (projeto: string, criterio: string) => `Projeto Homologado: ${projeto} (R$ 12.000). Critério 1: ${criterio}.`,
  conceitosTitulo: "Conceitos Estruturantes",
  ancoraMarcada: "Âncora marcada",
  marcarAncora: "Marcar no histórico",
  bancoDeRegras: "Banco de regras",
  esteira: "Esteira de governança",
  enviada: "Diretrizes submetidas à comissão.",
  autosEncerrados: "Autos Oficiais Encerrados",
  autosProtegidos: "Todas as deliberações foram congeladas no servidor. O histórico encontra-se protegido contra novas alterações.",
  destinacaoFinal: (projeto: string) => `Destinação Orçamentária Final: ${projeto} (R$ 12.000)`,
  protocoloSubmetido: "Protocolo de Salvaguarda: submetido à comissão.",
  amara: "Amara",
  amaraPapel: "9º ano",
  emEspera: "Aguarde as instruções do professor e o debate presencial da plenária.",
} as const;
