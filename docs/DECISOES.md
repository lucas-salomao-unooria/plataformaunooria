# ADRs (resumo das decisões e porquês)

1. **Experiências como bundles estáticos, não serviços** — CDN absorve pico,
   custo ~zero, rollback por versão de path. Estático = entrega do código;
   interação/coleta contínua acontece via API.
2. **Monorepo único (pnpm + Turborepo)** — SDK consumida por 48 apps; mudança
   na SDK testa tudo no mesmo PR; CI builda só o que mudou. Repos separados só
   se houver estúdio externo produzindo experiência.
3. **Auth via OIDC genérico (WSO2 IS)** — WSO2 é exigência do cliente/estratégia
   multi-contrato. App não conhece WSO2: conhece OIDC. Troca de IdP = config.
4. **1 stack por contrato; escolas por RLS** — isolamento contratual forte sem
   virar operador de 100 infra-escolas. Terraform module `contrato` replica.
5. **Cloud SQL HA (não AlloyDB)** — robustez vem de HA+PITR+pooler, não do
   AlloyDB; ambos Postgres, migração futura trivial se precisar.
6. **Pub/Sub para telemetria desde o início** — 4k simultâneos × evento/10s
   sufocaria o transacional. Resto da app fala Postgres direto.
7. **IA atrás de gateway na própria api** — chave e prompt de sistema no server,
   quota/dia por aluno, cache, provider plugável (Vertex default). Pré-gerar em
   lote sempre que a pedagogia permitir.
8. **JWT curto + memória no iframe** — roubo mitigado por HTTPS, expiração 1h,
   escopo mínimo, rate limit; validação de nota é server-side de qualquer forma.
9. **Gabarito e estado de missão server-side, por experiência** (exp-02
   UnooTube, 2026-08-24) — `factual` (a resposta) nunca vai ao bundle; a api
   corrige e devolve inscritos/fontes (regra 3). Não há módulo genérico de
   avaliação: cada experiência com lógica de domínio ganha um módulo próprio
   (`apps/api/src/<slug>/`), como `motor/` para a exp-01. Decisões da missão:
   ranking com colegas FICTÍCIOS (distribuição desenhada para a lição; sem
   pontuação de menores reais — LGPD), URLs das fontes como TEXTO (sandbox do
   iframe bloqueia popups; aluno não sai da plataforma), salvos CONGELADOS após
   "adicionar credibilidade" (o score já foi reportado — nota e estado não
   divergem; reiniciar descongela), aluno roteado pela SÉRIE
   (`4EF → exp-02-unootube`, mapa estático até o manifesto ser a fonte).
10. **Check-in de bem-estar do professor: DASS-21 fixo, IA só no entorno,
   dado que só o professor lê** (exp-91, 2026-08-25). O instrumento entra
   verbatim (versão brasileira de Vignola & Tucci 2014) em microdoses de 3
   itens/dia — engajamento vem de custar < 1 min, não de reescrever perguntas.
   A IA gera abertura, pergunta aberta e acolhimento, atrás de guardrails
   (`regras.validarTextoDaIa`) com fallback fixo, e nunca vê pontuação, nome ou
   escola. Correção server-side ao 7º check-in. Item sentinela (17/21 ≥ 2) ou
   termo de risco ⇒ mensagem fixa de apoio (CVV 188) sem IA. Por ser dado de
   saúde (LGPD art. 11), **não há visão de gestor nem agregado por escola**:
   RLS + posse por professor, e o próprio professor apaga tudo
   (`DELETE /bemestar/dados`). Uma visão agregada/anonimizada para a rede é
   decisão futura, com DPA e k-anonimato — não sai de um `GROUP BY`.
11. **Uma conta por PESSOA; enturmamento em `matriculas`; OneRoster só na
   fronteira** (2026-08-28). As experiências vieram de projetos com cadastro
   próprio por atividade. A unificação técnica já existia (todas recebem
   `aluno.id` pelo `hub:init`), mas a conta era de **assento** — está escrito no
   schema: `exp_01_runs.nome_no_app` existe "porque a conta é do APARELHO: outra
   turma reusa o mesmo login" — e o nome real da criança vivia dentro de uma
   experiência só. Entram `periodos_letivos` (≈ `academicSessions`) e
   `matriculas` (≈ `enrollments`), mais `matricula_externa` (o RA da rede) como
   chave de reconciliação. O padrão OneRoster 1.2 vive só em
   `apps/api/src/rostering/`, como o vendor de IA vive em `src/ai`: nada do
   domínio conhece `sourcedId`, e o `hub:init` não muda.
   Três consequências: (a) `users.turma_id` sobrevive como **cache** da matrícula
   principal, porque o login e o claim `turma_id` o leem antes de haver escola no
   contexto; (b) "as turmas do professor" passam a ser as turmas em que ele tem
   matrícula — antes, qualquer professor abria bem-estar e Vila de qualquer turma
   da escola, porque a única prova era "mesma escola"; (c) `matriculas` tem RLS, e
   query fora de `comTenancy` volta **vazia sem erro**.
   Descartados: modelo próprio (chegaria na mesma tabela), LTI/NRPS (responde
   "quem chegou agora", não provisiona antes da aula), Ed-Fi (escopo de data
   warehouse), esperar o EducaDados do MEC (Portaria 269/2026 — padrão nacional
   criado, especificação técnica ainda não publicada; adotar o *modelo* agora e
   manter o *formato* atrás de adaptadores serve aos dois futuros), e o
   `demographics` do OneRoster (raça/etnia do censo dos EUA — dado sensível que a
   plataforma não usa).
