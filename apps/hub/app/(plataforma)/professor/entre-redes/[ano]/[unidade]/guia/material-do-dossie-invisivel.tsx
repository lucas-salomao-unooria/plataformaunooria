import { Card, ScrollBar, Tag } from "@edu/ui/ds";
import { PROJETOS, ROTULO_DO_PAPEL, type Material, type ProjetoId } from "@/lib/dossie-invisivel-tipos";

/**
 * O material de O Dossiê Invisível, VIVO (de `GET /dossie-invisivel/professor/material`):
 * o banco padrão (os três projetos e os cadernos) e a conta da virada, para
 * ler antes; o gabarito do Editor de Protocolo, para o Explicar; as réguas das
 * duas habilidades, para o depois. Sem a api, o cartão diz que não carregou —
 * o resto do guia continua servindo.
 */
function NaoCarregou() {
  return (
    <Card variant="outlined">
      <p className="text-[13px] text-unooria-neutral-600">O material da missão não carregou agora. Recarregue a página em instantes.</p>
    </Card>
  );
}

/** O índice (0 a 1) em pontos de 0 a 100, sem casas: é o que a tabela de confronto mostra em palavras. */
const pontos = (indice: number) => Math.round(indice * 100);

export function BancoDoDossie({ dados }: { dados: Material | null }) {
  if (!dados) return <NaoCarregou />;
  const c = dados.padrao.conteudo;
  const nome = (p: ProjetoId) => c.projetos[p].nome;
  const posicao = (lista: Material["virada"]["antes"], p: ProjetoId) => lista.findIndex((l) => l.projeto === p) + 1;
  const indice = (lista: Material["virada"]["antes"], p: ProjetoId) => lista.find((l) => l.projeto === p)?.indice ?? 0;
  return (
    <div className="guia-bloco guia-bloco--longo">
      <Card variant="outlined" title={`O banco padrão — “${dados.padrao.tema}”, e a conta da virada`}>
        <div className="flex flex-col gap-4 text-[13px] leading-relaxed text-unooria-neutral-800">
          <div className="grid gap-4 md:grid-cols-3">
            {PROJETOS.map((p) => {
              const projeto = c.projetos[p];
              return (
                <div key={p} className="flex flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <strong className="text-unooria-neutral-950">{projeto.nome}</strong>
                    <Tag variant="neutral" size="sm" pill>
                      {ROTULO_DO_PAPEL[p]}
                    </Tag>
                  </span>
                  <span>{`${projeto.coordenador} (${projeto.idade} anos) · ${projeto.vagas} vagas · R$ ${projeto.custoPorVaga} por vaga`}</span>
                  <span>{projeto.area}</span>
                  <span className="text-unooria-neutral-600">{`${projeto.documentos.length} ${projeto.documentos.length === 1 ? "documento indexado" : "documentos indexados"}`}</span>
                </div>
              );
            })}
          </div>
          <div className="flex flex-col gap-1">
            <strong className="text-unooria-neutral-950">{`Os cadernos de campo de ${nome("papel")}`}</strong>
            <p>{c.cadernos.resumo}</p>
          </div>
          <div className="flex flex-col gap-2">
            <strong className="text-unooria-neutral-950">A conta da virada: os mesmos critérios, antes e depois dos cadernos</strong>
            <ScrollBar orientation="horizontal" autoHide>
              <table className="w-full min-w-[480px] border-collapse text-left text-[13px]">
                <thead>
                  <tr className="text-[12px] text-unooria-neutral-500">
                    <th className="py-2 font-semibold">Projeto</th>
                    <th className="py-2 font-semibold">Antes dos cadernos</th>
                    <th className="py-2 font-semibold">Depois dos cadernos</th>
                  </tr>
                </thead>
                <tbody className="align-top">
                  {PROJETOS.map((p) => (
                    <tr key={p} className="border-t border-unooria-neutral-200">
                      <td className="py-2 pr-3 font-semibold text-unooria-neutral-950">{nome(p)}</td>
                      <td className="py-2 pr-3">{`${posicao(dados.virada.antes, p)}º · ${pontos(indice(dados.virada.antes, p))} pontos`}</td>
                      <td className="py-2">{`${posicao(dados.virada.depois, p)}º · ${pontos(indice(dados.virada.depois, p))} pontos`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollBar>
            <p className="text-unooria-neutral-600">
              Documentos indexados e vagas comprovadas, com o mesmo peso. O estudante não vê a conta: vê o parecer do
              assistente se inverter na tabela de confronto.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

export function ProtocoloDoDossie({ dados }: { dados: Material | null }) {
  if (!dados) return <NaoCarregou />;
  const { gabarito, danoso, rotulos } = dados.protocolo;
  return (
    <div className="guia-bloco">
      <Card variant="outlined" title="O Editor de Protocolo, com o gabarito">
        <div className="flex flex-col gap-2 text-[13px] leading-relaxed text-unooria-neutral-800">
          <ol className="flex list-decimal flex-col gap-1 pl-5">
            {gabarito.map((bloco, i) => (
              <li key={bloco}>
                <strong>{`${i + 1}ª verificação:`}</strong> {rotulos[bloco]}
              </li>
            ))}
          </ol>
          <p>
            <strong>Para a Área de Descarte:</strong> {rotulos[danoso]}
          </p>
          <p className="text-unooria-neutral-600">
            O estudante não sabe disso: os blocos chegam embaralhados, o envio aceita qualquer composição e a resposta
            não diz se ele acertou.
          </p>
        </div>
      </Card>
    </div>
  );
}

export function ReguasDoDossie({ dados }: { dados: Material | null }) {
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
