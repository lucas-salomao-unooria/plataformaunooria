import { useEffect, useState } from "react";
import {
  AlertBox,
  Avatar,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Logo,
  PuzzleBlock,
  PuzzleTrack,
  ScrollBar,
  Tag,
} from "@edu/ui/ds";
import {
  MS_POR_MENSAGEM_DO_ROBO,
  VAGAS_DO_ROBO,
  encaixar,
  montagemDe,
  roboDaMontagem,
  tirar,
  type BlocoTocado,
  type MontagemDoRobo,
  type VagaDoRobo,
} from "../lib/regras";
import { TEXTOS } from "../lib/textos";
import type { Bloco, Ligacao, Robo, RoboDoEstudante, RoboMontado } from "../lib/tipos";

/**
 * As telas da CASCA Unooria — quem fala é a escola, e só ela (`@edu/ui/ds`, a
 * seção `unooria`, tema claro; nada de `--unc-*`, nada do clone).
 *
 * A fronteira cruza UMA vez, no fim: do convite ao alerta do grupo é o
 * mensageiro; o robô do grupo e "Missão Concluída" são a escola. O robô sai do
 * mensageiro porque o desafio não é sobre o grupo da turma: é o grupo da
 * FAMÍLIA do tio, e montar o robô dentro do clone o devolveria para dentro da
 * ficção que a missão acabou de desmontar.
 *
 * A rolagem é o `ScrollBar` do DS: aqui a seção É a `unooria`, e a regra das
 * duas famílias (que tira o `ScrollBar` do clone) vale ao contrário.
 */

function Casca({ children }: { children: React.ReactNode }) {
  return (
    <ScrollBar className="escola" height="100%" autoHide theme="light">
      <div className="escola__pilha">
        <Logo size="sm" className="escola__marca" />
        {children}
      </div>
    </ScrollBar>
  );
}

/** A fala da Nina na casca: um card com o rosto dela, não um balão do app. */
function FalaDaNina({ texto }: { texto: string }) {
  return (
    <Card variant="outlined">
      {/* `icon`, e não `avatar`: o `CardHeader` declara `avatar` no tipo mas
          não o desenha (a prop cai no `<div>` como atributo). */}
      <CardHeader icon={<Avatar name={TEXTOS.lista.nina} size="sm" />} title={TEXTOS.lista.nina} />
      <CardContent>
        <p className="escola__fala">{texto}</p>
      </CardContent>
    </Card>
  );
}

/** O conteúdo de um bloco: o ícone (decorativo, fora do nome acessível) e o rótulo. */
function RotuloDoBloco({ icone, rotulo }: { icone: string; rotulo: string }) {
  return (
    <>
      <span aria-hidden="true">{icone}</span> {rotulo}
    </>
  );
}

/** A tela do robô alterna entre MONTAR e LIGADO (a simulação da última ligação). */
type Modo = "montagem" | "ligado";

// ───────────────────────────── E6-ALU-01: o robô do grupo (EF05CO04)

/**
 * O desafio do tio: montar o robô com blocos, ligá-lo e ver o que ele faz com
 * quatro mensagens, uma a uma.
 *
 * **Só toques, como o Montador da Chave da exp04ef1b** (`PuzzleBlock` e
 * `PuzzleTrack` do DS): o toque num bloco da bandeja o encaixa na vaga dele
 * (o laço na 1ª, a condição no SE, a ação na primeira vaga de ação livre); o
 * toque num bloco encaixado o devolve. O laço NÃO vem montado: sem ele o robô
 * só olha a primeira mensagem, e a tela não explica por quê.
 *
 * Quem executa o robô é o SERVIDOR: a tela só anima o resultado da ligação,
 * mensagem a mensagem, em texto e ícone neutros (sem cor de certo ou errado).
 * Enviar sem ligar é permitido; enviar é definitivo e fecha a missão.
 */
