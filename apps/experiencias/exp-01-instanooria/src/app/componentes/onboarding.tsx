import { useState } from 'react';

import { experiencia } from '../../lib/api';
import { AVATARES } from '../../lib/avatares';

import { AvatarPerfil } from './avatar-perfil';

/**
 * FASE 1 do doc 02 (~40s): **cartão de missão** + escolha de avatar + splash.
 *
 * A narrativa de "app beta / acesso antecipado / sessões de teste" SAIU. Ela
 * justificava o encerramento, mas dava ao aluno um papel passivo e obrigava a
 * mentir sobre o que o Instanooria é. Agora ele recebe uma missão explícita: o
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
  /** A pergunta que o aluno vai investigar — o enunciado da missão. */
  perguntaChave: string;
  aoEntrar: (avatar: string, nome: string) => Promise<void>;
}) {
  const [etapa, setEtapa] = useState<'boas-vindas' | 'avatar' | 'entrando'>('boas-vindas');
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
        <p className="instanooria-wordmark text-[44px] leading-none">Instanooria</p>
        <p className="text-[13px] text-muted">entrando…</p>
      </main>
    );
  }

  if (etapa === 'avatar') {
    return (
      <main className="flex min-h-dvh flex-col px-6 py-10">
        <div className="flex flex-1 flex-col items-center justify-center gap-6">
          <p className="instanooria-wordmark text-[34px] leading-none">Instanooria</p>
          <p className="text-[15px] text-ink">Monta seu perfil</p>

          {/*
            Grade de 4 colunas com rolagem: 16 figurinhas não cabem numa tela de
            375px sem virar miniatura ilegível. O `aria-label` usa o nome da
            figurinha, não o id — "Capivara", não "avatar-01".
          */}
          <ul
            role="radiogroup"
            aria-label="Escolha sua figurinha"
            className="grid max-h-[42vh] grid-cols-4 gap-4 overflow-y-auto overscroll-contain p-1"
          >
            {AVATARES.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={avatar === item.id}
                  onClick={() => setAvatar(item.id)}
                  aria-label={item.rotulo}
                  className={`rounded-full p-0.5 ${avatar === item.id ? 'ring-2 ring-ink' : ''}`}
                >
                  <AvatarPerfil seed={item.id} tamanho={56} />
                </button>
              </li>
            ))}
          </ul>

          <label className="flex w-full max-w-[300px] flex-col gap-1.5">
            <span className="text-[13px] text-ink/70">Como você quer aparecer</span>
            <input
              type="text"
              value={nome}
              maxLength={40}
              autoComplete="off"
              enterKeyHint="done"
              placeholder="seu nome"
              onChange={(evento) => setNome(evento.target.value)}
              className="h-11 rounded-lg border border-hairline bg-surface px-3 text-[15px] text-ink outline-none focus:border-action"
            />
          </label>

          {erro ? <p className="text-[13px] text-like-texto">{erro}</p> : null}

          <button
            type="button"
            disabled={nome.trim().length === 0}
            className="h-11 w-full max-w-[300px] rounded-lg bg-action text-[15px] font-semibold text-white active:opacity-80 disabled:opacity-40"
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
          </button>
        </div>
      </main>
    );
  }

  /**
   * Sem pergunta não há missão: acontece quando o aluno entra antes de a atividade
   * estar ativa (aparelho ligado cedo, ou o professor ainda revisando). Mostrar o
   * cartão com as aspas vazias — “” — parece defeito, e o botão levaria a um beco:
   * o `POST /api/runs` recusa e o aluno volta para cá sem entender.
   *
   * A espera é dita na língua do app. Nada de "aguarde o professor liberar", que
   * entregaria a escola (regra de ouro 1).
   */
  if (perguntaChave.trim().length === 0) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-5 px-8 text-center">
        <p className="instanooria-wordmark text-[40px] leading-none">Instanooria</p>
        <p className="text-[17px] font-semibold text-ink">Nada rolando por aqui agora</p>
        <p className="text-[15px] leading-relaxed text-ink/70">
          Volta em alguns minutos — a gente avisa quando tiver algo novo.
        </p>
        <button
          type="button"
          className="mt-2 h-11 rounded-lg border border-hairline px-5 text-[14px] font-semibold text-ink active:opacity-70"
          onClick={() => window.location.reload()}
        >
          Atualizar
        </button>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-between px-6 py-12">
      <div className="flex w-full flex-1 flex-col items-center justify-center gap-6 text-center">
        <p className="instanooria-wordmark text-[40px] leading-none">Instanooria</p>

        <div className="flex flex-col gap-4">
          <h1 className="text-[22px] font-semibold text-ink">Sua missão 🔍</h1>
          <p className="text-[15px] leading-relaxed text-ink/80">
            Tem uma discussão rolando no Instanooria:
          </p>
          {/* A pergunta é o enunciado da missão — em destaque, porque é o que o
              aluno vai investigar e o que ele vai responder no fim. */}
          <p className="rounded-xl bg-canvas px-4 py-3 text-[17px] font-semibold leading-snug text-ink">
            “{perguntaChave}”
          </p>
          <p className="text-[15px] leading-relaxed text-ink/80">
            Dá um rolê pelo feed e vê o que as pessoas estão dizendo.
          </p>
          {/*
            A instrução central do fluxo v2. Salvar não é enfeite: os posts salvos
            são o que o aluno vai defender na conversa e o que sustenta a resposta
            dele no fim. Precisa estar dito com essas palavras, e antes do feed.
          */}
          <p className="rounded-xl bg-action/10 px-4 py-3 text-[15px] font-semibold leading-snug text-ink">
            Salva os posts que te ajudarem a responder — no fim você vai usar eles.
          </p>
        </div>

        <button
          type="button"
          className="mt-2 h-11 w-full max-w-[300px] rounded-lg bg-action text-[15px] font-semibold text-white active:opacity-80"
          onClick={() => setEtapa('avatar')}
        >
          Entrar no Instanooria
        </button>

        <p className="text-[12px] text-muted">a missão tem tempo limitado</p>
      </div>

      <footer className="flex flex-col items-center gap-1.5">
        {primeiroNome ? <p className="text-[12px] text-muted">entrando como {primeiroNome}</p> : null}
        {/* Aparelho compartilhado: quem entrou na conta errada precisa poder sair
            antes de começar. A SESSÃO É DO HUB (cookie httpOnly, fora do alcance
            do iframe — e o sandbox não permite navegar o topo): a experiência
            PEDE a saída via `exp:estado { acao: "sair" }` e o hub executa o
            signOut + redirect. No origem isto era um fetch de logout + navegação
            do window.top. */}
        <button
          type="button"
          className="text-[12px] font-semibold text-action active:opacity-60"
          onClick={() => {
            experiencia().enviarEstado({ acao: 'sair' });
          }}
        >
          Trocar de conta
        </button>
      </footer>
    </main>
  );
}
