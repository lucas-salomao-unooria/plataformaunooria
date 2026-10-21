import { useState, type RefObject } from "react";
import { AlertBox, BottomSheet, Button, NEWS_MEDIUM_LABELS, RevealClue } from "@edu/ui/ds";
import { ICONE_DA_PISTA, MEIO_PARA_MEDIUM } from "../../lib/meios";
import { chaveDaPista } from "../../lib/regras";
import { E2, E3, PISTA } from "../../lib/textos";
import { TIPOS_DE_PISTA, type NoticiaPublica, type TipoDePista, type Veredito } from "../../lib/tipos";
import { JulgarPista } from "./julgar-pista";
import { MateriaOriginal } from "./materia-original";

/**
 * A gaveta da mesa (E2-ALU-02): a `BottomSheet` da seção `unooria` com a
 * matéria no formato original, as três pistas (`RevealClue`) e a ação.
 *
 * **As pistas são reveladas pelo SERVIDOR.** O texto de fonte, data e autoria
 * não está na sessão: ele desce no `POST pista`, e é esse registro que mede a
 * EF15CO04. Por isso o toque abre o chip na hora (com "Abrindo a pista…") e o
 * texto chega quando a api responde (o já conhecido aparece na hora); se a
 * chamada falhar por um motivo que não se repete, o chip fecha de novo. Na mesa
 * da 1ª edição, pista já aberta — nesta aba ou antes do F5 (`pistasAbertas`) —
 * reabre aberta, sem nova ida à api. Na REVISÃO os chips nascem fechados: a api
 * registra cada par uma vez por fase, e reabrir é a consulta da fase 2 que ela
 * quer ver (`jornal-app.tsx#revelar`). Fechar um chip é só da tela.
 *
 * **O foco volta ao cartão que abriu a gaveta** (`finalFocusRef`) — sem isso,
 * quem navega por teclado cai no topo da mesa. Fechar é pelo X ("Voltar para a
 * Mesa"), Esc ou véu; nunca só por gesto.
 *
 * **O julgamento (3.0.0, ADR-168).** Na mesa da 1ª edição, logo abaixo do texto
 * da pista aberta, "✓ Confio" e "✗ Não confio" (`JulgarPista`). Marcar é
 * OPCIONAL — fechar sem marcar só não conta — e o primeiro vale: o veredito
 * desenhado é o que a api DEVOLVEU, e a pista já julgada (também depois do F5,
 * pelo `estado.julgamentos`) mostra a marca e não deixa mudar. Na revisão
 * (`julgamentos` ausente) as pistas abrem sem julgamento. Não há "Deixar de
 * fora": a decisão é a capa.
 *
 * O Bento não fala aqui: a mesa é silêncio (PRD §5, Etapa 2), e a tela não avisa
 * nada sobre a notícia — nem que é antiga, nem que falta autor.
 */
export function Gaveta({
  noticia,
  naCapa,
  capaCheia,
  pistas,
  finalFocusRef,
  aoFechar,
  aoAdicionar,
  aoTrocar,
  aoRevelar,
  abertaDeInicio,
  julgamentos,
  aoJulgar,
  aoFalharMidia,
}: {
  noticia: NoticiaPublica | null;
  naCapa: boolean;
  capaCheia: boolean;
  /** Texto das pistas já reveladas, pela chave `n3:fonte`. */
  pistas: ReadonlyMap<string, string>;
  finalFocusRef: RefObject<HTMLElement | null>;
  aoFechar: () => void;
  aoAdicionar: () => void;
  aoTrocar: () => void;
  aoRevelar: (tipo: TipoDePista) => Promise<boolean>;
  /** O chip nasce aberto? Na mesa, o que a api já revelou; na revisão, o que já foi consultado NELA. */
  abertaDeInicio: (tipo: TipoDePista) => boolean;
  /** Os vereditos que valem, pela chave `n3:fonte`. AUSENTE = esta fase não julga (a revisão). */
  julgamentos?: ReadonlyMap<string, Veredito>;
  /** O `POST julgamento`. `false` = falhou por um motivo que não se repete (a casca já tratou). */
  aoJulgar?: (tipo: TipoDePista, veredito: Veredito) => Promise<boolean>;
  aoFalharMidia: () => void;
}) {
  return (
    <BottomSheet
      isOpen={noticia !== null}
      onClose={aoFechar}
      title={noticia ? NEWS_MEDIUM_LABELS[MEIO_PARA_MEDIUM[noticia.meio]] : undefined}
      closeLabel={E2.voltarParaMesa}
      finalFocusRef={finalFocusRef}
      maxHeight="92%"
      footer={
        noticia ? (
          naCapa ? (
            <Button variant="outline" size="lg" fullWidth className="acao-crianca" onClick={aoTrocar}>
              {E3.trocar}
            </Button>
          ) : (
            <Button size="lg" fullWidth className="acao-crianca" onClick={aoAdicionar}>
              {E2.adicionar}
            </Button>
          )
        ) : undefined
      }
    >
      {noticia ? (
        <ConteudoDaGaveta
          key={noticia.id}
          noticia={noticia}
          naCapa={naCapa}
          capaCheia={capaCheia}
          pistas={pistas}
          aoRevelar={aoRevelar}
          abertaDeInicio={abertaDeInicio}
          julgamentos={julgamentos}
          aoJulgar={aoJulgar}
          aoFalharMidia={aoFalharMidia}
        />
      ) : (
        <span />
      )}
    </BottomSheet>
  );
}

