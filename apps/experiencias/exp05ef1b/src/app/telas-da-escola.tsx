import { useState } from "react";
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
  ScrollBar,
  Selection,
} from "@edu/ui/ds";
import { acoesDaRegra, regraMontada } from "../lib/regras";
import { TEXTOS } from "../lib/textos";
import type { Opcao, Regra, RegraDoEstudante } from "../lib/tipos";

/**
 * As telas da CASCA Unooria — quem fala é a escola, e só ela (`@edu/ui/ds`, a
 * seção `unooria`, tema claro; nada de `--unc-*`, nada do clone).
 *
 * A fronteira cruza UMA vez, no fim: do convite ao cartão de frases é o
 * mensageiro; o desafio do tio e "Missão Concluída" são a escola. O desafio
 * sai do mensageiro porque não é sobre o grupo da turma: é o grupo da FAMÍLIA
 * do tio, e montar a regra dentro do clone a devolveria para dentro da ficção
 * que a missão acabou de desmontar.
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

const SEM_DEPOIS = "";

// ───────────────────────────── E6-ALU-01: a regra do tio (EF05CO04)

/**
 * O desafio do tio: montar a regra com peças, PREVER o que ela faz com o
 * áudio, testar e enviar.
 *
 * A previsão é a simulação que a habilidade pede — por isso ela vem ANTES do
 * resultado, e se apaga depois de cada teste: o teste seguinte pede uma
 * previsão nova. O resultado diz o que a regra FEZ, nunca "certo" ou
 * "errado", e cada teste aparece num card neutro (sem cor de acerto). Enviar
 * sem testar é permitido.
 *
 * O que cada peça faz com o áudio não está aqui: a tela tem só os rótulos, e
 * quem simula a regra de verdade é o servidor.
 */
export function TelaDaRegra({
  tio,
  condicoes,
  acoes,
  previsoes,
  regra,
  falha,
  ocupado,
  aoTestar,
  aoEnviar,
}: {
  tio: string;
  condicoes: Opcao[];
  acoes: Opcao[];
  previsoes: Opcao[];
  regra: RegraDoEstudante | null;
  /** `rede` = o último envio não chegou. */
  falha: "rede" | null;
  ocupado: boolean;
  aoTestar: (regra: Regra, previsao: string) => void;
  aoEnviar: (regra: Regra) => void;
}) {
  const [condicao, setCondicao] = useState<string | null>(null);
  const [acao1, setAcao1] = useState<string | null>(null);
  const [acao2, setAcao2] = useState<string>(SEM_DEPOIS);
  const [previsao, setPrevisao] = useState<string | null>(null);
  const [testesVistos, setTestesVistos] = useState(regra?.testes.length ?? 0);

  const testes = regra?.testes ?? [];
  /* Um teste novo chegou: a previsão seguinte é outra (prever de novo é simular de novo). */
  if (testes.length !== testesVistos) {
    setTestesVistos(testes.length);
    setPrevisao(null);
  }

  const montada = regraMontada(condicao, acao1);
  const atual = (): Regra | null => (condicao && acao1 ? { condicao, acoes: acoesDaRegra(acao1, acao2 || null) } : null);
  const rotuloDaPrevisao = (id: string) => previsoes.find((p) => p.id === id)?.rotulo ?? "";
  const podeTestar = regra?.podeTestar ?? true;

  return (
    <Casca>
      <h1 className="escola__titulo">{TEXTOS.regra.titulo}</h1>
      <FalaDaNina texto={tio} />

      <p className="escola__comando">{TEXTOS.regra.comando}</p>

      <Selection
        label={TEXTOS.regra.se}
        options={condicoes.map((c) => ({ value: c.id, label: c.rotulo }))}
        value={condicao ?? undefined}
        onChange={(v) => setCondicao(typeof v === "string" ? v : (v[0] ?? null))}
        showOptionCheckbox={false}
        disabled={ocupado}
      />
      <Selection
        label={TEXTOS.regra.entao}
        options={acoes.map((a) => ({ value: a.id, label: a.rotulo }))}
        value={acao1 ?? undefined}
        onChange={(v) => setAcao1(typeof v === "string" ? v : (v[0] ?? null))}
        showOptionCheckbox={false}
        disabled={ocupado}
      />
      <Selection
        label={TEXTOS.regra.depois}
        options={[
          { value: SEM_DEPOIS, label: TEXTOS.regra.semDepois },
          ...acoes.filter((a) => a.id !== acao1).map((a) => ({ value: a.id, label: a.rotulo })),
        ]}
        value={acao2}
        onChange={(v) => setAcao2(typeof v === "string" ? v : (v[0] ?? SEM_DEPOIS))}
        showOptionCheckbox={false}
        disabled={ocupado}
      />

      {podeTestar ? (
        <>
          <Selection
            label={TEXTOS.regra.previsao}
            options={previsoes.map((p) => ({ value: p.id, label: p.rotulo }))}
            value={previsao ?? undefined}
            onChange={(v) => setPrevisao(typeof v === "string" ? v : (v[0] ?? null))}
            showOptionCheckbox={false}
            disabled={ocupado}
          />
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            disabled={!montada || !previsao || ocupado}
            onClick={() => {
              const r = atual();
              if (r && previsao) aoTestar(r, previsao);
            }}
          >
            {TEXTOS.regra.testar}
          </Button>
          {(!montada || !previsao) && <p className="escola__apoio">{TEXTOS.regra.testePendente}</p>}
        </>
      ) : (
        <p className="escola__apoio">{TEXTOS.regra.testesEsgotados}</p>
      )}

      {testes.map((t, i) => (
        <Card variant="outlined" key={i} className="escola__teste">
          <CardHeader>
            <CardTitle as="h2">{TEXTOS.regra.teste(i + 1)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="escola__regra-texto">{t.emPalavras}</p>
            <p>{TEXTOS.regra.voceDisse(rotuloDaPrevisao(t.previsao))}</p>
            <CardDescription>{t.resultado}</CardDescription>
          </CardContent>
        </Card>
      ))}

      {falha === "rede" && <AlertBox variant="error" device="mobile" theme="light" description={TEXTOS.erros.naoEnviou} />}

      <Button
        variant="primary"
        size="lg"
        fullWidth
        disabled={!montada || ocupado}
        isLoading={ocupado}
        onClick={() => {
          const r = atual();
          if (r) aoEnviar(r);
        }}
      >
        {TEXTOS.regra.enviar}
      </Button>
    </Casca>
  );
}

// ─────────────────────────────────────── E6-ALU-02: a missão concluída

export function TelaConcluida({ regra, encerramento }: { regra: string | null; encerramento: string }) {
  const c = TEXTOS.conclusao;
  return (
    <Casca>
      <h1 className="escola__titulo">{c.titulo}</h1>
      {regra && (
        <Card variant="outlined" className="escola__regra">
          <CardHeader>
            <CardTitle as="h2">{c.cardTitulo}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="escola__regra-texto">{regra}</p>
          </CardContent>
        </Card>
      )}
      <FalaDaNina texto={encerramento} />
      <p className="escola__rodape">{c.rodape}</p>
    </Casca>
  );
}
