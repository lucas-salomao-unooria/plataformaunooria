# apps/hub/app/(plataforma)/unooria/custos-de-ia — o FinOps da Unooria (ADR-161)

Complementa o `AGENTS.md` de `unooria/`, que vence em conflito. A doutrina da
MEDIÇÃO (quem registra, o que conta, por que o custo não é gravado) está em
`docs/regras/custos-de-ia.md`; aqui fica só o que é da tela.

`/unooria/custos-de-ia`, só `admin`: o painel (`painel-de-custos.tsx`) e a tabela
de preços (`tabela-de-precos.tsx`), juntos em `tela-de-custos.tsx` porque um
preço gravado embaixo muda o custo em cima — o painel relê o MESMO período
(`recalculos`) em vez de deixar a conta velha ao lado da tabela nova. Lido de
`GET /recursos/custos-de-ia` e `/precos`, gravado por `POST .../precos`, pelo
BFF (prefixo `recursos`, já liberado).

- **O valor principal é em REAL**, convertido pela api dia a dia. Sem cotação
  nenhuma a tela cai para o dólar e DIZ por quê — nunca um "R$ 0,00" que leria
  como "não custou nada". BCB fora do ar agora é aviso, não erro.
- **Erro ao trocar de período NÃO esvazia o painel** (o mesmo cuidado da
  Prospecção): o anterior fica, com o aviso.
- **O DIA (`YYYY-MM-DD`) vai ao formatador do SDK como meio-dia UTC.** Meia-noite
  UTC é o dia anterior em Brasília, e a tela mostraria o dia 8 para o uso do dia 9.
- **"≈" marca a voz**: a síntese não devolve tokens e a api estima. Não tire o
  sinal para a tabela "ficar limpa" — ele é a diferença entre medida e estimativa.
- **A tabela de preços não tem editar nem apagar**, de propósito: é o histórico.
  "Novo preço" abre a janela já com o modelo e o componente da linha; a data
  vem preenchida com hoje.

## Lacuna do DS, com compensação marcada (0.2.19)

`LineChart` e `BarChart` desenham numa escala CRAVADA em 0–100 (`val / 100`; o
`BarChart` usa 100 como piso do máximo) e o eixo vertical é só texto. Custo em
reais vive em centavos: a curva saía rente ao chão com o eixo dizendo 0 a 100.
A compensação (`tetoRedondo`, em `painel-de-custos.tsx`) manda a série em % de um
teto redondo, põe os valores reais em `yAxisLabels` e DESLIGA o tooltip, que
mostraria o percentual; os rótulos de data vão espaçados (~10), porque com 30 ou
365 eles se atropelam. O `SemiDonutChart` escreve o número cru ("0.1", com
ponto), então recebe % inteiro do custo. **Pedido ao `storybook-unooria`**:
escala pelo dado (ou `maxValue`) e formatador do valor no tooltip e na legenda.
Quando sair, a compensação morre.

Suíte: `node scripts/e2e/rodar.mjs admin/05` — leia o consumo que a stack já
tem; rode antes uma suíte que chame IA (`professor/03`) para a tabela não sair
vazia.
