# docs — contratos com o mundo fora deste repo

Complementa o `AGENTS.md` da raiz.

| Arquivo | O que é | Status |
|---|---|---|
| `INFRA.md` | **contrato** com o repo de Terraform: nomes de recursos, envs que a app consome, o que o CI publica | vivo — mudou a expectativa de infra, muda aqui |
| `INFRA-IDENTITY.md` | o mesmo, para o gerenciador central de identidade (WSO2 IS 7.3.0), que é único para vários contratos | vivo |
| `ARQUITETURA.md` | desenho de uma página da stack por contrato | **resumo** |
| `DECISOES.md` | resumo das decisões chave | **resumo** — o LaTeX tem 88 ADRs completas |
| `openapi.json` | gerado por `apps/api/scripts/gerar-openapi.ts` | **gerado** — nunca editar à mão |
| `agents/` | o que as skills de engenharia (plugin `mattpocock-skills`) precisam saber: onde estão as issues, os rótulos de triagem, e como ler a documentação de domínio deste repo | vivo — ver a seção `Agent skills` do `AGENTS.md` da raiz |
| `regras/` | a **doutrina transversal** da plataforma, uma regra por arquivo. É a FONTE: `.claude/rules/` e `.agents/rules/` são symlinks para cá (ADR-102) | vivo — **canônico** |

## A fonte das decisões é o LaTeX, não esta pasta

`DECISOES.md` traz o resumo das decisões históricas; `documentacao-latex/secoes/18-adr.tex` tem 88 ADRs completas, com
contexto, alternativas descartadas, consequências ruins e gatilho de
reavaliação. **Decisão nova vai para o LaTeX** (a Definition of Done exige ADR
numerada). Trazer só a linha para cá é opcional; escrever a decisão só aqui é
perdê-la — quem lê o PDF, que é o entregável do projeto, nunca vai encontrá-la.

## `INFRA.md` é contrato, e contrato quebra em silêncio

Este repo **não cria recurso GCP**. Quando a app passa a depender de um bucket,
de uma env ou de um nome de serviço que o Terraform ainda não provisiona, o
sintoma não aparece aqui: aparece no primeiro deploy da stack nova, como 401,
403 ou "certificado" — e o apêndice F (`f-operacao.tex`) existe porque três
desses sintomas já enganaram. Mudou a expectativa? `INFRA.md` no mesmo commit.
