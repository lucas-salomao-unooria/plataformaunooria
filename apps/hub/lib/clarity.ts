/**
 * O id do projeto Clarity, para o hub e para as experiências.
 *
 * `NEXT_PUBLIC_*` é substituída pelo literal no momento do `next build`, então
 * a referência abaixo precisa ser ESTÁTICA — `process.env[nome]` com nome
 * calculado não é inlinada e o valor chegaria `undefined` no client, sem erro
 * nenhum. Por isso a constante existe num arquivo só e todo mundo importa daqui.
 *
 * **Ausente = Clarity desligado**, em toda superfície. É o kill-switch, e é o
 * que mantém a máquina de quem desenvolve e a suíte e2e fora do painel: nem o
 * `.env.example` nem o `docker-compose.dev.yml` definem um valor.
 *
 * Em produção ela entra por `--build-arg` no `apps/hub/Dockerfile` (o
 * `deploy.yml` a lê de `vars.CLARITY_PROJECT_ID`, por environment) — o valor
 * vai DENTRO da imagem, e é por isso que trocar o id exige rebuild.
 */
export const CLARITY_PROJECT_ID = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID ?? "";
