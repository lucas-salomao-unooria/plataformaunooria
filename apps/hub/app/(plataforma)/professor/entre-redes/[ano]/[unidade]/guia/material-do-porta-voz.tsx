import { Card, ScrollBar, Tag } from "@edu/ui/ds";
import { ROTULO_DO_MOTIVO, type Material } from "@/lib/porta-voz-tipos";

/**
 * O material de O Porta-Voz dos Dados, VIVO (de `GET /porta-voz-dos-dados/professor/material`):
 * o banco padrão (a tabela com os números fixos e a nota técnica) e os dois
 * cartões da perícia COM o gabarito, para ler antes; o laudo, para o Explicar;
 * as réguas das seis habilidades, para o depois. Sem a api, o cartão diz que
 * não carregou — o resto do guia continua servindo.
 */
function NaoCarregou() {
  return (
    <Card variant="outlined">
      <p className="text-[13px] text-unooria-neutral-600">O material da missão não carregou agora. Recarregue a página em instantes.</p>
    </Card>
  );
}

export function BancoDoPortaVoz({ dados }: { dados: Material | null }) {
  if (!dados) return <NaoCarregou />;
  const c = dados.padrao.conteudo;
  const { cartaoDistorcido, motivo, cartoes } = dados.pericia;
  return (
    <div className="guia-bloco guia-bloco--longo">
      <Card variant="outlined" title={`O banco padrão — “${dados.padrao.nome}”, e a perícia com o gabarito`}>
        <div className="flex flex-col gap-4 text-[13px] leading-relaxed text-unooria-neutral-800">
          <div className="flex flex-col gap-1">
            <strong className="text-unooria-neutral-950">{`${c.servico.indicador} — ${c.servico.orgao}`}</strong>
            <p className="text-unooria-neutral-600">{`${c.servico.unidade} · ${c.servico.abrangencia} · ${c.servico.periodicidade}`}</p>
          </div>
          <ScrollBar orientation="horizontal" autoHide>
            <table className="w-full min-w-[520px] border-collapse text-left text-[13px]">
              <thead>
                <tr className="text-[12px] text-unooria-neutral-500">
                  <th className="py-2 font-semibold">Período</th>
                  <th className="py-2 font-semibold">Índice</th>
                  <th className="py-2 font-semibold">Amostras conformes</th>
                  <th className="py-2 font-semibold">Situação</th>
                </tr>
              </thead>
              <tbody className="align-top">
                {dados.serie.map((s, i) => (
                  <tr key={`${s.valor}-${i}`} className="border-t border-unooria-neutral-200">
                    <td className="py-2 pr-3">{c.servico.periodos[i] ?? "—"}</td>
                    <td className="py-2 pr-3 font-semibold text-unooria-neutral-950">{`${s.valor}%`}</td>
                    <td className="py-2 pr-3">{`${s.conformes} de ${s.coletadas}`}</td>
                    <td className="py-2">{c.servico.situacoes[i] ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollBar>
          <div className="flex flex-col gap-1">
            <strong className="text-unooria-neutral-950">{`A nota técnica anexa: ${c.notaTecnica.titulo}`}</strong>
            <p>{c.notaTecnica.resumo}</p>
          </div>
          <div className="flex flex-col gap-2">
            <strong className="text-unooria-neutral-950">A perícia técnica: os dois cartões eleitorais</strong>
            <ul className="flex flex-col gap-2">
              {cartoes.map((cartao) => (
                <li key={cartao.id} className="flex flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <strong>{cartao.titulo}</strong>
                    {cartao.id === cartaoDistorcido ? (
                      <Tag variant="warning" size="sm" pill>
                        {`O distorcido · motivo: ${ROTULO_DO_MOTIVO[motivo].toLowerCase()}`}
                      </Tag>
                    ) : (
                      <Tag variant="success" size="sm" pill>
                        Sem distorção
                      </Tag>
                    )}
                  </span>
                  <span>{`“${cartao.tituloDoGrafico}” · eixo de ${cartao.eixo.origem} a ${cartao.eixo.teto} · ${cartao.fonte}`}</span>
                </li>
              ))}
            </ul>
            <p className="text-unooria-neutral-600">
              O estudante não sabe disso: os cartões chegam sem rótulo de certo ou errado, e a resposta ao parecer não diz se ele acertou.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

export function LaudoDoPortaVoz({ dados }: { dados: Material | null }) {
  if (!dados) return <NaoCarregou />;
  const l = dados.laudo;
  return (
    <div className="guia-bloco">
      <Card variant="outlined" title={`O laudo do Explicar — Fator de Mentira ${l.fator}`}>
        <div className="flex flex-col gap-2 text-[13px] leading-relaxed text-unooria-neutral-800">
          <p>{l.desmontagem}</p>
          <p>{l.fatorDeMentira}</p>
          <p className="text-unooria-neutral-600">{`Variação visual ${l.variacaoVisual} · variação real ${l.variacaoReal}.`}</p>
        </div>
      </Card>
    </div>
  );
}

export function ReguasDoPortaVoz({ dados }: { dados: Material | null }) {
  if (!dados) return <NaoCarregou />;
  return (
    <div className="guia-bloco guia-bloco--longo">
      <Card variant="outlined" title="O critério de cada nível (registrado pelo que o estudante faz)">
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