12. **Senha provisória com troca obrigatória** (2026-08-28). A planilha não tem
   coluna de senha: arquivo com senha em texto claro circula por e-mail e pen
   drive. A senha inicial é escolhida na tela de importação (uma para o lote, ou
   uma por pessoa — recomendada para alunos), marca `senha_provisoria` e o
   primeiro acesso cai em `/trocar-senha` sem saída. A trava é **tripla**:
   middleware, BFF e `/api/exp-token` — só com o middleware, bastaria digitar
   `/exp/...` para pular. Ao trocar, a sessão é **refeita** com a senha nova em
   vez de remendada: o cookie antigo ainda diz "precisa trocar", e sem refazê-lo
   a pessoa voltaria à mesma tela com a senha anterior já inválida.
   Consequência ruim, aceita e dita na própria tela: com uma senha só para o
   lote, qualquer aluno entra na conta de outro até o primeiro acesso dele.
13. **A rede: lotação por escola, escola ativa no token, e o dado que fica**
   (2026-08-28). Vender a uma rede estadual exigia três coisas que
   `users.escola_id` único não dava: identificar milhares de escolas, professor em
   mais de uma, e criança transferida sem perder o histórico. A decisão que torna
   isso barato é o que **não** muda: o token continua carregando UMA escola —
   medido, são 31 tabelas com `escola_id` e 19 arquivos que derivam a escola do
   token, e nenhum foi tocado. Entra a camada acima: `lotacoes` (pessoa × escola,
   datado; professor ACUMULA, aluno tem uma ativa garantida por índice único
   parcial) e a escola ativa como estado de SESSÃO, validada contra as lotações
   pela api e nunca contra a lista do cookie. Descartados: token com conjunto de
   escolas e RLS em `= ANY` (tocaria as 31 tabelas e trocaria "esta conexão vê UMA
   escola" por "vê um conjunto", que é justamente a propriedade que sustenta o
   isolamento de um contrato B2G); e dois cadastros para o mesmo professor, que é
   o que acontece hoje sem isso — duas senhas e nada ligando as metades.
   Na transferência o **dado fica onde foi produzido** e o que segue o aluno é a
   identidade; a leitura atravessada é uma porta só (`GET /alunos/:id/historico`),
   restrita a quem tem lotação na escola onde ele está hoje, devolvendo
   participações e nunca o conteúdo dos instrumentos. Reescrever `escola_id` nas 31
   tabelas foi descartado: apaga de onde o fato veio.
14. **CPF como identidade, guardado só em hash** (2026-08-28). Nome, login e
   matrícula mudam; o CPF não — e é o que o padrão nacional do MEC adota. É também
   o dado mais sensível que a plataforma tocaria, de menores, num banco que já
   guarda perfil de valores e check-in de saúde. Então: `users.cpf_hash =
   HMAC-SHA256(cpf, CPF_PEPPER)` e os três últimos dígitos em claro para
   confirmação humana. O hash é **determinístico** de propósito (sem isso não há
   busca nem reconhecimento, que é a única razão de o CPF estar aqui); a pimenta é
   o que o torna inútil fora desta instalação (11 dígitos são força-brutáveis em
   minutos num SHA-256 puro). Sem `CPF_PEPPER` a coluna é **recusada**, nunca
   aceita e guardada de outro jeito. A pimenta **não muda**: outro valor invalida
   todos os hashes e toda criança transferida vira cadastro novo. Descartados:
   guardar em claro (dá o mesmo e mais um acervo de CPF de menores que a
   plataforma não usa para nada), sal por linha (mata a identidade), e cifrar (
   exigiria guardar a chave capaz de devolver o número, que é o que não se quer
   poder devolver).
15. **O CPF é guardado, e o gestor o vê** (2026-08-28, revisa a 14). A decisão 14
   guardava só `HMAC-SHA256(cpf, pimenta)` e três dígitos: dava as duas coisas que
   a PLATAFORMA precisa do CPF — unicidade na rede e reconhecer a mesma criança
   numa transferência — e ignorava a que o GESTOR precisa: **ver o número**. Ele
   confere identidade contra o sistema da rede, preenche documento e atende a
   família no balcão. Hash é de mão única: nenhuma chave o destrava, porque não
   existe chave. E CPF é dado pessoal **comum**, não do art. 11 (saúde, raça,
   religião, biometria), com base legal clara num contrato de educação pública —
   é o que todo sistema de gestão escolar brasileiro guarda.
   Agora: `users.cpf`, 11 dígitos sem pontuação (CHECK), único por contrato,
   exibido formatado e buscável com ou sem pontuação na lista do gestor, e
   corrigível na edição (o balcão erra). O que sustenta a decisão não é a coluna, é
   a **contenção**: uma coluna só, nunca em log, telemetria, JSONB, claim de token
   ou bundle — com teste estrutural cobrando pelos dois lados (nome de coluna e
   formato dentro de JSONB). `CPF_PEPPER` deixou de existir.
   Lição de processo: eu decidi por segurança sem perguntar quem usa o dado. O
   requisito de exibição não estava escrito, e uma escolha irreversível não devia
   ter sido tomada sem ele.
