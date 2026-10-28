import { BottomSheetUnv, IconUnv, InlineHint, ListItem, TopBar } from "@edu/ui/ds-unoovista";
import { TEXTOS } from "../lib/textos";
import type { Sessao } from "../lib/tipos";

/**
 * E6-ALU-02 — o fim, em somente leitura (seção `unoovista`, claro). O selo, o
 * cartão do podcast e a TRANSCRIÇÃO (`textos.podcast`, da api).
 *
 * O áudio NÃO toca aqui: o podcast é do professor, tocado em aula depois do
 * debate (ele conta a virada) — daí a linha que diz isso, e nenhum player. A
 * transcrição é a folha NÃO modal do `BottomSheet` do DS, recolhida na alça:
 * é o que a seção tem para mostrar e esconder, sem componente local.
 *
 * Sem diário de bordo e sem reflexão: a transferência saiu desta versão (ADR-191).
 */
export function Conclusao({ podcast, semRede }: { podcast: Sessao["textos"]["podcast"]; semRede: boolean }) {
  return (
    <main className="unv-tela unv-tela--conclusao" data-unv-theme="light">
      <TopBar variant="plain" title={TEXTOS.conclusao.selo} />
      {semRede && (
        <InlineHint tone="friction" role="alert">
          {TEXTOS.feed.conexao}
        </InlineHint>
      )}
      <div className="unv-rolagem unv-explicar">
        <section className="unv-cartao unv-selo" role="status">
          <IconUnv name="check" size="lg" tone="link" />
          <h1 className="unv-cartao__titulo">{TEXTOS.conclusao.selo}</h1>
          <p className="unv-explicar__texto">{TEXTOS.conclusao.arquivada}</p>
        </section>
        <section className="unv-cartao" aria-label={TEXTOS.conclusao.podcast}>
          <ListItem
            className="unv-item-longo"
            leading={<IconUnv name="comment" />}
            title={TEXTOS.conclusao.podcast}
            subtitle={TEXTOS.conclusao.apresentacao}
          />
          <p className="unv-explicar__texto unv-explicar__texto--secundario">{TEXTOS.conclusao.emAula}</p>
        </section>
      </div>
      <BottomSheetUnv
        modal={false}
        defaultOpen={false}
        collapsedLabel={TEXTOS.conclusao.transcricao}
        title={TEXTOS.conclusao.transcricaoTitulo}
        maxHeight="70%"
      >
        <div className="unv-transcricao">
          {podcast.blocos.map((b) => (
            <section key={b.titulo}>
              <h3 className="unv-folha__bloco">{b.titulo}</h3>
              {b.falas.map((f, i) => (
                <p key={i} className="unv-transcricao__fala">
                  <strong>{f.quem}:</strong> {f.texto}
                </p>
              ))}
            </section>
          ))}
        </div>
      </BottomSheetUnv>
    </main>
  );
}
