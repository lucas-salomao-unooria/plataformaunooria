# Ato Opcional não pontua no Score

O Score da HUD existe apenas para motivar a criança a completar o Objetivo Principal (acender as 8 Fogueiras). Ajudar Aldeão, acender Lampião, ouvir história e tocar Sino deixam de dar pontos, e Aldeão/Lampião/História saem do contador da HUD: no instante em que uma escolha livre vale placar, a Camada 2 passa a medir quem persegue número em vez de quem se importa — e o instrumento inteiro depende de essas ações serem gratuitas.

No lugar do incentivo numérico entra o **Chamado**: o Aldeão chama quando a criança passa perto, o Lampião apagado escurece o entorno. O mundo pede, o placar não.

## Consequências

- Menos Atos Opcionais por partida. Aceito: o dado fica limpo.
- O Chamado passa a registrar **Oportunidade Percebida**, que é o que permite distinguir "não quis" de "não viu" — distinção que o projeto nunca teve.
- Reverter invalida comparação com partidas anteriores, porque muda o que o número significa.

## Contexto que motivou

`playWith` (hoje em `public/jogo/src/06-resources.js`) não tinha guarda de `t.uses` — cada toque em Sino dava 25 pontos, sem limite. Grind de Sino rendia mais que acender as 8 Fogueiras. Os cinco `addScore('optional')` somavam no máximo ~275 pontos contra 1360 do Objetivo Principal, ou seja, já não motivavam nada — só distorciam.
