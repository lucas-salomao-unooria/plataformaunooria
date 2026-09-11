import type { ClausulaDeGovernanca, ContextoDaTurma } from "../catalogo";

/**
 * A COMPILAÇÃO DO MANIFESTO — no servidor, e a escolha tem consequência.
 *
 * O documento da Etapa 4 é o Aha! da missão: a máquina reescreve as próprias
 * diretrizes sob a cláusula que a criança fixou. Montá-lo no cliente seria
 * mais simples (o bundle já tem o título da cláusula), mas duas coisas
 * quebrariam:
 *
 * 1. **O texto do manifesto é conteúdo autoral revisado** pelo Comitê de Ética
 *    e IA Educacional, e o diagnóstico de auditoria é a síntese pedagógica da
 *    aula. Ele muda por revisão de copy, e mudar copy não pode exigir
 *    republicar um caminho imutável no bucket (a mesma razão do feed da exp-06).
 * 2. **O documento é a EVIDÊNCIA do percurso.** O que a professora lê no painel
 *    e o que o estudante copiou para a área de transferência têm de ser o mesmo
 *    texto. Compilado no cliente, seriam duas montagens que divergem na
 *    primeira correção de vírgula.
 *
 * Isto não é "correção server-side" no sentido da regra 3 — não há resposta
 * certa a corrigir aqui (as quatro cláusulas são válidas). É integridade do
 * artefato: o manifesto é o produto da missão, e produto se monta num lugar só.
 */

/** Markdown, porque a tela o exibe dentro do `CodeBlock` nativo do clone. */
export function compilarManifesto(
  contexto: ContextoDaTurma,
  clausula: ClausulaDeGovernanca,
): string {
  return `# MANIFESTO DE DIREITOS DIGITAIS DOS ESTUDANTES
**${contexto.escola} — Versão Homologada**

Nós, estudantes do 8º ano, após auditarmos as bases de dados e a arquitetura lógica do sistema EduPredict IA, promulgamos este documento público de salvaguardas algorítmicas:

### Diagnóstico de Auditoria
A inteligência artificial não opera de forma neutra. Sistemas preditivos alimentados por dados históricos reproduzem e amplificam desigualdades e julgamentos de quem produziu os registros. A matemática aplicada a pessoas exige limites éticos claros.

### Diretriz Soberana Aprovada
> **${clausula.tituloClausula}**
> ${clausula.artigoTexto}

### Princípios Gerais de Governança
1. **Explicabilidade:** Todo critério algorítmico deve ser compreensível para a comunidade escolar.
2. **Contestabilidade:** Nenhuma métrica gerada por computador é soberana sobre o direito de defesa.
3. **Privacidade e Dignidade:** A proteção integral do menor prevalece sobre qualquer meta de eficiência corporativa.

*Documento auditado e compilado via terminal de controle discente.*
`;
}

/**
 * O delay diegético da capitulação, em milissegundos.
 *
 * 2000ms EXATOS, e é não-negociável 2 da spec: é o tempo em que a máquina
 * "processa" a diretriz antes de render-se. Sem ele o manifesto aparece no
 * mesmo quadro do clique e a capitulação não é vivida — vira uma troca de
 * tela. O timer roda no CLIENTE (é ritmo de cena, não regra de negócio), e
 * mora aqui para que a experiência e a documentação leiam o mesmo número.
 */
export const DELAY_DA_GOVERNANCA_MS = 2000;
