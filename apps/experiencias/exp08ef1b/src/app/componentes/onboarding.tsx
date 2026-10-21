import { useEffect, useRef, useState } from 'react';

import { ButtonUnv, LogoUnv, TextFieldUnv } from '@edu/ui/ds-unoovista';

import { api, experiencia } from '../../lib/api';
import type { TermosDaEntradaDaApi } from '../../lib/canal-a';
import { AVATARES } from '../../lib/avatares';

import { AvatarPerfil } from './avatar-perfil';

/**
 * FASE 1 do doc 02 (~40s): **cartão de missão** + escolha de avatar + splash.
 *
 * A narrativa de "app beta / acesso antecipado / sessões de teste" SAIU. Ela
 * justificava o encerramento, mas dava ao estudante um papel passivo e obrigava a
 * mentir sobre o que o Unoovista é. Agora ele recebe uma missão explícita: o
 * que fica escondido é o **mecanismo**, não a existência da atividade.
 *
 * ZERO instrução de comportamento — nada de "curta", "comente", "interaja",
 * "siga". A missão é investigar e concluir; mais nada (regra de ouro 3).
 */
export function Onboarding({
  primeiroNome,
  perguntaChave,
  aoEntrar,
}: {
  primeiroNome: string;
  /** A pergunta que o estudante vai investigar — o enunciado da missão. */
  perguntaChave: string;
  aoEntrar: (avatar: string, nome: string) => Promise<void>;
}) {
  const [etapa, setEtapa] = useState<'boas-vindas' | 'termos' | 'avatar' | 'entrando'>('boas-vindas');
  const [avatar, setAvatar] = useState(AVATARES[0]!.id);
  /**
   * O nome que aparece no aparelho. Pode ser apelido — o que importa é ele se
   * reconhecer ali. A identificação para o professor vem do login, não daqui.
   */
  const [nome, setNome] = useState(primeiroNome ?? '');
  const [erro, setErro] = useState<string | null>(null);

  if (etapa === 'entrando') {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4">
        <LogoUnv height={40} title="Unoovista" />
        <p className="text-[13px] text-muted">entrando…</p>
      </main>
    );
  }

  if (etapa === 'termos') {
    return <TermosDeUso aoAceitar={() => setEtapa('avatar')} />;
  }

  if (etapa === 'avatar') {
    return (
      <main className="flex min-h-dvh flex-col px-6 py-10">
        <div className="flex flex-1 flex-col items-center justify-center gap-6">
          <LogoUnv height={30} title="Unoovista" />
          <p className="text-[15px] text-ink">Monta seu perfil</p>

          {/*
            Grade de 4 colunas com rolagem: 16 figurinhas não cabem numa tela de
            375px sem virar miniatura ilegível. O `aria-label` usa o nome da
            figurinha, não o id — "Capivara", não "avatar-01".
          */}
          {/* `div`, não `ul`: com `role="radiogroup"` a lista perde o papel e os
              `li` ficavam órfãos (WCAG 1.3.1, ADR-162). */}
          <div
            role="radiogroup"
            aria-label="Escolha sua figurinha"
            className="grid max-h-[42vh] grid-cols-4 gap-4 overflow-y-auto overscroll-contain p-1"
          >
            {AVATARES.map((item) => (
              <div key={item.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={avatar === item.id}
                  onClick={() => setAvatar(item.id)}
                  aria-label={item.rotulo}
                  className={`rounded-full p-0.5 ${avatar === item.id ? 'ring-[3px] ring-action' : ''}`}
                >
                  <AvatarPerfil seed={item.id} tamanho={56} />
                </button>
              </div>
            ))}
          </div>

          <TextFieldUnv
            block
            className="w-full max-w-[300px]"
            label="Como você quer aparecer"
            value={nome}
            maxLength={40}
            autoComplete="off"
            enterKeyHint="done"
            placeholder="seu nome"
            onChange={(evento) => setNome(evento.target.value)}
          />

          {erro ? <p className="text-[13px] text-like-texto">{erro}</p> : null}

          <ButtonUnv
            block
            size="lg"
            className="max-w-[300px]"
            disabled={nome.trim().length === 0}
            onClick={async () => {
              setErro(null);
              setEtapa('entrando');
              try {
                await aoEntrar(avatar, nome.trim());
              } catch {
                setErro('Não deu pra entrar agora. Tenta de novo.');
                setEtapa('avatar');
              }
            }}
          >
            Salvar e entrar
          </ButtonUnv>
        </div>
      </main>
    );
  }

  /**
   * Sem pergunta não há missão: acontece quando o estudante entra antes de a atividade
   * estar ativa (aparelho ligado cedo, ou o professor ainda revisando). Mostrar o
   * cartão com as aspas vazias — “” — parece defeito, e o botão levaria a um beco:
   * o `POST /api/runs` recusa e o estudante volta para cá sem entender.
   *
   * A espera é dita na língua do app. Nada de "aguarde o professor liberar", que
   * entregaria a escola (regra de ouro 1).
   */
  if (perguntaChave.trim().length === 0) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-5 px-8 text-center">
        <LogoUnv height={36} title="Unoovista" />
        <p className="text-[17px] font-semibold text-ink">Nada rolando por aqui agora</p>
        <p className="text-[15px] leading-relaxed text-ink/70">
          Volta em alguns minutos — a gente avisa quando tiver algo novo.
        </p>
        <ButtonUnv variant="secondary" size="lg" className="mt-2" onClick={() => window.location.reload()}>
          Atualizar
        </ButtonUnv>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-between px-6 py-12">
      <div className="flex w-full flex-1 flex-col items-center justify-center gap-6 text-center">
        <LogoUnv height={36} title="Unoovista" />

        <div className="flex flex-col gap-4">
          <h1 className="text-[22px] font-semibold text-ink">Sua missão 🔍</h1>
          <p className="text-[15px] leading-relaxed text-ink/80">
            Tem uma discussão rolando no Unoovista:
          </p>
          {/* A pergunta é o enunciado da missão — em destaque, porque é o que o
              estudante vai investigar e o que ele vai responder no fim. */}
          <p className="rounded-cartao bg-surface px-4 py-3 text-[17px] font-semibold leading-snug text-ink">
            “{perguntaChave}”
          </p>
          <p className="text-[15px] leading-relaxed text-ink/80">
            Dá um rolê pelo feed e vê o que as pessoas estão dizendo.
          </p>
          {/*
            A instrução central do fluxo v2. Salvar não é enfeite: os posts salvos
            são o que o estudante vai defender na conversa e o que sustenta a resposta
            dele no fim. Precisa estar dito com essas palavras, e antes do feed.
          */}
          <p className="rounded-cartao bg-canvasAlt px-4 py-3 text-[15px] font-semibold leading-snug text-ink">
            Salva os posts que te ajudarem a responder — no fim você vai usar eles.
          </p>
        </div>

        <ButtonUnv block size="lg" className="mt-2 max-w-[300px]" onClick={() => setEtapa('termos')}>
          Entrar no Unoovista
        </ButtonUnv>

        {/*
              Aqui dizia "a missão tem tempo limitado", e não existe cronômetro
              nenhum no produto: quem abre e fecha cada momento é o professor,
              pelo botão. A frase criava pressa onde não havia relógio, e a
              pressa muda o que a atividade mede — um estudante apressado rola mais
              rápido, e o dwell é o sinal central do motor.
            */}
            <p className="text-[12px] text-muted">quem abre cada etapa é quem está conduzindo a aula</p>
      </div>

      <footer className="flex flex-col items-center gap-1.5">
        {primeiroNome ? <p className="text-[12px] text-muted">entrando como {primeiroNome}</p> : null}
        {/* Aparelho compartilhado: quem entrou na conta errada precisa poder sair
            antes de começar. A SESSÃO É DO HUB (cookie httpOnly, fora do alcance
            do iframe — e o sandbox não permite navegar o topo): a experiência
            PEDE a saída via `exp:estado { acao: "sair" }` e o hub executa o
            signOut + redirect. No origem isto era um fetch de logout + navegação
            do window.top. */}
        <ButtonUnv
          variant="link"
          size="sm"
          onClick={() => {
            experiencia().enviarEstado({ acao: 'sair' });
          }}
        >
          Trocar de conta
        </ButtonUnv>
      </footer>
    </main>
  );
}

