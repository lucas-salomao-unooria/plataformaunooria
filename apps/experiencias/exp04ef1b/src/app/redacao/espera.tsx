import { useState } from "react";
import { Button, Card, CardContent, NewspaperPage, ScrollBar } from "@edu/ui/ds";
import { E4, EREV, REDACAO } from "../../lib/textos";
import type { EdicaoDoEstudante, IdDeNoticia, NoticiaPublica } from "../../lib/tipos";
import { Cabecalho } from "./cabecalho";
import { vagasDaPagina } from "./pagina";

/**
 * E4-ALU-02 — a espera NEUTRA depois do motivo: a edição foi entregue, e quem
 * libera o resultado é o professor ("Liberar resultado", o primeiro dos dois
 * portões). A tela não diz nada sobre o que a edição causou — isso é da E4, e
 * ninguém vê o resultado de uma edição antes da mediação.
 *
 * O polling do gate (5 s) roda na casca enquanto esta tela está de pé
 * (`aguardandoOProfessor`); a curiosidade é o passatempo sem spoiler que a
 * copy prevê.
 */
export function Espera({
  edicao,
  porId,
}: {
  edicao: EdicaoDoEstudante | null;
  porId: ReadonlyMap<IdDeNoticia, NoticiaPublica>;
}) {
  const [curiosidade, setCuriosidade] = useState(false);
  return (
    <div className="tela">
      <Cabecalho titulo={E4.statusEspera} />
      <ScrollBar className="rolagem" autoHide>
        <div className="tela__corpo">
          <p className="tela__mensagem" role="status">
            {E4.mensagemEspera}
          </p>
          {edicao && (
            <NewspaperPage
              nameplate={REDACAO.nome}
              edition={EREV.edicao(1)}
              slots={vagasDaPagina(edicao.slots, porId)}
              layout={edicao.layout}
              size="thumbnail"
              readOnly
              headingLevel={3}
            />
          )}
          {curiosidade ? (
            <Card>
              <CardContent>
                <p className="tela__texto">{E4.curiosidade}</p>
              </CardContent>
            </Card>
          ) : (
            <Button variant="outline" size="lg" fullWidth className="acao-crianca" onClick={() => setCuriosidade(true)}>
              {E4.curiosidades}
            </Button>
          )}
        </div>
      </ScrollBar>
    </div>
  );
}