function ConteudoDaGaveta({
  noticia,
  naCapa,
  capaCheia,
  pistas,
  aoRevelar,
  abertaDeInicio,
  julgamentos,
  aoJulgar,
  aoFalharMidia,
}: {
  noticia: NoticiaPublica;
  naCapa: boolean;
  capaCheia: boolean;
  pistas: ReadonlyMap<string, string>;
  aoRevelar: (tipo: TipoDePista) => Promise<boolean>;
  abertaDeInicio: (tipo: TipoDePista) => boolean;
  julgamentos?: ReadonlyMap<string, Veredito>;
  aoJulgar?: (tipo: TipoDePista, veredito: Veredito) => Promise<boolean>;
  aoFalharMidia: () => void;
}) {
  const [julgando, setJulgando] = useState<ReadonlySet<TipoDePista>>(() => new Set());

  function julgar(tipo: TipoDePista, veredito: Veredito) {
    if (!aoJulgar || julgando.has(tipo)) return;
    setJulgando((atual) => new Set(atual).add(tipo));
    void aoJulgar(tipo, veredito).finally(() =>
      setJulgando((atual) => {
        const nova = new Set(atual);
        nova.delete(tipo);
        return nova;
      }),
    );
  }

  /* A gaveta reabre como estava NESTA fase (`abertaDeInicio`). `key` no pai
     reinicia este estado quando a notícia muda. */
  const [abertas, setAbertas] = useState<ReadonlySet<TipoDePista>>(
    () => new Set(TIPOS_DE_PISTA.filter((t) => abertaDeInicio(t))),
  );

  function alternar(tipo: TipoDePista, aberta: boolean) {
    setAbertas((atual) => {
      const nova = new Set(atual);
      if (aberta) nova.add(tipo);
      else nova.delete(tipo);
      return nova;
    });
    if (!aberta) return;
    void aoRevelar(tipo).then((ok) => {
      if (ok) return;
      setAbertas((atual) => {
        const nova = new Set(atual);
        nova.delete(tipo);
        return nova;
      });
    });
  }

  return (
    <div className="gaveta">
      <MateriaOriginal noticia={noticia} aoFalharMidia={aoFalharMidia} />

      <div className="gaveta__pistas">
        {TIPOS_DE_PISTA.map((tipo) => {
          const chave = chaveDaPista(noticia.id, tipo);
          const texto = pistas.get(chave);
          return (
            <RevealClue
              key={tipo}
              label={PISTA[tipo].rotulo}
              question={PISTA[tipo].pergunta}
              icon={ICONE_DA_PISTA[tipo]}
              open={abertas.has(tipo)}
              onOpenChange={(aberta) => alternar(tipo, aberta)}
            >
              {texto ? (
                <>
                  {texto}
                  {julgamentos && (
                    <JulgarPista
                      veredito={julgamentos.get(chave) ?? null}
                      enviando={julgando.has(tipo)}
                      aoJulgar={(v) => julgar(tipo, v)}
                    />
                  )}
                </>
              ) : (
                <span aria-busy="true">{E2.abrindoPista}</span>
              )}
            </RevealClue>
          );
        })}
      </div>

      {/* `DEG_QUARTA_MATERIA`: a capa já tem três e esta não está nela. A ação
          continua no rodapé (o toque não some); o aviso diz o caminho.
          `role="status"`: o `AlertBox` nasce `alertdialog` + `aria-modal`, e
          um diálogo modal DENTRO da gaveta (que já é o modal) calaria o resto
          dela para o leitor de tela. */}
      {capaCheia && !naCapa && (
        <AlertBox variant="warning" theme="light" device="mobile" role="status" description={E3.quartaMateria} />
      )}
    </div>
  );
}
