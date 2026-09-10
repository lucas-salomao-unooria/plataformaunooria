import { Card, ScrollBar } from '@edu/ui/ds';
import { LinkButton } from '@/components/link-button';
import type { ResumoDeAtividade } from '@/lib/analise-tipos';
import { apiDoServidor } from '@/lib/api-servidor';
import { auth } from '@/lib/auth';

import { SeletorDeEscola } from './seletor-de-escola';

/**
 * Nível de produto (doc 11 §5): a Unooria olhando se a ATIVIDADE funciona — não
 * se a turma aprendeu. É a comparação entre turmas que responde o que uma turma
 * só nunca responde: o efeito é do desenho ou daquela sala?
 */
export default async function AnalisePage({
  searchParams,
}: {
  searchParams: Promise<{ escolaId?: string }>;
}) {
  /**
   * O middleware garante SESSÃO, não o papel: `areaDoPathname('/analise')` é a
   * mesma área do gestor (`/admin/usuarios`), então ele não é redirecionado
   * daqui. Quem recusa é a api — `AnaliseController` é `@Roles("gestor_contrato")`
   * —, e o `apiDoServidor` converte o 403 em `null`: o gestor que digitar a URL
   * vê a casca e nenhum dado. A tranca de verdade é a segunda (ADR-54, §7).
   */
  const session = await auth();
  const usuario = session!.usuario;

  /**
   * A escola vem da URL. `gestor_contrato` é a única exceção cross-escola da
   * regra 1 e carrega `escolaId` VAZIO no token, então a api exige `?escolaId=`
   * (ver `SeletorDeEscola`). Sem escola escolhida a tela mostra só o seletor —
   * nada de "sem escola = todas".
   */
  const { escolaId } = await searchParams;
  const escola = escolaId?.trim() ?? '';
  const resposta = escola
    ? await apiDoServidor<{ atividades: ResumoDeAtividade[] }>(
        `/analise/resumo?escolaId=${encodeURIComponent(escola)}`,
      )
    : null;
  const atividades = resposta?.atividades ?? [];
  const comRuns = atividades.filter((atividade) => atividade.runs > 0);

  const pct = (valor: number | null) => (valor === null ? '—' : `${Math.round(valor * 100)}%`);
  const minutos = (ms: number | null) =>
    ms === null ? '—' : `${Math.floor(ms / 60_000)}min${String(Math.round((ms % 60_000) / 1000)).padStart(2, '0')}s`;

  return (
    // Fontes, superfície, header, largura da coluna e trilha vêm da casca da
    // área (`layout.tsx`).
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-[12px] uppercase tracking-widest text-unooria-neutral-500">
          análise de produto
        </p>
        <h1 className="text-[24px] font-bold leading-tight text-unooria-neutral-950">
          Envolvimento e eficácia entre turmas
        </h1>
        <p className="max-w-3xl text-[14px] leading-relaxed text-unooria-neutral-700">
          Olá, {usuario.nome}. As métricas são recalculadas dos eventos a cada visita — nada
          aqui é número gravado que ninguém sabe mais como foi computado.
        </p>
      </header>

      <SeletorDeEscola escolaId={escola} />

      {escola === '' ? (
        <Card variant="elevated">
          <p className="text-[14px] text-unooria-neutral-700">
            Escolha a escola acima. Cada contrato tem várias, e a comparação entre turmas só faz
            sentido dentro de uma delas.
          </p>
        </Card>
      ) : resposta === null ? (
        <Card variant="elevated">
          <p className="text-[14px] text-unooria-neutral-700">
            Não conseguimos abrir a análise desta escola. Confira o id e tente de novo.
          </p>
        </Card>
      ) : comRuns.length === 0 ? (
        <Card variant="elevated">
          <p className="text-[14px] text-unooria-neutral-700">
            Nenhuma atividade com sessão de estudante ainda. As métricas aparecem depois da primeira
            turma rodar.
          </p>
        </Card>
      ) : (
        <Card variant="elevated">
          <ScrollBar orientation="both" autoHide className="tabela-rolavel">
            <table className="w-full min-w-[1000px] border-collapse text-left">
              <thead className="bg-unooria-neutral-100">
                <tr className="text-[12px] text-unooria-neutral-700">
                  <th className="px-3 py-2 font-semibold">Atividade</th>
                  <th className="px-3 py-2 font-semibold">Sessões</th>
                  <th className="px-3 py-2 font-semibold">Envolvimento</th>
                  <th className="px-3 py-2 font-semibold">Tempo de feed</th>
                  <th className="px-3 py-2 font-semibold">Inversão</th>
                  <th className="px-3 py-2 font-semibold">Poder do viés</th>
                  <th className="px-3 py-2 font-semibold">Achou a busca</th>
                  <th className="px-3 py-2 font-semibold">Conteúdo morto</th>
                  <th className="px-3 py-2 font-semibold">Imagens ok</th>
                  <th className="px-3 py-2 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {comRuns.map((atividade) => (
                  <tr
                    key={atividade.id}
                    className="border-t border-unooria-neutral-200 text-[13px]"
                  >
                    <td className="px-3 py-2">
                      <span className="font-semibold text-unooria-neutral-950">
                        {atividade.titulo}
                      </span>
                      <span className="block text-[11px] text-unooria-neutral-500">
                        {atividade.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-unooria-neutral-800">
                      {atividade.runs}
                      <span className="text-[11px] text-unooria-neutral-500">
                        {' '}
                        ({atividade.concluidas} concl.)
                      </span>
                    </td>
                    <td className="px-3 py-2 text-unooria-neutral-800">
                      {atividade.imersao.media ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-unooria-neutral-800">
                      {minutos(atividade.tempoMedioDeFeedMs)}
                    </td>
                    <td className="px-3 py-2 text-unooria-neutral-800">
                      {pct(atividade.taxaDeInversao)}
                    </td>
                    <td className="px-3 py-2 font-semibold text-unooria-neutral-900">
                      {pct(atividade.poderDoViesSemeado)}
                    </td>
                    <td className="px-3 py-2 text-unooria-neutral-800">
                      {pct(atividade.descobertaDaBusca)}
                    </td>
                    <td className="px-3 py-2 text-unooria-neutral-800">
                      {pct(atividade.conteudoMorto.fracao)}
                      <span className="text-[11px] text-unooria-neutral-500">
                        {' '}
                        ({atividade.conteudoMorto.posts}/{atividade.conteudoMorto.total})
                      </span>
                    </td>
                    <td className="px-3 py-2 text-unooria-neutral-800">
                      {pct(atividade.taxaDeImagensOk)}
                    </td>
                    <td className="px-3 py-2">
                      <LinkButton
                        href={`/analise/atividades/${atividade.id}?escolaId=${encodeURIComponent(
                          escola,
                        )}`}
                        variant="secondary"
                        size="sm"
                      >
                        Abrir
                      </LinkButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollBar>
        </Card>
      )}

      <Card variant="elevated">
        <div className="flex flex-col gap-2">
          <h2 className="text-[16px] font-semibold text-unooria-neutral-950">
            Como ler estas colunas
          </h2>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-[13px] leading-relaxed text-unooria-neutral-700">
            <li>
              <strong>Poder do viés</strong> = P(conclusão escrita = lado em que o feed nasceu). É o
              efeito que a atividade quer demonstrar; perto de 50% significa que o viés semeado não
              previu nada.
            </li>
            <li>
              <strong>Inversão</strong> é o contrapeso: se for 0%, o viés virou determinismo e o
              exercício passa a ensinar o oposto da mensagem.
            </li>
            <li>
              <strong>Achou a busca</strong> mede quantos descobriram sozinhos a saída que ninguém
              apontou.
            </li>
            <li>
              <strong>Conteúdo morto</strong> são posts aprovados que nenhum estudante recebeu — geração
              paga e não usada.
            </li>
            <li>
              O envolvimento só conta sessões com 8 posts ou mais, e nunca aparece sem os cinco componentes
              (abra a atividade).
            </li>
          </ul>
        </div>
      </Card>
    </div>
  );
}