export function TelaDoRobo({
  tio,
  laco,
  condicoes,
  acoes,
  robo,
  limite,
  falha,
  ocupado,
  aoLigar,
  aoEnviar,
}: {
  tio: string;
  laco: { rotulo: string; icone: string };
  condicoes: Bloco[];
  acoes: Bloco[];
  robo: RoboDoEstudante | null;
  /** Ligações possíveis (`limites.ligacoes`). */
  limite: number;
  /** `rede` = o último envio não chegou. */
  falha: "rede" | null;
  ocupado: boolean;
  aoLigar: (robo: Robo) => void;
  aoEnviar: (robo: Robo) => void;
}) {
  const ligacoes = robo?.ligacoes ?? [];
  /* Um F5 volta ao último robô ligado. */
  const [montagem, setMontagem] = useState<MontagemDoRobo>(() => montagemDe(ligacoes.at(-1) ?? null));
  const [modo, setModo] = useState<Modo>("montagem");
  const [ligacoesVistas, setLigacoesVistas] = useState(ligacoes.length);

  /* Uma ligação nova chegou do servidor: a tela vira a simulação dela. */
  if (ligacoes.length !== ligacoesVistas) {
    setLigacoesVistas(ligacoes.length);
    if (ligacoes.length > ligacoesVistas) setModo("ligado");
  }

  const montado = roboDaMontagem(montagem);
  const podeLigar = robo?.podeLigar ?? true;
  const ultima = ligacoes.at(-1);

  if (modo === "ligado" && ultima) {
    return (
      <Casca>
        <h1 className="escola__titulo">{TEXTOS.robo.ligado(ligacoes.length, limite)}</h1>
        <SimulacaoDoRobo ligacao={ultima} robo={robo} condicoes={condicoes} chave={ligacoes.length} />
        {falha === "rede" && <AlertBox variant="error" device="mobile" theme="light" description={TEXTOS.erros.naoEnviou} />}
        <Button variant="secondary" size="lg" fullWidth disabled={ocupado} onClick={() => setModo("montagem")}>
          {TEXTOS.robo.mudar}
        </Button>
        <Button variant="primary" size="lg" fullWidth disabled={ocupado} isLoading={ocupado} onClick={() => aoEnviar(ultima)}>
          {TEXTOS.robo.enviar}
        </Button>
      </Casca>
    );
  }

  const blocoDa = (vaga: VagaDoRobo): { icone: string; rotulo: string } | null => {
    if (vaga === "laco") return montagem.laco ? laco : null;
    const id = montagem[vaga];
    const lista = vaga === "condicao" ? condicoes : acoes;
    return id ? (lista.find((b) => b.id === id) ?? null) : null;
  };

  const vagas = VAGAS_DO_ROBO.map((vaga) => {
    const bloco = blocoDa(vaga);
    if (!bloco) return null;
    return (
      <div className="robo__vaga">
        <p className="robo__legenda">{TEXTOS.robo.vagas[vaga]}</p>
        <PuzzleBlock
          label={<RotuloDoBloco icone={bloco.icone} rotulo={bloco.rotulo} />}
          state="placed"
          disabled={ocupado}
          onClick={() => setMontagem((m) => tirar(m, vaga))}
        />
      </div>
    );
  });

  const tocar = (b: BlocoTocado) => setMontagem((m) => encaixar(m, b));
  const acoesCheias = Boolean(montagem.acao1 && montagem.acao2);
  const usada = (id: string) => montagem.acao1 === id || montagem.acao2 === id;
  const status = montado
    ? TEXTOS.robo.pronto
    : TEXTOS.robo.vagaVazia(
        TEXTOS.robo.vagas[montagem.condicao ? "acao1" : "condicao"],
        TEXTOS.robo.vazias[montagem.condicao ? "acao1" : "condicao"],
      );

  return (
    <Casca>
      <h1 className="escola__titulo">{TEXTOS.robo.etapa}</h1>
      <FalaDaNina texto={tio} />
      <p className="escola__comando">{TEXTOS.robo.comando}</p>

      <PuzzleTrack
        label={TEXTOS.robo.cabeca}
        slots={vagas}
        status={status}
        emptySlotLabel={(i) => {
          const vaga = VAGAS_DO_ROBO[i] ?? "condicao";
          return TEXTOS.robo.vagaVazia(TEXTOS.robo.vagas[vaga], TEXTOS.robo.vazias[vaga]);
        }}
        aria-busy={ocupado || undefined}
      />

      <h2 className="robo__bandeja-titulo">{TEXTOS.robo.blocos}</h2>
      <section className="robo__grupo" aria-label={TEXTOS.robo.repeticao}>
        <p className="robo__grupo-titulo">{TEXTOS.robo.repeticao}</p>
        <PuzzleBlock
          label={<RotuloDoBloco icone={laco.icone} rotulo={laco.rotulo} />}
          state="idle"
          disabled={ocupado || montagem.laco}
          aria-pressed={montagem.laco}
          onClick={() => tocar({ tipo: "laco" })}
        />
      </section>
      <section className="robo__grupo" aria-label={TEXTOS.robo.condicoes}>
        <p className="robo__grupo-titulo">{TEXTOS.robo.condicoes}</p>
        <ul className="robo__bandeja">
          {condicoes.map((c) => (
            <li key={c.id}>
              <PuzzleBlock
                label={<RotuloDoBloco icone={c.icone} rotulo={c.rotulo} />}
                state="idle"
                disabled={ocupado}
                aria-pressed={montagem.condicao === c.id}
                onClick={() => tocar({ tipo: "condicao", id: c.id })}
              />
            </li>
          ))}
        </ul>
      </section>
      <section className="robo__grupo" aria-label={TEXTOS.robo.acoes}>
        <p className="robo__grupo-titulo">{TEXTOS.robo.acoes}</p>
        <ul className="robo__bandeja">
          {acoes.map((a) => (
            <li key={a.id}>
              <PuzzleBlock
                label={<RotuloDoBloco icone={a.icone} rotulo={a.rotulo} />}
                state="idle"
                disabled={ocupado || usada(a.id) || acoesCheias}
                aria-pressed={usada(a.id)}
                onClick={() => tocar({ tipo: "acao", id: a.id })}
              />
            </li>
          ))}
        </ul>
      </section>

      {falha === "rede" && <AlertBox variant="error" device="mobile" theme="light" description={TEXTOS.erros.naoEnviou} />}

      {podeLigar ? (
        <>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={!montado || ocupado}
            isLoading={ocupado}
            onClick={() => montado && aoLigar(montado)}
          >
            {TEXTOS.robo.ligar}
          </Button>
          {!montado && <p className="escola__apoio">{TEXTOS.robo.faltaParaLigar}</p>}
        </>
      ) : (
        <p className="escola__apoio">{TEXTOS.robo.semLigacoes}</p>
      )}
      {/* Enviar sem ligar é permitido (fica "em processo" no máximo). */}
      <Button
        variant="secondary"
        size="lg"
        fullWidth
        disabled={!montado || ocupado}
        onClick={() => montado && aoEnviar(montado)}
      >
        {TEXTOS.robo.enviar}
      </Button>
    </Casca>
  );
}

