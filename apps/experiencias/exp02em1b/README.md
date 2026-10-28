# exp02em1b — O Efeito Amplificador

Missão da 2ª série do Ensino Médio, unidade 1 ("Como os algoritmos decidem por
nós?"), versão 2.3.0 (ADR-191 a ADR-193). O estudante é moderador do perfil do grêmio:
abre a pauta no UnooriaAI, pede o rascunho e o audita (dado inventado, trecho
sem crédito, colega exposto), escolhe a manchete e publica no Unoovista. O
algoritmo pinça um trecho e entrega o post de madrugada — para todo mundo,
qualquer que seja o texto. No feed ele fixa um aviso de cuidado, ajusta a
Configuração da Publicação e usa a Central de Apoio; depois do debate, aponta
nos bastidores os indicadores da retenção e conclui, com a devolutiva do que
fez. A IA não decide nada que a régua mede: ela lê o pedido do chat e o
traduz para a árvore de intenções, escreve no preparo as reações do feed ao
post de cada um e redige a devolutiva a partir dos fatos.

```bash
pnpm --filter @edu/exp02em1b dev     # :5178 → hub /exp/exp02em1b
pnpm --filter @edu/exp02em1b test    # versão em três lugares, bundle sem gabarito, seções do DS, regras puras
```

## Telas

| Tela | Seção | O quê |
|---|---|---|
| E1-ALU-01 | `unooriaai` | a pauta da semana e "Abrir UnooriaAI" (ou a espera, sem pacote no ar) |
| E2-ALU-01 / E2-SIS-01 | `unooriaai` | o chat (5 mensagens, 3 sugestões, dica de 60 s, faixa de conexão) |
| E2-ALU-02 | `unooriaai` | a Prévia do Post: avisos de pendência, "Solicitar revisão", "Aprovar Prévia", "Exportar para o Unoovista" |
| E3-ALU-01 | `unooriaai` | o Fechamento Editorial: a manchete e o "Publicar no Unoovista" (latch) |
| E3-SIS-01 | `unoovista` | o salto do relógio 16h00 → 23h45 → 02h30 |
| E4-ALU-01 a 04 | `unoovista` | o feed da madrugada, o aviso de cuidado, a Configuração da Publicação e a Central de Apoio |
| E4-SIS-01 | `unoovista` | a pausa do professor |
| E5-ALU-01 / 02 | `unoovista` | os bastidores e a espera ativa com o gráfico |
| E6-ALU-02 | `unoovista` | o fim: a devolutiva (um parágrafo por habilidade) e o cartão do podcast (tocado em aula; a transcrição é do professor) |

A instrução do moderador (TC-10) não está no aparelho: o hub a desenha ao
lado, a partir do `exp:estado` (`{ instrucao }` na Etapa 4, `{}` fora dela).

## Telemetria

| Id | Verbo | Objeto | `resultado` |
|---|---|---|---|
| EVT-U01 | `attempted` | `missao:iniciar` | `{ retomada }` |
| EVT-U02 | `progressed` | `etapa:entrar` | `{ etapa }` (E1…E6) |
| EVT-U03 | `completed` | `exp02em1b` | `{ concluido: true }` |
| EVT-U04 | `interacted` | `aviso:inatividade` | `{ segundos_sem_acao: 60 }` |
| EVT-U05 | `attempted` | `erro:exibir` | `{ codigo: "rede-oscilando" }` |
| EVT-001 | `interacted` | `chat:prompt_enviar` | `{ caracteres }` — nunca o texto |
| EVT-002 | `scored` | `decisao:publicar` | `{ manchete_tipo }` |
| EVT-003 | `interacted` | `aviso_cuidado:fixar` | `{ motivo }` |
| EVT-004 | `interacted` | `seguranca:acao_acionar` | `{ tipo }` |
| EVT-005 | `interacted` | `evidencia:apontar` | `{ elemento }` (o id da api: `pico-madrugada`, `retencao`) |

Todo evento leva `contexto: { etapa }`. A regra pedagógica, o gabarito e as
marcas de evidência estão na api (`apps/api/src/efeito-amplificador`).
