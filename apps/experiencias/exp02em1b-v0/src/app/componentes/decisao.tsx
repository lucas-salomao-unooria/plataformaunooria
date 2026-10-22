import { Badge, Button, Modal } from '@edu/ui/ds-unooriaai';
import type { BairroPublico } from '../../lib/tipos';
import type { OpcaoDeJustificativa, Projecao } from '../../lib/tipos';
import { agruparEmpatados } from '../../lib/visao';
import { AVISO_FALTA_JUSTIFICAR, faltaJustificar } from '../../lib/textos';

const COR_EQUIPE = { alfa: 'bg-uai-equipe-alfa', bravo: 'bg-uai-equipe-bravo' } as const;

/**
 * O `<select>` nativo, vestido com os tokens do pacote.
 *
 * LACUNA DECLARADA do Design System: a seção `unooriaai` publica `Input`,
 * `SearchInput` e `ChatInput`, mas não tem campo de seleção — o cliente de
 * conversa que ele reproduz não tem nenhum. Enquanto não tiver, o controle é o
 * nativo (que é o mais acessível de qualquer forma, sobretudo no celular da
 * escola) e só a pintura vem de `--uai-*`.
 */
const CAMPO =
  'w-full rounded-uai-md border bg-uai-fundo p-2 text-sm text-uai-tinta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uai-borda-marca';

function milhar(n: number) {
  return n.toLocaleString('pt-BR');
}

/**
 * A Decisão Operacional. O estudante já disse os destinos conversando; aqui ele vê
 * a decisão inteira em uma tela antes de mandar — rotas, o que ela projeta e o
 * que ela deixa de fora.
 *
 * O número projetado sai das ESTIMATIVAS que ele carregou, com viés e faixa
 * (lib/missao/projecao.ts). Mostrar a média real da simulação daria um placar
 * antes da decisão, e a Missão passaria a ter resposta certa.
 */
