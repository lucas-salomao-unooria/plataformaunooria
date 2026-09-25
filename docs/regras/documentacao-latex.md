---
paths:
  - "documentacao-latex/**/*.tex"
---

# Documentação técnica (`documentacao-latex/`) — ATUALIZAR SEMPRE

Regra transversal da plataforma. Complementa o `AGENTS.md` da raiz, que vence
em conflito.

## Documentação técnica (`documentacao-latex/`) — ATUALIZAR SEMPRE

A documentação técnica consolidada do projeto é **LaTeX versionado**, em
`documentacao-latex/`, e compila em `main.pdf` (~612 páginas, `PU-DOC-001`).
Ela é a fonte única de: contexto de negócio, requisitos rastreáveis (RF/RNF),
casos de uso, **arquitetura de software nos 4 níveis do C4**, **arquitetura de
nuvem e implantação em GCP**, multi-tenancy e segurança, modelo de dados,
contratos de integração, telemetria, camada de IA, catálogo de experiências,
especificação da API, design system, entrega, qualidade, **observabilidade**,
**111 ADRs**, riscos e evolução. Todos os diagramas são TikZ vetorial, com fonte Mermaid equivalente no
Apêndice A.

**REGRA: toda implementação nova atualiza esta documentação NO MESMO COMMIT, e
regera o PDF.** Documento que ninguém atualiza é pior que documento nenhum —
é a mesma armadilha do `expires_at` que saiu do schema e do
`turmas.consentimento_em` do app de origem: a regra sai do código, o registro
fica, e quem lê acredita nele.

```bash
cd documentacao-latex && ./compilar.sh      # tectonic; --rapido p/ iterar, --limpar p/ limpar
```

| Se você mudou… | Atualize |
|---|---|
| Módulo, componente, fronteira | `secoes/05-arquitetura-software.tex` (+ o C4 correspondente) |
| Recurso de nuvem, rede, CI/CD | `secoes/06-arquitetura-nuvem.tex`, `secoes/15-entrega.tex` |
| RLS, papel, guard, sandbox do iframe | `secoes/07-tenancy-seguranca.tex` |
| Migração, tabela, coluna | `secoes/08-modelo-de-dados.tex` + `apendices/e-dicionario-de-dados.tex` |
| Bridge, telemetria, manifesto, provider de IA | `secoes/09-contratos-integracao.tex` + `apendices/d-payloads.tex` |
| Rota nova, ou papel de uma rota | `secoes/13-api.tex` + `apendices/c-endpoints.tex` |
| Variável de ambiente | `apendices/b-variaveis-ambiente.tex` |
| Experiência nova | `secoes/12-experiencias.tex` (e o catálogo do cap. 12) |
| Regra de interface / lacuna do DS | `secoes/14-design-system.tex` |
| **Qualquer decisão com alternativa descartada** | `secoes/18-adr.tex` — **ADR nova, numerada** (contexto, decisão, alternativas, consequências ruins incluídas, gatilho de reavaliação) |
| Risco novo, mitigado ou reclassificado | `secoes/19-riscos-evolucao.tex` |
| Sinal operacional novo (log, métrica, alerta, SLO, sonda, erro de cliente) | `secoes/17-observabilidade.tex` — e `docs/INFRA.md` se virar recurso do Terraform |
| Sintoma de diagnóstico novo (o sintoma que não aponta para a causa) | `apendices/f-operacao.tex` |
| Diagrama TikZ novo | **também** a fonte Mermaid equivalente em `apendices/a-mermaid.tex` |

Convenções de edição (as que já custaram tempo) em `documentacao-latex/README.md`.
As três que mais pegam: dentro de `tikzpicture` use `\texttt{}` cru (as macros
`\cd`/`\arq` ficam invisíveis em nó de fundo escuro); setas são `\seta` e
`\implica`, nunca `→`/`⇒` literais (a Roboto não tem esses glifos e o XeTeX
não desenha nada); e ER grande vai em **duas figuras retrato**, não em landscape.
