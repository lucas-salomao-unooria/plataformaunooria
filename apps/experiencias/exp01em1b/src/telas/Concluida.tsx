import { useState } from "react";
import { Button, Card, CardContent, CardHeader, Certificate, Tag } from "@edu/ui/ds";
import { Casca, Zara, rotuloDaZara } from "../componentes/Casca";
import type { Contexto } from "../contexto";
import { TEXTOS } from "../lib/textos";

/**
 * E6-ALU-02 — CONGELADO: a missão concluída (o LATCH 2 gravado). Nada aqui
 * escreve na api — só leitura.
 *
 * O certificado é o `Certificate` do DS (0.2.22), com o glifo "balance". A salvaguarda ("Direito à Explicação e Revisão Humana")
 * é o `Badge` e aparece quando a página de transparência foi ATIVADA — é a
 * página que carrega essa garantia; o bloco 4 do comunicado não decide nada
 * aqui (seria mostrar o gabarito).
 *
 * "Pular Desafio Extra e Encerrar" só recolhe o desafio extra: a conclusão já
 * foi enviada à plataforma na chegada a este passo.
 */
export function Concluida({ ctx }: { ctx: Contexto }) {
  const { estado } = ctx;
  const [desafioAberto, setDesafioAberto] = useState(true);
  const salvaguarda = estado.publicacao?.paginaAtiva === true;

  return (
    <Casca cabecalho={{ titulo: TEXTOS.e6.cabecalho, tag: TEXTOS.e6.tag }} equipe={estado.equipe}>
      <Zara rotulo={rotuloDaZara(estado.equipe)}>{TEXTOS.e6.fala}</Zara>
      <Certificate
        title={TEXTOS.e6.certificado}
        titleAs="h2"
        icon="balance"
        theme="light"
        safeguard={salvaguarda ? TEXTOS.e6.salvaguarda : undefined}
        footer={TEXTOS.e6.congelada}
      >
        {estado.equipe && (
          <Tag variant="brand" size="sm">
            {TEXTOS.e6.estacaoHomologada(estado.equipe.nome)}
          </Tag>
        )}
      </Certificate>
      <Card variant="outlined">
        <CardHeader title={TEXTOS.e6.transferenciaTitulo} />
        <CardContent>
          <p className="escola__texto">{TEXTOS.e6.transferencia}</p>
        </CardContent>
      </Card>
      <Card variant="outlined">
        <CardHeader title={TEXTOS.e6.sinteseTitulo} />
        <CardContent>
          <p className="escola__texto">{TEXTOS.e6.sintese}</p>
        </CardContent>
      </Card>
      {desafioAberto && (
        <>
          <Card variant="outlined">
            <CardHeader title={TEXTOS.e6.desafioTitulo} />
            <CardContent>
              <p className="escola__texto">{TEXTOS.e6.desafio}</p>
            </CardContent>
          </Card>
          <Button variant="secondary" size="lg" fullWidth onClick={() => setDesafioAberto(false)}>
            {TEXTOS.e6.pularDesafio}
          </Button>
        </>
      )}
    </Casca>
  );
}