export function Decisao({
  bairros,
  alocacao,
  justificativas,
  opcoes,
  projecao,
  ocupado,
  onTrocar,
  onJustificar,
  onEnviar,
  onFechar,
}: {
  bairros: BairroPublico[];
  alocacao: { alfa: string | null; bravo: string | null };
  /** Por que cada equipe vai para lá. Vazio até o estudante responder. */
  justificativas: { alfa: string | null; bravo: string | null };
  /**
   * As fontes que ele ABRIU, mais "foi intuição" — vem da api. Mostrar a fonte
   * que ele não consultou seria dizer, pela interface, o que ele deveria ter
   * olhado: o painel de fontes que o desenho recusou, entrando pela porta dos
   * fundos.
   */
  opcoes: OpcaoDeJustificativa[];
  /** A projeção das rotas, calculada NO SERVIDOR (`Projecao`). */
  projecao: Projecao;
  ocupado: boolean;
  onTrocar: (equipe: 'alfa' | 'bravo', bairro: string) => void;
  onJustificar: (equipe: 'alfa' | 'bravo', valor: string) => void;
  /**
   * Manda as equipes daqui mesmo. Null quando não há destino nenhum. Quem
   * clica é o estudante (regra de ouro 5); o portão da justificativa vale igual.
   */
  onEnviar: (() => void) | null;
  onFechar: () => void;
}) {
  const p = projecao;
  const outrosAvisos = p.avisos.filter(
    (a) => !p.rotas.some((r) => r.aviso !== null && a.includes(r.aviso)),
  );

  // O empate precisa aparecer NA HORA de escolher, não só na tabela que ele
  // leu três minutos antes: mandar as duas equipes para dois bairros que os
  // dados não separam é a decisão que o aviso existe para atrapalhar.
  const grupos = agruparEmpatados(
    bairros
      .filter((b) => b.estimativa)
      .map((b) => ({
        chave: b.slug,
        nome: b.nome,
        esperado: b.estimativa!.pessoasEmRisco.esperado,
        min: b.estimativa!.pessoasEmRisco.min,
        max: b.estimativa!.pessoasEmRisco.max,
      })),
  );
  const escolhidos = [alocacao.alfa, alocacao.bravo].filter(Boolean) as string[];
  const empateEscolhido = grupos.find(
    (g) => escolhidos.filter((slug) => g.some((x) => x.chave === slug)).length > 1,
  );

  const faltam = faltaJustificar(alocacao, justificativas).length > 0;

  // O `Modal` do pacote traz o que a moldura à mão não tinha: `aria-modal`,
  // confinamento de foco no Tab, fechamento por ESC e devolução do foco a quem
  // abriu. Nada disso é enfeite numa tela que um adolescente usa sob relógio.
  return (
    <Modal
      onClose={onFechar}
      aria-label="Decisão operacional"
      className="max-h-[90vh] w-full max-w-lg overflow-y-auto"
    >
      <Modal.Header onClose={onFechar}>A decisão até agora</Modal.Header>
      <Modal.Body>
        <p className="text-sm leading-snug text-uai-suave-60">
          Você pode trocar o destino de cada equipe aqui.
        </p>

        <div className="mt-4 grid gap-2.5">
          {p.rotas.map((r) => (
            <div key={r.equipe} className="rounded-uai-xl border border-uai-borda p-3.5">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <span
                    className={`grid h-6 w-6 place-items-center rounded-uai-md text-xs font-bold text-uai-tinta-inv ${COR_EQUIPE[r.equipe]}`}
                  >
                    {r.equipe.charAt(0).toUpperCase()}
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-uai-suave-60">
                    Equipe {r.equipe}
                  </span>
                </span>
                {r.minutos !== null && <Badge>{r.minutos} min</Badge>}
              </div>
              {/* O tempo de chegada precisa estar AQUI, na linha em que se
                  escolhe. Ele existia só depois de registrar a decisão, numa
                  aba do mapa que ninguém abre sob cronômetro — e a escolha
                  saía do número de pessoas, ignorando se dava para chegar. */}
              {r.aviso && <p className="mt-1.5 text-xs leading-snug text-uai-alerta">{r.aviso}</p>}
              <select
                aria-label={`Destino da equipe ${r.equipe}`}
                value={r.bairro ?? ''}
                disabled={ocupado}
                onChange={(e) => onTrocar(r.equipe, e.target.value)}
                className={`mt-2.5 border-uai-borda ${CAMPO}`}
              >
                <option value="" disabled>
                  Fica na base
                </option>
                {bairros.map((b) => {
                  // Minutos de CADA bairro para ESTA equipe, na própria lista:
                  // comparar destino sem comparar distância é escolher no
                  // escuro metade da decisão.
                  // `tempos` só existe com a malha viária carregada — o próprio
                  // dado é o portão, e não uma flag paralela que pode divergir.
                  const min = b.tempos?.[r.equipe] ?? null;
                  return (
                    <option key={b.slug} value={b.slug}>
                      {b.nome}
                      {min !== null ? ` · ${min} min` : ''}
                    </option>
                  );
                })}
              </select>

              {/* A pergunta que separa uma decisão de um palpite. Ela é feita
                  UMA vez, aqui, e esta tela não tem cronômetro — a pressa da
                  Missão é sobre buscar informação, nunca sobre justificar a
                  escolha. A lista só oferece o que ele JÁ abriu: mostrar a
                  fonte que ele não consultou seria dizer, pela interface, o que
                  ele deveria ter olhado. "Foi intuição" fica sempre disponível,
                  porque erro aqui vira aprendizado, não punição — e porque sem
                  essa saída o estudante aprende a mentir para o formulário. */}
              {r.bairro && (
                <label className="mt-2.5 block">
                  <span
                    className={`text-xs font-semibold uppercase tracking-wider ${
                      justificativas[r.equipe] ? 'text-uai-suave-60' : 'text-uai-alerta'
                    }`}
                  >
                    Por que aqui?
                  </span>
                  <select
                    aria-label={`Por que a equipe ${r.equipe} vai para lá`}
                    value={justificativas[r.equipe] ?? ''}
                    disabled={ocupado}
                    onChange={(e) => onJustificar(r.equipe, e.target.value)}
                    className={`mt-1 ${CAMPO} ${
                      justificativas[r.equipe] ? 'border-uai-borda' : 'border-uai-alerta'
                    }`}
                  >
                    <option value="" disabled>
                      Escolha o que te fez decidir
                    </option>
                    {opcoes.map((o) => (
                      <option key={o.valor} value={o.valor}>
                        {o.rotulo}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 border-t border-uai-borda pt-4">
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-uai-suave-60">
              Pela sua leitura
            </p>
            {p.confianca !== null && (
              <p className="text-xs font-semibold uppercase tracking-wider text-uai-suave-60">
                Confiança {p.confianca}
              </p>
            )}
          </div>
          <p className="mt-1.5 text-3xl font-bold tracking-tight text-uai-tinta">
            {p.atendidas === null ? '—' : milhar(p.atendidas)}
          </p>
          <p className="mt-1 text-sm text-uai-suave-60">
            {p.atendidas === null
              ? 'você não carregou nada que enxergue esses bairros'
              : 'pessoas que as equipes alcançariam, se a leitura estiver certa'}
          </p>

          {/* "Tempo médio" saiu: média de dois trajetos independentes não
              ajuda a decidir nada, e os minutos de cada equipe já estão acima.
              Equipe na base só aparece quando existe uma. */}
          {p.equipesOciosas > 0 && (
            <p className="mt-3 rounded-uai-xl bg-uai-superficie p-3 text-sm text-uai-tinta">
              {p.equipesOciosas === 2
                ? 'As duas equipes estão sem destino.'
                : 'Uma equipe está sem destino e fica na base.'}
            </p>
          )}
        </div>

        {empateEscolhido && (
          <p className="mt-4 rounded-uai-xl border-l-4 border-uai-alerta bg-uai-superficie p-3.5 text-sm leading-snug text-uai-tinta">
            <strong>
              As duas equipes vão para bairros empatados:{' '}
              {empateEscolhido
                .filter((x) => escolhidos.includes(x.chave))
                .map((x) => x.nome)
                .join(' e ')}
              .
            </strong>{' '}
            Os dados não dizem qual dos dois tem mais gente. Se você escolheu pelo número da tabela,
            escolheu por uma diferença que não existe.
          </p>
        )}

        {/* Os avisos de rota já aparecem na linha da equipe. Repeti-los aqui
            embaixo enchia o painel com a mesma frase duas vezes. */}
        {outrosAvisos.length > 0 && (
          <ul className="mt-3 grid gap-1.5 rounded-uai-xl bg-uai-superficie p-3.5 text-sm leading-snug text-uai-tinta">
            {outrosAvisos.map((a) => (
              <li key={a}>! {a}</li>
            ))}
          </ul>
        )}

        {faltam && (
          <p className="mt-4 rounded-uai-xl border-l-4 border-uai-alerta bg-uai-superficie p-3.5 text-sm leading-snug text-uai-tinta">
            <strong>{AVISO_FALTA_JUSTIFICAR}</strong> Não há resposta certa aqui — o que vale é o
            que te fez decidir de verdade.
          </p>
        )}

        {/* O envio acontece AQUI. Este painel era só de leitura — "duas portas
            para a mesma ação irreversível" — mas desde que justificar virou
            obrigatório, o botão de enviar do rodapé ABRE este painel; e mandar o
            estudante fechar para clicar em Enviar de novo era exigir dois cliques
            onde a intenção é uma só. O botão só libera com tudo respondido, e o
            irreversível está escrito acima dele, não num parágrafo que ninguém
            lê até o fim. */}
      </Modal.Body>

      {/* Rodapé FIXO ao pé do painel: o conteúdo acima rola, o botão não sai
          de vista. Num laptop de 800 px de altura ele ficava abaixo da dobra
          do modal, e o estudante tinha que descobrir que o popup rolava. */}
      <Modal.Footer className="sticky bottom-0 !flex-col !items-stretch gap-2 border-t border-uai-borda bg-uai-fundo">
        {onEnviar && (
          <>
            {!faltam && (
              <p className="text-center text-xs font-semibold text-uai-alerta">
                Depois de enviar não dá para mudar
              </p>
            )}
            <Button variant="secondary" block onClick={onEnviar} disabled={ocupado || faltam}>
              Enviar equipes
            </Button>
          </>
        )}
        <Button
          variant={onEnviar ? 'ghost' : 'secondary'}
          block
          onClick={onFechar}
          disabled={ocupado}
        >
          {onEnviar ? 'Voltar para a conversa' : 'Fechar'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
