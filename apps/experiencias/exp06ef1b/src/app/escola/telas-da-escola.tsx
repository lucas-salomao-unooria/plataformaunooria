import { useState, type ReactNode } from "react";
import { AlertBox, Button, Card, CardContent, CardTitle, Logo, RadioGroup, ScrollBar, SectionHeader } from "@edu/ui/ds";
import { comCerquilha } from "../../lib/regras";
import { E5, E6, ESCOLA } from "../../lib/textos";
import type { Cartao, Categoria, PecaDaRegra, RevelacaoDaRegra } from "../../lib/tipos";

/**
 * As telas em que a ESCOLA fala — a seção `unooria`, pela ponte `@edu/ui/ds`.
 *
 * **A fronteira do disfarce é QUEM FALA, não o momento.** Depois da galeria, a
 * missão sai do clone para EXPLICAR: montar a regra que guiou o feed
 * (EF06CO03, ADR-174) é a Unooria mostrando a engrenagem — dentro do app, a explicação
 * voltaria para a ficção que a missão acabou de desmontar. O caso Mariana
 * (E6-ALU-01) também é da Unooria (PRD §10.1): é a transferência para a vida
 * da criança, fora da mostra.
 *
 * A rolagem é o `ScrollBar` do DS: aqui a seção É a `unooria`, e a regra das
 * duas famílias (que tira o `ScrollBar` do clone) vale ao contrário.
 */

function Casca({ children }: { children: ReactNode }) {
  return (
    <ScrollBar className="escola" height="100%" autoHide theme="light">
      <div className="escola__pilha">
        <Logo size="sm" className="escola__marca" />
        {children}
      </div>
    </ScrollBar>
  );
}

// ──────────────────────────────── E5-ALU-01: a regra SE … ENTÃO (EF06CO03)

