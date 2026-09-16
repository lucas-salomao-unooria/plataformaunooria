# apps/api/src/portabilidade — perfil portátil

Complementa o `AGENTS.md` de `apps/api`, que vence em conflito.

## Perfil portátil: sair da REDE (2026-08-28)

**Transferir é dentro do contrato; o perfil portátil é para FORA dele.** A
criança que vai da rede estadual para a municipal sai da instalação — outro
contrato, outro banco, nenhum JOIN — e **não há garantia de que o destino comprou
o produto**. Por isso a saída é um DOCUMENTO ASSINADO, não uma integração
(ADR-35): `{ perfil, assinatura }` em JSON, emitido a pedido do titular (LGPD
art. 18, V) e importado como ato da escola de destino. Numa rede que nunca vai
instalar a plataforma, o mesmo arquivo continua legível.

- **O hub assina; a api verifica.** A chave é a MESMA dos tokens de experiência
  (`lib/chave-token.ts`, JWKS em `/.well-known/jwks.json`) — nenhum material novo
  entrou —, e `aud: "perfil-portatil"` separa os dois usos. Verificar é na api
  porque é o passo que **não pode confiar em quem chama**.
- **A assinatura cobre o HASH CANÔNICO**, não o documento como payload: o arquivo
  vai para a FAMÍLIA e precisa ser legível. `jsonCanonico` (chaves ordenadas
  recursivamente) existe nos DOIS lados — `apps/api/src/portabilidade/regras.ts` e
  `apps/hub/lib/perfil-portatil.ts` —, e a duplicação é deliberada: emissor e
  verificador são instalações diferentes, em versões possivelmente diferentes. Um
  **fixture de hash** afirmado nos dois testes derruba um deles se as
  implementações divergirem.
- **Assinatura inválida é RECUSA; emissor inalcançável é rótulo.** A classificação
  é pelo `code` da jose, NUNCA pelo texto: "signature verification failed" contém
  "failed", e uma versão anterior classificava documento FORJADO como "não deu
  para conferir".
- **`PORTABILIDADE_EMISSORES` é a decisão de confiança**, não o esquema da URL: o
  `emissor.hub` vem de dentro do arquivo, então o documento **seleciona** entre
  origens que o operador escreveu e nunca introduz uma (sem isso, SSRF). Vazia =
  tudo entra `nao-verificada`, e a tela sai em âmbar.
  Cada entrada é `origem` ou **`origem=urlDoJwks`** — a segunda forma pelo mesmo
  motivo do `EXP_INTERNAL_HOST`: o `emissor.hub` é o endereço do NAVEGADOR, e de
  dentro do container da api `localhost:3000` é a própria api. É o default do
  `docker-compose.dev.yml`
  (`http://localhost:3000=http://hub:3000/.well-known/jwks.json`), e é o que faz o
  caminho criptográfico ser exercível em dev — sem ele o smoke registrava o
  caminho degradado como se fosse o normal. **JWKS por http só FORA de produção**,
  com aviso no log; em produção, https ou nada.
- **O que vem de fora NUNCA se mistura**: vive só em `perfis_portateis`, não vira
  matrícula, progresso nem perfil da Vila, e não entra em média. É a afirmação de
  outra instalação, possivelmente de outra `VERSAO_MAPEAMENTO`.
- **Importar não cria estudante**: liga pelo CPF a quem já está aqui. Matricular é ato
  da escola (planilha ou OneRoster); o perfil se anexa depois.
- **`perfis_portateis.documento` é a ÚNICA exceção à contenção do CPF** (ADR-33):
  o número é o conteúdo do documento, e alterá-lo destruiria a assinatura. A
  exceção está numa lista explícita em `tests/identidade-unica.spec.ts`, que varre
  todo JSONB do schema procurando os CPFs QUE EXISTEM — não "onze dígitos", que
  casa com qualquer `Date.now()`.
- **Bem-estar (exp-91) nunca entra no documento**: dado de saúde, posse do
  professor, sem rota de gestor em lugar nenhum. Documento que o gestor emite não
  carrega o que nem o gestor lê.
- Envs: `CONTRATO_ID` + `CONTRATO_NOME` no hub (sem o primeiro, a emissão é 503);
  `PORTABILIDADE_EMISSORES` na api. Tela: `/admin/turmas/:id` → "Perfil portátil".
