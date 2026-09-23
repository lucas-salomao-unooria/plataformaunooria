# O Nome de Jogo nunca entra no log

A criança digita um Nome de Jogo no início (primeiro nome ou apelido, até 12 caracteres) para que a assinatura na Pedra dos Nomes seja dela de verdade e para que o Lume a chame pelo nome. Esse nome vive apenas na Camada 1, como variável de sessão, e **nunca** é escrito no `localStorage` nem em nenhum registro persistido.

O motivo é que o log é um perfil comportamental — pontuações Schwartz, incluindo Poder — e o produto vai persistir isso num banco. Nome junto de perfil transforma cada linha da tabela num laudo nominal de um menor de idade, sujeito ao Art. 14 da LGPD, com consentimento parental específico e destacado, e legível fora de contexto anos depois por alguém que não sabe que veio de um jogo de vinte minutos. Sem nome, a tabela nasce pseudonimizada e não há o que migrar nem apagar depois.

O Painel do Responsável não perde nada: ele vai para as mãos de quem já sabe de quem é a criança, e se identifica pela data e hora da partida.

## Consequências

- O painel não consegue distinguir partidas de crianças diferentes no mesmo aparelho. Hoje isso é agravado por o log usar chave fixa e sobrescrever a cada partida (decisão explícita: uma partida por vez). Mitigação: data e hora estampadas no topo do painel.
- Quando o banco existir, a chave é um `sessionId` opaco. Se um responsável quiser o retrato da própria criança, ele traz a chave da sessão dele.

---

## Adendo — 26/08/2026, o porte para a plataforma

**A decisão continua valendo. A premissa e o mecanismo mudaram inteiros**, e por isso este
adendo em vez de uma emenda invisível: o texto acima é registro do que se decidiu em agosto,
e ele descreve um produto que não existe mais.

**A criança não digita nada.** Não há campo de nome, nem validação, nem limite de 12
caracteres. A plataforma entrega ao jogo o **primeiro nome** dela
(`window.VILA.identidade.primeiroNome`), para o Lume chamá-la e para a assinatura na Pedra
ser dela de verdade.

**Não há `localStorage`.** As quarenta chaves por slot desapareceram; a partida é aberta e
fechada na api. O que substitui "nunca é escrito no localStorage" é mais forte: **nunca é
serializado** — `verificarSemNome()` bloqueia antes de entregar, e `semNomeDeCrianca()`
recusa com 422 do outro lado.

**A premissa caiu: a plataforma SABE quem é a criança.** `vila_sessoes.estudante_id` e
`vila_perfis.estudante_id` são FK para `users`, que tem `display_name`. A proteção já não vem da
ausência de identidade — vem de **não deixar o nome viajar junto do retrato**: as tabelas
`vila_*` guardam só o uuid, o `payload` JSONB não tem campo de nome, e a telemetria carrega
`estudante_id` opaco.

Isso torna a regra **mais** necessária, não menos: existe agora um nome em memória que não
existia no bundle de origem, e o `payload` não tem prazo para sair do banco.

**Consequências reescritas:**

- ~~O painel não consegue distinguir partidas de crianças diferentes no mesmo aparelho~~ —
  resolvido. Cada partida é uma linha própria em `vila_sessoes`, e o "JOGAR DE NOVO" abre
  partida **nova** (`window.VILA.reabrir()`). No app de origem o replay sobrescrevia a chave
  do `localStorage`.
- ~~Quando o banco existir, a chave é um `sessionId` opaco~~ — o banco existe. A chave é
  `vila_sessoes.id`, uuid **emitido pela api** na abertura; o cliente não escolhe mais a
  própria chave, o que resolveu de raiz a colisão entre duas crianças na mesma máquina.
- O leitor não é mais "o responsável": é o **professor**, escopado pelas próprias turmas, e o
  relatório abre pelo estudante, não pela data e hora.

O parágrafo sobre o Art. 14 da LGPD e sobre "legível fora de contexto anos depois" sobreviveu
intacto, e é a razão da decisão.
