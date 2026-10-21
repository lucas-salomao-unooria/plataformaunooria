# apps/api/src/planos — plano de aula (app-90)

Complementa o `AGENTS.md` de `apps/api`, que vence em conflito.

## Plano de aula (app-90, `apps/api/src/planos`)
Ferramenta do professor: `POST /planos` (202) gera em background (claim atômico
em `app_90_planos`, `marked` roda na api), o cliente faz polling em `GET /planos/:id`.
Conteúdo em object storage PRIVADO (`{contrato}-planos`; `PLANOS_DRIVER=local`
em dev → `storage-privado/`): `gerado.md` imutável + `atual.html` do editor
(sanitizado com allowlist). Referências curriculares = texto no Postgres
(`app_90_referencias`, catálogo do contrato, sem RLS), importadas por
`scripts/importar-referencias-plano.mjs` com `PLANOS_IMPORT_TOKEN`.
O teto de saída é 64k tokens, não os 32k do app origem (que eram o limite do
Claude). Com o material real (currículo da rede + as 4 unidades do ano, ~190k
tokens só de prompt), 32k cortava o plano (medido no gemini-2.5-flash) e o
professor recebia "o plano ficou grande demais" sem plano nenhum; o modelo
atual de `modelo: "longo"` (`VERTEX_MODEL_LONGO`) não foi remedido.

## A estrutura do plano é uma só (ADR-123)

A estrutura que a IA entrega vem do `prompt-plano-de-aula.ts` e de mais nada.
O `template-plano.ts` é EXEMPLO de formato, tom e nível de detalhe, de outra
disciplina, e a mensagem que o serviço monta diz isso ao modelo. Com duas
definições, o modelo escolhia a quem obedecer e o plano mudava de forma de uma
geração para outra. Títulos e limites de itens moram em `estrutura-do-plano.ts`
(o prompt interpola os limites); `tests/planos-estrutura.spec.ts` confere
prompt, exemplo e mock contra ele.

- **Mudou uma seção ou um limite?** Muda em `estrutura-do-plano.ts`, no prompt e
  no exemplo, no mesmo commit. O teste reprova a divergência.
- **Habilidade no exemplo tem código e texto copiados da BNCC** (`curriculo/dados`),
  nunca de memória: o exemplo anterior trazia a EF04HI03 com o texto da EF04HI04,
  num prompt que proíbe inventar código. O teste confere uma a uma.
- **A avaliação do exemplo diz o que o estudante mostra**, ligada a uma
  habilidade do bimestre — não "participação" nem "produção de cartaz" sozinhos.
- **Sem banco para medir o modelo:** o teste garante o que está escrito, não
  como o Gemini o segue. Mexeu na estrutura? Gere um plano real antes de
  promover.