/**
 * O robô ligado: as quatro mensagens chegando, uma a uma, cada uma com os
 * sinais ABERTOS embaixo e o que o robô fez. O servidor já executou tudo; a
 * tela só revela em sequência (com `prefers-reduced-motion`, tudo de uma vez).
 */
function SimulacaoDoRobo({
  ligacao,
  robo,
  condicoes,
  chave,
}: {
  ligacao: Ligacao;
  robo: RoboDoEstudante | null;
  condicoes: Bloco[];
  /** Muda a cada ligação: a animação recomeça. */
  chave: number;
}) {
  const mensagens = robo?.mensagens ?? [];
  const total = mensagens.length;
  const [chegaram, setChegaram] = useState(() => {
    const semMovimento = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    return semMovimento ? total : 1;
  });

  useEffect(() => {
    if (chegaram >= total) return;
    const id = window.setTimeout(() => setChegaram((n) => n + 1), MS_POR_MENSAGEM_DO_ROBO);
    return () => window.clearTimeout(id);
  }, [chegaram, total, chave]);

  const terminou = chegaram >= total;
  const sinal = (id: string) => condicoes.find((c) => c.id === id);

  return (
    <>
      <p className="escola__apoio" role="status">
        {terminou ? ligacao.resumo : TEXTOS.robo.chegando}
      </p>
      {mensagens.map((m, i) => {
        const resultado = ligacao.resultados.find((r) => r.mensagemId === m.id);
        if (i >= chegaram) {
          return (
            <Card variant="outlined" key={m.id} className="robo__mensagem robo__mensagem--chegando">
              <CardContent>
                <CardDescription>{TEXTOS.robo.aguardando}</CardDescription>
              </CardContent>
            </Card>
          );
        }
        const olhando = i === chegaram - 1 && !terminou;
        return (
          <Card variant="outlined" key={m.id} className="robo__mensagem">
            <CardHeader>
              {/* O remetente do áudio já chega com a duração, como o Figma o desenha. */}
              <CardTitle as="h2">{m.remetente}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="escola__fala">{m.texto}</p>
              <div className="robo__sinais">
                {m.atributos.length === 0 ? (
                  <Tag variant="neutral" size="sm">
                    {TEXTOS.robo.semSinais}
                  </Tag>
                ) : (
                  m.atributos.map((a) => {
                    const c = sinal(a);
                    return (
                      <Tag key={a} variant="neutral" size="sm" leftIcon={<span aria-hidden="true">{c?.icone}</span>}>
                        {c?.rotulo ?? a}
                      </Tag>
                    );
                  })
                )}
              </div>
              <p className="robo__acao">
                <span aria-hidden="true">{TEXTOS.robo.oRobo}</span> {olhando ? TEXTOS.robo.olhando : resultado?.texto}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </>
  );
}

// ─────────────────────────────────────── E6-ALU-02: a missão concluída

/** O card permanente: o robô enviado em blocos, a frase, e o recibo. */
export function TelaConcluida({
  robo,
  laco,
  condicoes,
  acoes,
  encerramento,
}: {
  robo: RoboMontado | null;
  laco: { rotulo: string; icone: string };
  condicoes: Bloco[];
  acoes: Bloco[];
  encerramento: string;
}) {
  const c = TEXTOS.conclusao;
  const blocos = robo
    ? [
        ...(robo.laco ? [{ legenda: TEXTOS.robo.vagas.laco, ...laco }] : []),
        ...[robo.condicao].flatMap((id) => {
          const b = condicoes.find((x) => x.id === id);
          return b ? [{ legenda: TEXTOS.robo.vagas.condicao, icone: b.icone, rotulo: b.rotulo }] : [];
        }),
        ...robo.acoes.flatMap((id, i) => {
          const b = acoes.find((x) => x.id === id);
          return b ? [{ legenda: TEXTOS.robo.vagas[i === 0 ? "acao1" : "acao2"], icone: b.icone, rotulo: b.rotulo }] : [];
        }),
      ]
    : [];
  return (
    <Casca>
      <h1 className="escola__titulo">{c.titulo}</h1>
      {robo && (
        <Card variant="outlined" className="escola__regra">
          <CardHeader>
            <CardTitle as="h2">{c.cardTitulo}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="robo__card">
              {blocos.map((b) => (
                <li key={b.legenda} className="robo__vaga">
                  <p className="robo__legenda">{b.legenda}</p>
                  <PuzzleBlock label={<RotuloDoBloco icone={b.icone} rotulo={b.rotulo} />} state="locked" />
                </li>
              ))}
            </ul>
            <p className="escola__regra-texto">{robo.emPalavras}</p>
            <CardDescription>{c.registrado}</CardDescription>
          </CardContent>
        </Card>
      )}
      <FalaDaNina texto={encerramento} />
      <p className="escola__rodape">{c.rodape}</p>
    </Casca>
  );
}