/** As duas peças de uma regra, numa linha: "SE … ENTÃO …". */
function LinhaDaRegra({ titulo, se, entao }: { titulo: string; se: string; entao: string }) {
  return (
    <Card variant="outlined" theme="light" className="regra__linha">
      <CardContent>
        <CardTitle as="h2" size="sm">
          {titulo}
        </CardTitle>
        <p className="regra__frase">
          <strong>{E5.se}</strong> {se} <strong>{E5.entao}</strong> {entao}
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * E5-ALU-01 — a ponte do Léo (a ÚNICA exclamação da missão) e a REGRA: a
 * criança escolhe a condição (SE) e a ação (ENTÃO) em dois `RadioGroup` da
 * plataforma, com as peças que a api mandou embaralhadas e sem dizer qual é a
 * certa. UMA tentativa: enviada, a tela mostra a regra que ela montou, a que o
 * aplicativo seguiu e o que a regra fez no feed DELA (`revelacao`, da api).
 * Nunca "certo" ou "errado": o nível é do professor (ADR-174).
 */
export function Regra({
  se,
  entao,
  categorias,
  inicial,
  enviada,
  revelacao,
  enviando,
  aoMudar,
  aoEnviar,
  aoContinuar,
}: {
  se: readonly PecaDaRegra[];
  entao: readonly PecaDaRegra[];
  categorias: readonly Categoria[];
  inicial: { se: string | null; entao: string | null };
  enviada: boolean;
  revelacao: RevelacaoDaRegra | null;
  enviando: boolean;
  aoMudar: (escolha: { se: string | null; entao: string | null }) => void;
  aoEnviar: (escolha: { se: string; entao: string }) => void;
  aoContinuar: () => void;
}) {
  const [condicao, setCondicao] = useState<string | null>(
    inicial.se && se.some((p) => p.id === inicial.se) ? inicial.se : null,
  );
  const [acao, setAcao] = useState<string | null>(
    inicial.entao && entao.some((p) => p.id === inicial.entao) ? inicial.entao : null,
  );
  const texto = (lado: readonly PecaDaRegra[], id: string) => lado.find((p) => p.id === id)?.texto ?? "";

  if (enviada) {
    const hashtag = (area: string | null) => comCerquilha(categorias.find((c) => c.area === area)?.hashtag ?? "");
    const contexto = !revelacao
      ? null
      : revelacao.motivo === "curtidas"
        ? E5.revelacao.curtidas(hashtag(revelacao.area))
        : revelacao.motivo === "permanencia"
          ? E5.revelacao.permanencia(hashtag(revelacao.area))
          : E5.revelacao.variado;
    return (
      <Casca>
        <SectionHeader variant="mobile" title={E5.ponteLeo} />
        {revelacao && (
          <>
            <LinhaDaRegra
              titulo={E5.suaRegra}
              se={texto(se, revelacao.escolha.se)}
              entao={texto(entao, revelacao.escolha.entao)}
            />
            <LinhaDaRegra
              titulo={E5.regraCerta}
              se={texto(se, revelacao.certa.se)}
              entao={texto(entao, revelacao.certa.entao)}
            />
          </>
        )}
        {contexto && <AlertBox variant="info" theme="light" device="mobile" title={contexto} />}
        <Button fullWidth onClick={aoContinuar}>
          {E5.avancar}
        </Button>
      </Casca>
    );
  }

  return (
    <Casca>
      <SectionHeader variant="mobile" title={E5.ponteLeo} description={E5.instrucao} />
      <RadioGroup
        name="regra-se"
        label={E5.grupoDoSe}
        theme="light"
        disabled={enviando}
        value={condicao ?? ""}
        options={se.map((p) => ({ value: p.id, label: p.texto }))}
        onChange={(v) => {
          const id = String(v);
          setCondicao(id);
          aoMudar({ se: id, entao: acao });
        }}
      />
      <RadioGroup
        name="regra-entao"
        label={E5.grupoDoEntao}
        theme="light"
        disabled={enviando}
        value={acao ?? ""}
        options={entao.map((p) => ({ value: p.id, label: p.texto }))}
        onChange={(v) => {
          const id = String(v);
          setAcao(id);
          aoMudar({ se: condicao, entao: id });
        }}
      />
      {condicao && acao && <LinhaDaRegra titulo={E5.suaRegra} se={texto(se, condicao)} entao={texto(entao, acao)} />}
      <Button
        fullWidth
        disabled={!condicao || !acao || enviando}
        isLoading={enviando}
        onClick={() => condicao && acao && aoEnviar({ se: condicao, entao: acao })}
      >
        {E5.enviar}
      </Button>
    </Casca>
  );
}

// ─────────────────────────────────── E6-ALU-01: o caso Mariana

/**
 * A transferência: o caso literal (da api) e os cinco cartões apresentados
 * JUNTOS e de forma neutra, em dois `RadioGroup` da plataforma (um de
 * mecanismo, um de atitude). **A tela não diz qual é o certo** — nem depois: a
 * escolha é gravada para o professor e não vira nota. Os ids tocados ficam no
 * `sessionStorage` até "Submeter", para um F5 não apagar a escolha.
 */
export function Mariana({
  caso,
  mecanismos,
  atitudes,
  inicial,
  enviando,
  aoMudar,
  aoRegistrar,
}: {
  caso: string;
  mecanismos: readonly Cartao[];
  atitudes: readonly Cartao[];
  inicial: { mecanismo: string | null; atitude: string | null };
  enviando: boolean;
  aoMudar: (escolha: { mecanismo: string | null; atitude: string | null }) => void;
  aoRegistrar: (mecanismo: string, atitude: string) => void;
}) {
  const [mecanismo, setMecanismo] = useState<string | null>(
    inicial.mecanismo && mecanismos.some((c) => c.id === inicial.mecanismo) ? inicial.mecanismo : null,
  );
  const [atitude, setAtitude] = useState<string | null>(
    inicial.atitude && atitudes.some((c) => c.id === inicial.atitude) ? inicial.atitude : null,
  );

  return (
    <Casca>
      <h1 className="so-leitor">{E6.tituloDaTela}</h1>
      <Card variant="outlined" theme="light">
        <CardContent>
          <p className="mariana__caso">{caso}</p>
        </CardContent>
      </Card>
      <p className="escola__instrucao">{E6.instrucao}</p>
      <RadioGroup
        name="mecanismo"
        label={E6.grupoDoMecanismo}
        theme="light"
        disabled={enviando}
        value={mecanismo ?? ""}
        options={mecanismos.map((c) => ({ value: c.id, label: c.texto }))}
        onChange={(v) => {
          const id = String(v);
          setMecanismo(id);
          aoMudar({ mecanismo: id, atitude });
        }}
      />
      <RadioGroup
        name="atitude"
        label={E6.grupoDaAtitude}
        theme="light"
        disabled={enviando}
        value={atitude ?? ""}
        options={atitudes.map((c) => ({ value: c.id, label: c.texto }))}
        onChange={(v) => {
          const id = String(v);
          setAtitude(id);
          aoMudar({ mecanismo, atitude: id });
        }}
      />
      <Button
        fullWidth
        disabled={!mecanismo || !atitude || enviando}
        isLoading={enviando}
        onClick={() => mecanismo && atitude && aoRegistrar(mecanismo, atitude)}
      >
        {E6.submeter}
      </Button>
    </Casca>
  );
}

// ─────────────────────────────── 403: a missão não está aberta aqui

/**
 * A guarda de liberação (ADR-69), a turma sem atividade em andamento
 * (`atividade-nao-preparada`, ADR-130) ou o interruptor da rede (ADR-87). O SDK
 * não entrega o corpo do erro, e os 403 chegam iguais — a frase serve a todos:
 * a criança não fez nada de errado, e a saída é o professor.
 */
export function Indisponivel() {
  return (
    <div className="escola escola--centrada">
      <AlertBox
        variant="info"
        theme="light"
        device="mobile"
        title={ESCOLA.indisponivelTitulo}
        description={ESCOLA.indisponivelCorpo}
      />
    </div>
  );
}
