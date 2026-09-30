# Ferramentas externas que o agente NÃO dispara

Regra transversal da plataforma. Complementa o `AGENTS.md` da raiz, que vence
em conflito.

## Ferramentas externas que o agente NÃO dispara

**Varredura de vulnerabilidade (Snyk) é da esteira de CI/CD, não da sessão.** Não
rode `snyk` nem as ferramentas do MCP do Snyk — nem para "conferir", nem depois de
mexer em dependência. O lugar da varredura é a esteira, com o `SNYK_TOKEN` do
repositório e a política com prazo dos `.snyk` (ADR-39). Varredura na sessão
gasta cota do plano, produz apontamento sem o portão que o cumpre, responde por
uma working tree local que não é o que vai a produção, e recicla falso positivo
já analisado — o "code injection" do `setInterval` da bridge tem comentário no
código, entrada no `.snyk` e ADR. Precisou de uma avulsa? Quem roda é a pessoa,
na mão.

Estado do portão hoje: o passo `Snyk` do `ci.yml` está **comentado**. Reativá-lo é decisão de quem cuida do CI — não é trabalho que você
começa por conta própria, e não muda nada do parágrafo acima.

As regras estão em `.claude/settings.json` (versionado) e no `settings.json` do
usuário; o MCP continua instalado, para uso manual.
