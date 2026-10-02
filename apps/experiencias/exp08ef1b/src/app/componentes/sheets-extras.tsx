import { useState } from 'react';

import { ButtonUnv, ListItem, SnackbarUnv } from '@edu/ui/ds-unoovista';

import type { FeedPostCliente } from '../../lib/tipos';

import { AvatarPerfil } from './avatar-perfil';
import { Sheet } from './sheet';

const CONTATOS = [
  '@bia.sq', '@dudu.alves', '@vitoria__m', '@leo.pires', '@sofi.rodrigues',
  '@caio.mtz', '@helo.dias', '@nina.rocha', '@theo.lm', '@ju.barros',
];

/**
 * A lista da folha encosta nas bordas, como no Storybook do DS: o corpo da
 * folha tem a calha (`--unv-gutter`) e a `ListItem` já traz o próprio recuo.
 */
const LISTA_SEM_CALHA = 'm-0 list-none p-0 [margin-inline:calc(var(--unv-gutter)*-1)]';

/** Sheet "Compartilhar" (doc 03 §3.3): enviar só faz toast — e conta sinal. */
export function CompartilharSheet({
  post,
  aoFechar,
  aoEnviar,
}: {
  post: FeedPostCliente | null;
  aoFechar: () => void;
  aoEnviar: (post: FeedPostCliente) => void;
}) {
  const [enviados, setEnviados] = useState<Set<string>>(new Set());
  if (!post) return null;

  return (
    <Sheet aberto aoFechar={aoFechar} altura="60%" titulo="Compartilhar">
      <ul className={LISTA_SEM_CALHA}>
        {CONTATOS.map((contato) => {
          const enviado = enviados.has(contato);
          return (
            <li key={contato}>
              <ListItem
                size="md"
                leading={<AvatarPerfil seed={contato} tamanho={40} />}
                title={contato.replace(/^@/, '')}
                trailing={
                  <ButtonUnv
                    variant={enviado ? 'secondary' : 'primary'}
                    size="sm"
                    disabled={enviado}
                    onClick={() => {
                      if (enviado) return;
                      setEnviados((atual) => new Set(atual).add(contato));
                      aoEnviar(post);
                    }}
                  >
                    {enviado ? 'Enviado' : 'Enviar'}
                  </ButtonUnv>
                }
              />
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}

/** Sheet do ⋯ — "Não tenho interesse" e "Denunciar" são sinais negativos reais. */
export function OpcoesSheet({
  post,
  aoFechar,
  aoNaoInteressa,
  aoDenunciar,
}: {
  post: FeedPostCliente | null;
  aoFechar: () => void;
  aoNaoInteressa: (post: FeedPostCliente) => void;
  aoDenunciar: (post: FeedPostCliente) => void;
}) {
  if (!post) return null;

  return (
    <Sheet aberto aoFechar={aoFechar} altura="auto" rotulo="Opções da publicação">
      <ul className={LISTA_SEM_CALHA}>
        {[
          { rotulo: 'Não tenho interesse', acao: () => aoNaoInteressa(post), perigo: false },
          { rotulo: 'Denunciar', acao: () => aoDenunciar(post), perigo: true },
          { rotulo: 'Copiar link', acao: aoFechar, perigo: false },
          { rotulo: 'Cancelar', acao: aoFechar, perigo: false },
        ].map((item) => (
          <li key={item.rotulo}>
            <ListItem
              size="sm"
              title={item.perigo ? <span className="text-like">{item.rotulo}</span> : item.rotulo}
              onClick={() => {
                item.acao();
                aoFechar();
              }}
            />
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

/**
 * Aviso curto, na gramática do app (nada de vocabulário de exercício): o
 * `Snackbar` do Unoovista. Ele flutua sobre o contêiner posicionado mais
 * próximo — aqui, uma camada `fixed` da coluna do aparelho, que não intercepta
 * toque — e já fica acima da doca de navegação por padrão.
 */
export function Toast({ mensagem }: { mensagem: string | null }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-[70] mx-auto w-full max-w-phone">
      <SnackbarUnv open={mensagem !== null} message={mensagem ?? ''} />
    </div>
  );
}
