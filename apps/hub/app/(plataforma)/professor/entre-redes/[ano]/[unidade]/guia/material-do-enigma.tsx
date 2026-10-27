import { Card, Tag } from "@edu/ui/ds";
import { marcasDoConteudo, type Material } from "@/lib/enigma-capa-tipos";

import { CenaDoEnigma } from "../resultados/cena-do-enigma";

/**
 * O material de O Enigma da Capa da Rádio, VIVO (de `GET
 * /enigma-capa/professor/material`): os três pacotes prontos COM o gabarito,
 * para ler antes, e os componentes curriculares que a personalização aceita;
 * a pausa, os três cartões da nomeação e as perguntas da
 * conversa; o critério de cada nível, para o depois. Sem a api, o cartão diz
 * que não carregou — o resto do guia continua servindo.
 */
function NaoCarregou() {
  return (
    <div className="guia-bloco">
      <Card variant="outlined">
        <p className="text-[13px] text-unooria-neutral-600">O material da missão não carregou agora. Recarregue a página em instantes.</p>
      </Card>
    </div>
  );
}

export function CenasDoEnigma({ dados, baseDoBundle }: { dados: Material | null; baseDoBundle: string | null }) {
  if (!dados) return <NaoCarregou />;
  return (
    <div className="guia-bloco guia-bloco--longo">
      <Card variant="outlined" title="As cenas prontas, com o gabarito — só para você">
        <div className="flex flex-col gap-6 text-[13px] leading-relaxed text-unooria-neutral-800">
          <p>
            <strong>Não projete.</strong> Os círculos são os dois objetos iguais que a criança procura depois da virada;
            o que a visitante diz depende de a ação principal da foto ficar dentro da capa.
          </p>
          {dados.disciplinas.length > 0 ? (
            <p data-disciplinas>
              <strong>Para personalizar com IA, escolha o componente:</strong>{" "}
              {dados.disciplinas.map((d) => d.rotulo).join(", ")}.
            </p>
          ) : null}
          {dados.prontos.map((pronto) => {
            const cena = pronto.conteudo.cena;
            return (
              <section key={pronto.chave} className="flex flex-col gap-2" data-pronto={pronto.chave}>
                <h4 className="text-[14px] font-bold text-unooria-neutral-950">{`${pronto.nome} — ${pronto.tema}`}</h4>
                <CenaDoEnigma conteudo={pronto.conteudo} baseDoBundle={baseDoBundle} marcas={marcasDoConteudo(pronto.conteudo)} />
                <ul className="flex flex-col gap-1">
                  {cena.fotos.map((foto, i) => {
                    const selo = cena.selos.find((s) => s.id === foto.seloCoerente);
                    return (
                      <li key={foto.id}>
                        <strong>{`FOTO ${i + 1} — ${foto.acao}:`}</strong> {`“${foto.visitante}”`}
                        {selo ? ` · selo que combina: ${selo.emoji} ${selo.texto}` : ""}
                      </li>
                    );
                  })}
                  <li>
                    <strong>Os dois objetos iguais:</strong> {cena.invariantes.map((i) => i.nome).join(" e ")}
                  </li>
                </ul>
              </section>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

export function CartoesDoEnigma({ dados }: { dados: Material | null }) {
  if (!dados) return <NaoCarregou />;
  const r = dados.roteiro;
  return (
    <div className="guia-bloco">
      <Card variant="outlined" title="A conversa individual: a pausa, os três cartões e as perguntas">
        <div className="flex flex-col gap-3 text-[13px] leading-relaxed text-unooria-neutral-800">
          <p>
            <strong>Na abertura:</strong> {`“${r.introducao}”`}
          </p>
          <p>
            <strong>Em todo arraste:</strong> {`“${r.regraDoArraste}”`}
          </p>
          <p>
            <strong>Na pausa (AGUARDE O PROFESSOR):</strong> {`“${r.pausa}”`}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <strong>Os cartões da nomeação, depois da virada:</strong>
            {r.cartoes.map((c) => (
              <Tag key={c} variant="info" size="sm" pill>
                {c}
              </Tag>
            ))}
          </div>
          <ol className="flex list-decimal flex-col gap-1 pl-5">
            {r.perguntas.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ol>
          <p className="text-unooria-neutral-600">{r.liberar}</p>
        </div>
      </Card>
    </div>
  );
}

export function ReguasDoEnigma({ dados }: { dados: Material | null }) {
  if (!dados) return <NaoCarregou />;
  return (
    <div className="guia-bloco">
      <Card variant="outlined" title="O critério de cada nível (registrado pelo que a criança faz)">
        <div className="flex flex-col gap-3 text-[13px] leading-relaxed text-unooria-neutral-800">
          {dados.habilidades.map((h) => (
            <div key={h.codigo} className="flex flex-col gap-1">
              <strong className="text-unooria-neutral-950">{`${h.codigo} — ${h.rotulo}`}</strong>
              <span>{`Atingiu: ${h.criterios.atingiu}`}</span>
              <span>{`Em processo: ${h.criterios.em_processo}`}</span>
              <span>{`Não atingiu: ${h.criterios.nao_atingiu}`}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
