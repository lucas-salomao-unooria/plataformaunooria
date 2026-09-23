/**
 * **Planejamento de Ensino** — a ferramenta de planejamento dirigida pela BNCC.
 *
 * A experiência `app-92-plano-de-ensino` (Vite, estática, pública ao professor),
 * embedada em `/professor/plano-de-ensino` com a MESMA sessão e o MESMO token
 * da plataforma. O lado server é `apps/api/src/planejamento`, e o currículo
 * extraído da BNCC vive em `apps/api/src/curriculo`.
 *
 * COEXISTE com o Gerador de Plano de Aula (app-90), e a diferença não é de
 * versão: são ferramentas para redes diferentes. A app-90 gera um plano anual a
 * partir do CURRÍCULO DA REDE importado como texto — serve a quem já tem
 * documento curricular próprio e material didático adotado. A app-92 parte da
 * BNCC estruturada, cobre todos os componentes do 1º ano do EF à 3ª série do EM,
 * e desce até o plano de aula da semana. Quem tem currículo próprio continua na
 * app-90; quem não tem, ou quer o planejamento aula a aula, usa esta.
 *
 * Só aparece em superfícies do professor. O aparelho do estudante nunca menciona
 * "aula" nem "plano" (regra de ouro 1), e `/exp/app-92-...` responde 404.
 */
export const EXP_PLANO_DE_ENSINO = "app-92-plano-de-ensino";
export const ROTA_PLANO_DE_ENSINO = "/professor/plano-de-ensino";