/**
 * OS TERMOS DE USO NA ENTRADA (EF08CO09, ADR-179) — o pedido do PO validado com
 * a pedagogia em 2026-10-21. É o que um app real mostra no cadastro: texto
 * jurídico denso, sem resumo nem destaque, e um botão grande "Aceitar e
 * continuar". O caminho mais fácil é pular, e é esse o comportamento
 * esperado: as 5 regras do 6b estão enterradas no texto, e só depois da
 * revelação o estudante volta a elas (`tarefas-pos-revelacao.tsx`).
 *
 * O texto vem da api (`GET /runs/termos-de-uso`), a mesma fonte das cláusulas
 * do 6b — as palavras são as mesmas nas duas telas. Não mede nada aqui: só a
 * telemetria registra quanto tempo a tela ficou aberta. Se a api falhar, o
 * botão continua: a entrada nunca fica presa nos termos.
 */
function TermosDeUso({ aoAceitar }: { aoAceitar: () => void }) {
  const [paragrafos, setParagrafos] = useState<string[] | null>(null);
  const abertaEm = useRef(Date.now());

  useEffect(() => {
    let ativo = true;
    api
      .get<TermosDaEntradaDaApi>('/runs/termos-de-uso')
      .then((corpo) => ativo && setParagrafos(corpo.paragrafos))
      .catch(() => ativo && setParagrafos([]));
    return () => {
      ativo = false;
    };
  }, []);

  return (
    /* Altura FIXA da tela (não `min-h`): o texto rola dentro da caixa dele, e o
       botão fica sempre à vista, grande — é ele que o PO quer que puxe o clique. */
    <main className="flex h-dvh flex-col px-5 py-6">
      <div className="flex shrink-0 flex-col items-center gap-2 pb-3">
        <LogoUnv height={26} title="Unoovista" />
        <h1 className="text-[15px] font-semibold text-ink">Termos de Uso e Política de Privacidade</h1>
      </div>

      {/* Texto corrido e miúdo, como nos termos de verdade: a densidade é o
          ponto. Rolagem do sistema, sem `ScrollBar` — estamos dentro do clone. */}
      <section
        aria-label="Termos de uso do Unoovista"
        className="min-h-0 flex-1 overflow-y-auto rounded-cartao bg-surface px-4 py-3 text-justify text-[11px] leading-[1.45] text-ink/70"
      >
        {paragrafos === null ? (
          <p className="text-muted">carregando…</p>
        ) : (
          paragrafos.map((p, i) => (
            <p key={i} className="mb-2">
              {p}
            </p>
          ))
        )}
      </section>

      <ButtonUnv
        block
        size="lg"
        className="mt-4 shrink-0"
        onClick={() => {
          experiencia().track('interacted', 'termos-de-uso', {
            resultado: { segundosNaTela: Math.round((Date.now() - abertaEm.current) / 1000) },
          });
          aoAceitar();
        }}
      >
        Aceitar e continuar
      </ButtonUnv>
    </main>
  );
}

