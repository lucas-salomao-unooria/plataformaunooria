import { SidebarRow, WebSidebar, gptGlyphs } from '@edu/ui/ds-chatgpt';
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
 * Barra lateral da Missão — o `WebSidebar` do módulo `chatgpt`.
 *
 * ESTA É A RÉGUA DO CLIENTE WEB, e não a da página de design system. O pacote
 * publica as duas, medidas de páginas diferentes do mesmo arquivo Figma, e a
 * regra é que uma nunca substitui a outra: `WebSidebar` tem 282px e fundo
 * transparente separado por um fio; `Sidebar` tem 260px e superfície própria.
 * `SidebarRow` tem 48px, raio 12 e ícone VETORIAL de 24; `NavItem` tem 36px,
 * raio 8 e glifo tipográfico de 14.
 *
 * Antes esta tela usava `Sidebar` + `NavItem`, que é a régua de documentação.
 * Trocar para a do cliente web é o que faz a Missão parecer o ChatGPT que o
 * aluno abre fora da aula — e é isso que a Missão inteira está ensinando.
 *
 * Os Passos entram como as conversas entram na barra do arquivo (`chatText`),
 * e Recomeçar entra no rodapé com `trash`, que é exatamente onde e como o
 * arquivo põe "Clear conversations".
 *
 * Colapsável porque a Investigação precisa de largura: o mapa e a conversa
 * disputam a tela, e a trilha é orientação, não trabalho. Colapsada, mantém os
 * números — o aluno continua sabendo onde está. A largura é a única medida
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
        {/* Progresso. O cliente web não tem barra de progresso — o ChatGPT não
            tem o que medir. Esta é do produto, montada só com token do pacote. */}
        <div className={`px-3 pb-2 ${aberta ? '' : 'px-0 text-center'}`}>
          <p className="text-xs font-semibold tabular-nums text-gpt-tinta">
            {indice + 1}/{VISIVEIS.length}
          </p>
          {aberta && (
            <>
              <p className="mt-0.5 text-xs text-gpt-suave-60">Missão 3: Tempestade</p>
              <span className="mt-2 block h-1 w-full overflow-hidden rounded-gpt-full bg-gpt-fill-8">
                <span
                  className="block h-full rounded-gpt-full bg-gpt-destaque transition-all"
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
          // `trash` no rodapé é onde e como o arquivo põe "Clear conversations".
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

        {/* Recolher. O arquivo não publica este controle, e a iconografia dele
            tem 13 vetores — nenhum é uma seta de painel. Em vez de desenhar um
            (proibido pelo DS, §7.4), a seta é o glifo PUBLICADO `→`, girado por
            CSS: símbolo do arquivo, sentido dado pela folha de estilo. */}
        <SidebarRow
          iconNode={
            <span
              aria-hidden
              className={`inline-block text-lg leading-none ${aberta ? 'rotate-180' : ''}`}
            >
              {gptGlyphs.arrowRight}
            </span>
          }
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
