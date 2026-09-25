# apps/api/src/openapi — OpenAPI derivado do Zod

Complementa o `AGENTS.md` de `apps/api`, que vence em conflito.

## Documentação da api: OpenAPI derivado do Zod (2026-08-28)

`/docs` (Swagger UI) e `/docs-json` na **api** — `localhost:3001/docs`, não 3000,
que é o hub. **Derivado dos schemas Zod que as rotas já usam para validar**
(ADR-36): a api não tem DTO de classe, e anotar `@ApiBody` à mão nas 146 rotas
criaria uma segunda descrição do contrato que nada obriga a concordar com a
primeira — a armadilha do `expires_at`.

- **`@Contrato({...})` só grava metadata.** Ele NÃO chama `@ApiOperation`/
  `@ApiResponse`, porque um decorator não enxerga o verbo da rota (o `@Get` pode
  ser aplicado depois dele) nem o `@Roles`. Quem monta a operação é
  `openapi/documento.ts`, percorrendo as rotas já registradas.
- **Papel vem do `@Roles` real**, nunca de campo repetido no `@Contrato`.
- O esqueleto de caminhos vem do roteador do Nest; o conteúdo, do `@Contrato`.
  As duas travessias têm de concordar, e divergir num caminho é erro na subida.
- **`.refine()` some da conversão, em silêncio** — JSON Schema não expressa
  função. O campo `notas` do `@Contrato` existe para essas restrições virarem
  texto: sem ele o documento mente por omissão.
- **Schema de resposta é CONFERIDO, não só publicado** (ADR-37): `.parse()`
  estrito nos testes, `safeParse` com aviso no log fora de produção
  (`ContratoInterceptor`), e **no-op em produção** — schema estrito demais não
  pode transformar rota que funciona em 500. O aviso carrega só caminho e código
  do problema, nunca o valor: a resposta desta api tem nome de criança e CPF.
- **Senha: `SWAGGER_USUARIO` + `SWAGGER_SENHA` (mín. 16).** Ausentes ⇒ a rota
  **não é montada** e o 404 é do roteador — não 401, que confirmaria o mapa.
  Meia credencial derruba a subida. Nos dois compose há default de DEV
  (`docs` / `unooria-docs-local`): sem ele o `/docs` só funcionaria para quem
  descobrisse que precisa exportar env, ou seja, para ninguém. Em produção as
  duas vêm do Secret Manager (`{contrato}-swagger-senha`).
- **A trava é `tests/openapi-cobertura.spec.ts`**: percorre o roteador e cobra
  `@Contrato` de toda rota, salvo as da lista `SEM_CONTRATO_AINDA`, **que só
  encolhe**. Cada commit cobre um módulo (`<modulo>/contrato-de-rotas.ts` — o
  nome `contrato.ts` já é o payload do jogo na app-70) e apaga as linhas dele,
  copiando a prosa daquele módulo do `c-endpoints.tex` para a `descricao`. Feito:
  `health`, `auth`, `experiencias`, `progresso`, `telemetry`, `ai`, `rostering`
  (escolas, turmas, matrículas, períodos, lotações, estudantes), `usuarios`,
  `planos` (+referências), `bemestar`, `vila`, `unootube`, `portabilidade`,
  `perfis`, `analise`, `unoogpt`, `atividades`, `geracao`,
  `motor` (runs/posts).
  **As 167 rotas estão cobertas, e a lista está VAZIA** — rota nova sem contrato
  fica vermelha.
- **`docs/openapi.json` é versionado** e o **apêndice C do LaTeX é GERADO dele**
  (`scripts/gerar-endpoints-tex.mjs`) — eram 547 linhas de prosa à mão que nada
  obrigava a concordar com o código. A coluna de autorização do apêndice vem das
  extensões `x-papeis`/`x-acesso` do documento, nunca de parsing da descrição:
  gerador que lê a própria prosa quebra em silêncio na primeira reescrita da
  frase. Mudou rota? Regere os dois e recompile o PDF.
