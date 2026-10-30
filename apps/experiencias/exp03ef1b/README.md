# exp03ef1b — Nina e a Notícia que Desapareceu

Missão do 3º ano EF, unidade 1 (Entre Redes, ADR-197), no jornal Unoojornal.
A feira de livros saiu em três suportes (mural, portal, telão); as três fotos
mostram o pátio, mas a ficha do telão tem o campo Onde vazio, e a busca
"Onde: Pátio" o deixa de fora. A dupla escolhe o que a busca vai trazer, busca,
descobre a omissão, inspeciona a ficha, carimba, repara, automatiza a conferência
com uma rotina e aplica tudo num caso novo. Duas liberações e a pausa são da
professora (painel no hub). Desktop 1024×768.

## Rodar

```bash
pnpm --filter @edu/exp03ef1b dev        # :5189 (strictPort)
# no hub: /exp/exp03ef1b  (ou /dev-embed?src=http://localhost:5189)
# vitrine, sem api: pnpm exec vite --port 5244 → /vitrine.html
```

Precisa da missão LIBERADA na turma (ADR-69), do produto `entre-redes` ligado
(ADR-87) e de uma atividade preparada pela professora (banco padrão ou IA).

## Telemetria (`lib/telemetria.ts`)

| Verbo | Objeto | Quando | `resultado` / `contexto` |
|---|---|---|---|
| `progressed` | `missao:entrada` / `missao:passo` | abertura / cada passo | `contexto: { passo }` |
| `interacted` | `galeria:foto`, `galeria:selo`, `galeria:pulso`, `galeria:erro-midia` | E1 | `suporte` / `selos` |
| `attempted` | `escolha:travar` | o latch da E2 | `resultado: { itens }` |
| `attempted` | `filtro:buscar` | cada busca | `resultado: { encontradas }`, `contexto: { campo }` |
| `progressed` | `omissao:confrontar` | "Confrontar e Aguardar Turma" | — |
| `interacted` | `ficha:abrir` | "Inspecionar Ficha" | `contexto: { dica }` |
| `attempted` | `carimbos:enviar` | Avançar da E4 e da E6 | `contexto: { etapa }` — sem os carimbos |
| `attempted` | `reparo:concluir` | Concluir | `resultado: { desfecho }` (o que a tela já mostra) |
| `attempted` | `rotina:testar` | Testar Rotina | `resultado: { valida }` |
| `interacted` | `caso:ferramenta` | E6 | `contexto: { ferramenta }` |
| `completed` | `missao:concluida` | `POST concluir` | — |
| `interacted` | `conexao:aviso` | sem sinal / sessão | `contexto: { motivo }` |

Nada de nome, e-mail, carimbo escolhido, posição de etiqueta ou ordem de blocos.
A evidência (E14) é gravada pela api nas rotas; `sdk.concluir()` leva só
`testesDaRotina` e `reparoValido`.

## Copy ESCRITA AQUI (para o PO revisar)

Marcadas em `src/lib/textos.ts`: a fala da E2, o apoio da ponte, as linhas do
vidro da escolha ("Sua escolha: N notícias na caixa." / "Espere a professora
liberar o filtro."), as ajudas de toque (E2, E4-03, E5), "0 notícias
encontradas" + apoio, o resumo das quatro colunas do Painel, a fala da pausa
("A professora pausou a turma. Espere ela retomar."), o aviso de sessão e a
porta fechada (403).

## Testes

- `versao.test.ts` — versão em três lugares e o manifesto no vocabulário.
- `lib/espelho.test.ts` — listas, tempos e campos contra `apps/api/src/nina-noticia`.
- `lib/api.test.ts` — o cliente HTTP contra o contrato (método, caminho, corpo) e a classificação de falhas.
- `lib/regras.test.ts` — caixa, ficha montada, esteira, simulação, tela segurada, portão.
- `lib/textos.test.ts` — falas literais da Nina, nada em inglês, nada diz "aposta", nenhum gabarito.
- `separacao.test.ts` — `jornal/` só `ds-unoojornal`, `mecanica/` só `ds`.
