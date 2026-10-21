import { useEffect, useState } from 'react';

import { ButtonUnv, Chip } from '@edu/ui/ds-unoovista';

import { api } from '../../lib/api';
import type { OpcaoDoRaioX, RaioXDaApi } from '../../lib/canal-a';

import { PostCard, type AcoesDoPost } from './post-card';

/**
 * O 6a — RAIO-X DO FEED (EF08CO11, ADR-167), logo depois da resposta à
 * pergunta-chave e ANTES do debate e da revelação.
 *
 * Ainda é o disfarce: a tela é do Unoovista (`ds-unoovista`) e não pode falar
 * de algoritmo, bolha nem lado inicial (regra de ouro 1). O estudante vê os 6
 * posts que ele mesmo viu, um de cada vez, e diz o que cada um FAZ.
 *
 * Sem devolutiva aqui: o envio só diz "enviado". De onde cada post veio
 * aparece DENTRO da revelação, na ponte (`revelacao.tsx`). A composição, o
 * gabarito e a régua são da api — o aparelho nem sabe o lado dos posts.
 */
const SEM_ACOES: AcoesDoPost = {
  aoCurtir: () => undefined,
  aoSalvar: () => undefined,
  aoSeguir: () => undefined,
  aoAbrirComentarios: () => undefined,
  aoCompartilhar: () => undefined,
  aoAbrirOpcoes: () => undefined,
  aoAbrirPerfil: () => undefined,
  registrarElemento: () => undefined,
  aoGesto: () => undefined,
};

export function RaioX({
  runId,
  aoEnviar,
  embutido = false,
}: {
  runId: string;
  /** Depois do envio: quem chama relê a situação das tarefas. */
  aoEnviar: () => void;
  /** Dentro da tela da resposta (sem a camada que cobre a tela). */
  embutido?: boolean;
}) {
  const [dados, setDados] = useState<RaioXDaApi | null>(null);
  const [indice, setIndice] = useState(0);
  const [respostas, setRespostas] = useState<Record<string, OpcaoDoRaioX>>({});
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    api
      .get<RaioXDaApi>(`/runs/${runId}/raio-x`)
      .then((corpo) => {
        if (!ativo) return;
        setDados(corpo);
        if (corpo.situacao === 'enviada') setEnviado(true);
      })
      .catch(() => ativo && setErro('Não deu pra abrir agora. Tenta de novo daqui a pouco.'));
    return () => {
      ativo = false;
    };
  }, [runId]);

  const posts = dados?.posts ?? [];
  const post = posts[indice];
  const escolhida = post ? respostas[post.id] : undefined;
  const ultimo = indice === posts.length - 1;

  async function enviar() {
    setEnviando(true);
    setErro(null);
    try {
      await api.post(`/runs/${runId}/raio-x`, { respostas });
      setEnviado(true);
      aoEnviar();
    } catch {
      setErro('Não deu pra enviar agora. Toca de novo.');
    } finally {
      setEnviando(false);
    }
  }

  const corpo = (
    <div className="mx-auto flex w-full max-w-[340px] flex-col gap-4">
      <header className="flex flex-col gap-1.5">
        <h2 className="text-[18px] font-semibold leading-snug text-ink">
          Antes da conversa: de cada post abaixo, o que ele faz?
        </h2>
        {!enviado && posts.length > 0 ? (
          <p className="text-[13px] text-muted">
            post {indice + 1} de {posts.length}
          </p>
        ) : null}
      </header>

      {enviado ? (
        <div className="flex flex-col gap-1 rounded-cartao bg-surface px-4 py-3" role="status">
          <p className="text-[14px] font-semibold text-ink">Enviado.</p>
          <p className="text-[13px] leading-snug text-ink/70">Agora é só esperar a conversa começar.</p>
        </div>
      ) : post && dados ? (
        <>
          <PostCard post={post} acoes={SEM_ACOES} curtido={false} salvo={false} seguindo={false} />

          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">O que este post faz?</legend>
            {(
              [
                { valor: 'A', rotulo: `puxa para ${dados.rotulos.A}` },
                { valor: 'B', rotulo: `puxa para ${dados.rotulos.B}` },
                { valor: 'neutro', rotulo: 'informa sem tomar lado' },
              ] as const
            ).map((opcao) => (
              /* O `Chip` do Unoovista com papel de rádio, como na resposta. */
              <Chip
                key={opcao.valor}
                role="radio"
                aria-checked={escolhida === opcao.valor}
                selected={escolhida === opcao.valor}
                disabled={enviando}
                onClick={() => setRespostas((atual) => ({ ...atual, [post.id]: opcao.valor }))}
                className="w-full"
              >
                {opcao.rotulo}
              </Chip>
            ))}
          </fieldset>

          <div className="flex gap-2">
            {indice > 0 ? (
              <ButtonUnv variant="secondary" disabled={enviando} onClick={() => setIndice(indice - 1)}>
                Voltar
              </ButtonUnv>
            ) : null}
            <ButtonUnv
              variant="primary"
              block
              disabled={!escolhida || enviando}
              onClick={() => (ultimo ? void enviar() : setIndice(indice + 1))}
            >
              {ultimo ? (enviando ? 'Enviando…' : 'Enviar') : 'Próximo'}
            </ButtonUnv>
          </div>
        </>
      ) : !erro ? (
        <p className="text-[14px] text-muted">abrindo…</p>
      ) : null}

      {erro ? <p className="text-[13px] text-like-texto">{erro}</p> : null}
    </div>
  );

  if (embutido) return <section aria-label="Raio-x do feed" className="flex flex-col gap-4 pt-2">{corpo}</section>;

  return (
    <div className="fixed inset-0 z-[85] flex flex-col overflow-y-auto overscroll-contain bg-canvas px-5 py-8">{corpo}</div>
  );
}
