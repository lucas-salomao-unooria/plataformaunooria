import { Badge, Button, Card, CardContent, FeedbackAlert, Tag } from "@edu/ui/ds";

import type { Aparencia } from "../../lib/tema";

/**
 * Briefing da missão — a primeira tela do estudante (Figma `3:24`).
 *
 * ELA USA O DS DA PLATAFORMA, e é a primeira vez que isso acontece ANTES da
 * revelação. O critério é o que `Dialogos.tsx` já registra: o que fala de
 * "missão" fala pela Unooria, não pelo app de vídeo. Aqui não há disfarce a
 * proteger — a criança ainda não viu um Short sequer, e o que a tela precisa
 * fazer é dizer, na voz da escola, o que ela vai fazer e por quais regras. O
 * disfarce começa no toque em "Começar missão", e daí em diante o feed é clone
 * puro.
 *
 * A `Topbar` do clone continua acima (o wireframe a desenha lá): a marca
 * UnooTube é o cenário, não a voz.
 *
 * A copy é VERBATIM do Figma. Nada aqui menciona fake news, fonte confiável,
 * credibilidade ou pontuação — a nota `ETAPA 1` é explícita quanto a isso, e
 * qualquer uma dessas palavras entregaria o exercício antes de ele começar.
 *
 * `theme` vem por prop porque a seção da plataforma não lê `data-uni-theme`.
 */

const PASSOS = ["Assista aos Shorts", "Curta os que você gostar", "Salve seus 3 favoritos"] as const;

const REGRAS = [
  "Você só pode salvar 3 vídeos por vez.",
  "Se mudar de ideia, pode remover um vídeo e escolher outro.",
  "As curtidas não contam para completar a missão.",
] as const;

interface Props {
  aparencia: Aparencia;
  aoComecar: () => void;
}

export function TelaDeEntrada({ aparencia, aoComecar }: Props) {
  const tema = aparencia === "escuro" ? "dark" : "light";
  return (
    <section className="entrada" aria-labelledby="entrada-titulo">
      <Tag theme={tema} variant="info" size="sm" pill>
        MISSÃO 1
      </Tag>

      <h1 id="entrada-titulo">Missão: escolha seus Shorts favoritos!</h1>
      <p className="entrada-resumo">
        Você vai assistir a vários Shorts sobre histórias e curiosidades. Assista com atenção e
        escolha os 3 vídeos que você achou mais legais.
      </p>

      <ol className="entrada-passos">
        {PASSOS.map((passo, indice) => (
          <li key={passo}>
            <Card theme={tema} variant="outlined">
              <CardContent>
                <Badge theme={tema} variant="primary" pill aria-hidden="true">
                  {indice + 1}
                </Badge>
                <span>{passo}</span>
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>

      {/*
       * `FeedbackAlert`, não `AlertBox`: o segundo é diálogo de 436px, e o que
       * esta tela precisa é de uma faixa de contexto. Está registrado no
       * CLAUDE.md, e o prop é `type` — não `variant`.
       */}
      <FeedbackAlert theme={tema} type="info" className="entrada-regras">
        <ul>
          {REGRAS.map((regra) => (
            <li key={regra}>{regra}</li>
          ))}
        </ul>
      </FeedbackAlert>

      <Button theme={tema} variant="primary" size="lg" autoFocus onClick={aoComecar}>
        Começar missão
      </Button>
    </section>
  );
}
