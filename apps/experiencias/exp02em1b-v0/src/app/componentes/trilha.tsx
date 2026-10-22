import { Icon, SidebarRow, WebSidebar } from '@edu/ui/ds-unooriaai';
import { PASSOS, type Passo } from '../../lib/tipos';
import { ROTULO_PASSO } from '../../lib/textos';

/**
 * Voltar é permitido: reler a Orientação no meio da Investigação é legítimo. O
 * que voltar NÃO faz é devolver relógio. Espelho de `regras/passos.ts` — quem
 * recusa de verdade é a api, com `passo-invalido`.
 */
function podeIr(de: Passo, para: Passo): boolean {
  const i = PASSOS.indexOf(de);
  const j = PASSOS.indexOf(para);
  if (i < 0 || j < 0) return false;
  if (j < i) return true;
  return j === i + 1;
}

/**
 * A Orientação virou painel dentro do Briefing (como-funciona.tsx): continua
 * sendo um Passo no banco, mas não tem tela própria e não aparece aqui.
 */
const VISIVEIS = PASSOS.filter((p) => p !== 'orientacao');

/**
 * Barra lateral da Missão — o `WebSidebar` da seção `unooriaai`.
 *
 * ESTA É A RÉGUA DO CLIENTE WEB, e não a da página de design system. A seção
 * publica as duas, e a regra é que uma nunca substitui a outra: `WebSidebar`
 * tem 282px e fundo transparente separado por um fio; `Sidebar` tem 260px e
 * superfície própria. `SidebarRow` tem 48px, raio 12 e ícone de 24; `NavItem`
 * tem 36px e raio 8.
 *
 * Antes esta tela usava `Sidebar` + `NavItem`, que é a régua de documentação.
 * A do cliente web é o que faz a Missão parecer o assistente de conversa que o
 * estudante abre fora da aula — e é isso que a Missão inteira está ensinando.
 *
 * Os Passos entram como as conversas entram na barra de um cliente de conversa
 * (`chatText`), e Recomeçar entra no rodapé com `trash`, onde esses clientes
 * põem "Limpar conversas".
 *
 * Colapsável porque a Investigação precisa de largura: o mapa e a conversa
 * disputam a tela, e a trilha é orientação, não trabalho. Colapsada, mantém os
 * números — o estudante continua sabendo onde está. A largura é a única medida
 * sobrescrita, e por comportamento do produto, não por gosto.
 */
export function Trilha({
  passo,
  aberta,
  onAlternar,
  onIr,
  onRecomecar,
  ocupado = false,
}: {
  passo: Passo;
  aberta: boolean;
  onAlternar: () => void;
  onIr: (para: Passo) => void;
  /** Recomeçar a Missão. Ausente fora da Investigação: não há o que apagar. */
  onRecomecar: (() => void) | null;
  ocupado?: boolean;
}) {
  const indice = Math.max(0, VISIVEIS.indexOf(passo === 'orientacao' ? 'abertura' : passo));
  const pct = Math.round(((indice + 1) / VISIVEIS.length) * 100);

  return (
    <WebSidebar height="100%" aria-label="Passos da Missão" className={aberta ? '' : '!w-[76px]'}>
      <WebSidebar.Section>
        {/* Progresso. O cliente web não tem barra de progresso — um assistente
            de conversa não tem o que medir. Esta é do produto, montada só com
            token do pacote. */}
        <div className={`px-3 pb-2 ${aberta ? '' : 'px-0 text-center'}`}>
          <p className="text-xs font-semibold tabular-nums text-uai-tinta">
            {indice + 1}/{VISIVEIS.length}
          </p>
          {aberta && (
            <>
              <p className="mt-0.5 text-xs text-uai-suave-60">Missão 3: Tempestade</p>
              <span className="mt-2 block h-1 w-full overflow-hidden rounded-uai-full bg-uai-fill-8">
                <span
                  className="block h-full rounded-uai-full bg-uai-destaque transition-all"
                  style={{ width: `${pct}%` }}
                />
              </span>
            </>
          )}
        </div>

        {VISIVEIS.map((p) => {
          const atual = p === passo;
          const alcancavel = podeIr(passo, p) || atual;
          return (
            <SidebarRow
              key={p}
              icon="chatText"
              active={atual}
              title={ROTULO_PASSO[p]}
              disabled={!alcancavel}
              onClick={() => alcancavel && !atual && onIr(p)}
              className={aberta ? '' : '!justify-center !px-0'}
            >
              {aberta ? ROTULO_PASSO[p] : null}
            </SidebarRow>
          );
        })}
      </WebSidebar.Section>

      <WebSidebar.Section bordered>
        {onRecomecar && (
          // `trash` no rodapé é onde e como um cliente de conversa põe "Limpar conversas".
          <SidebarRow
            icon="trash"
            title="Recomeçar a Missão"
            disabled={ocupado}
            onClick={onRecomecar}
            className={aberta ? '' : '!justify-center !px-0'}
          >
            {aberta ? 'Recomeçar' : null}
          </SidebarRow>
        )}

        {/* Recolher. A seção não publica este controle, e o registro dela não
            tem seta de painel. Em vez de desenhar uma (proibido pelo DS, §7.4),
            a seta é o `arrowForward` PUBLICADO, girado pelo próprio `Icon`
            (`rotate`): glifo do pacote, sentido dado pela prop. */}
        <SidebarRow
          iconNode={<Icon name="arrowForward" size={24} rotate={aberta ? 180 : 0} aria-hidden />}
          onClick={onAlternar}
          aria-label={aberta ? 'Recolher os passos' : 'Expandir os passos'}
          aria-expanded={aberta}
          className={aberta ? '' : '!justify-center !px-0'}
        >
          {aberta ? 'Recolher' : null}
        </SidebarRow>
      </WebSidebar.Section>
    </WebSidebar>
  );
}
