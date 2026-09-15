import { Card, ScrollBar } from "@edu/ui/ds";
import { CONTROLE_DO_PROFESSOR, type EtapaDaTurma } from "@/lib/insta-tipos";

/**
 * A tabela dos momentos do painel do Instanooria — BLOCO VIVO do guia.
 *
 * A lista vem de `CONTROLE_DO_PROFESSOR`, a mesma que o painel ao vivo monta.
 * Já foi escrita à mão aqui, com seis linhas, enquanto o painel tinha sete: o
 * guia falava em "os seis botões", o professor via sete, e nada obrigava os
 * dois a concordarem — um passo novo entraria no painel e o guia seguiria
 * mentindo. O que mora neste arquivo é só o detalhe A MAIS, aditivo por etapa e
 * inofensivo se faltar.
 */
const DETALHE_DO_GUIA: Partial<Record<EtapaDaTurma, string>> = {
  investigacao: "Antes do feed ele escolhe figurinha e nome, e lê a missão.",
  conclusao:
    "Três opções (mais para A / em dúvida / mais para B). Não tem campo de texto aqui.",
  debate: "Só abrir e fechar o que ele salvou — nada de rolar feed, curtir ou comentar.",
  explicabilidade:
    "São sete telas, uma frase por vez, no ritmo dele — e no fim o relatório, que abre em tela cheia.",
  perdidos: "Sem nenhuma interação: só o que passou longe.",
  reflexao: "Escrita livre, com um mínimo curto para a frase não ficar pela metade.",
  fim: "Encerra a atividade e tira a turma do ao vivo.",
};

export function MomentosDoPainel() {
  return (
    <div className="guia-bloco guia-bloco--longo">
      <Card
        variant="outlined"
        title={`Você conduz — os ${CONTROLE_DO_PROFESSOR.length} momentos`}
      >
        <p className="text-[14px] leading-relaxed text-unooria-neutral-800">
          A atividade não roda sozinha: ninguém passa para o momento seguinte sem que você
          aperte o botão. Isso existe para que a sala chegue <strong>junta</strong> no debate e
          na revelação — o momento-espelho depende de todos terem acabado de sair do feed. O
          painel mostra o momento de agora em destaque, o botão da próxima ação e uma linha
          dizendo o que vai mudar na tela dos estudantes. Em cada momento há também{" "}
          <strong>voltar um momento</strong>, se você adiantou sem querer.
        </p>
        <ScrollBar orientation="horizontal" autoHide className="mt-4">
          {/* Rolagem lateral da tabela larga pelo `ScrollBar` do DS: em tela estreita a
              tabela do guia passa da coluna, e a barra some quando ninguém a usa. */}
            <table className="w-full min-w-[560px] border-collapse text-left text-[14px]">
              <thead>
                <tr className="text-[12px] text-unooria-neutral-500">
                  <th className="w-52 py-2 font-semibold">Botão</th>
                  <th className="py-2 font-semibold">O que acontece na tela do estudante</th>
                </tr>
              </thead>
              <tbody className="align-top">
                {CONTROLE_DO_PROFESSOR.map((momento) => (
                  <tr key={momento.etapa} className="border-t border-unooria-neutral-200">
                    <td className="py-2.5 pr-3 font-semibold text-unooria-neutral-950">
                      {momento.rotulo}
                    </td>
                    <td className="py-2.5 leading-relaxed text-unooria-neutral-800">
                      {momento.descricao}
                      {DETALHE_DO_GUIA[momento.etapa] ? (
                        <span className="text-unooria-neutral-700">
                          {" "}
                          {DETALHE_DO_GUIA[momento.etapa]}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        </ScrollBar>
        <p className="mt-3 text-[12px] leading-relaxed text-unooria-neutral-500">
          A etapa da turma é <strong>piso, não teto</strong>: quem terminou de ler o relatório
          antes dos colegas não fica preso, mas ninguém passa do que você liberou. A única
          exceção é o <strong>debate</strong> — ele trava todo mundo na mesma tela, de propósito.
        </p>
      </Card>
    </div>
  );
}
