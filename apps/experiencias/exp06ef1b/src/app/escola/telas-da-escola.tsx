import { useState, type ReactNode } from "react";
import {
  AlertBox,
  Button,
  Card,
  CardContent,
  CardTitle,
  Logo,
  PuzzleBlock,
  PuzzleTrack,
  RadioGroup,
  ScrollBar,
  SectionHeader,
  Tag,
} from "@edu/ui/ds";
import { tocarNoBloco } from "../../lib/regras";
import { E5, E6, ESCOLA } from "../../lib/textos";
import type { BlocoDaCadeia, Cartao, Categoria, Historico, ParSimulado } from "../../lib/tipos";

/**
 * As telas em que a ESCOLA fala — a seção `unooria`, pela ponte `@edu/ui/ds`.
 *
 * **A fronteira do disfarce é QUEM FALA, não o momento.** Depois da galeria, a
 * missão sai do clone para EXPLICAR: montar a cadeia que controlou o feed
 * (EF06CO03) é a Unooria mostrando a engrenagem — dentro do app, a explicação
 * voltaria para a ficção que a missão acabou de desmontar. O caso Mariana
 * (E6-ALU-01) também é da Unooria (PRD §10.1): é a transferência para a vida
 * da criança, fora da mostra. A consulta nos Stories volta ao clone.
 *
 * A rolagem é o `ScrollBar` do DS: aqui a seção É a `unooria`, e a regra das
 * duas famílias (que tira o `ScrollBar` do clone) vale ao contrário. A calha é
 * o `PuzzleTrack` com os `PuzzleBlock` do Jornal da Escola: TOQUE SEQUENCIAL,
 * sem arrastar — tocar na bandeja encaixa na próxima vaga, tocar na vaga
 * devolve.
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

interface ItemDaCalha {
  id: string;
  rotulo: string;
  descricao?: string;
  icone: string;
}

/**
 * A calha da cadeia. Quem diz se a ordem está certa é o SERVIDOR (os ids
 * são opacos e a ordem certa nunca desce); na errada, os blocos voltam para a
 * bandeja com o aviso escrito do DS ("Voltou para a bandeja") e a frase de
 * apoio — nunca qual vaga errou, nunca um "errado". A errada chega como o
 * **422 `ordem-incorreta`** da api, e a tentativa conta para a EF06CO03.
 */
function Calha({
  bandeja,
  calha,
  confirmar,
  errada,
  certa,
  itens,
  ordemInicial,
  enviando,
  aoMudarOrdem,
  aoConferir,
  aoContinuar,
}: {
  bandeja: string;
  calha: string;
  confirmar: string;
  errada: string;
  certa: string;
  itens: readonly ItemDaCalha[];
  ordemInicial: readonly string[];
  enviando: boolean;
  aoMudarOrdem: (ordem: string[]) => void;
  aoConferir: (ordem: string[]) => Promise<boolean | null>;
  aoContinuar: () => void;
}) {
  const vagas = itens.length;
  const [ordem, setOrdem] = useState<string[]>(() => [...ordemInicial]);
  const [devolvidos, setDevolvidos] = useState<ReadonlySet<string>>(new Set());
  const [errou, setErrou] = useState(false);
  const [certo, setCerto] = useState(false);
  const porId = new Map(itens.map((i) => [i.id, i]));
  const naBandeja = itens.filter((i) => !ordem.includes(i.id));

  function tocar(id: string) {
    if (certo || enviando) return;
    const nova = tocarNoBloco(ordem, id, vagas);
    setOrdem(nova);
    setDevolvidos(new Set());
    setErrou(false);
    aoMudarOrdem(nova);
  }

  async function conferir() {
    const resultado = await aoConferir(ordem);
    if (resultado === true) {
      setCerto(true);
      return;
    }
    if (resultado === false) {
      setDevolvidos(new Set(ordem));
      setOrdem([]);
      setErrou(true);
      aoMudarOrdem([]);
    }
  }

  const bloco = (i: ItemDaCalha, estado: "idle" | "placed" | "returned" | "locked") => (
    <PuzzleBlock
      key={i.id}
      label={i.rotulo}
      description={i.descricao}
      icon={i.icone}
      state={estado}
      returnedLabel={E5.voltou}
      theme="light"
      onClick={() => tocar(i.id)}
    />
  );

  return (
    <>
      {/* A frase de apoio da errada, À VISTA e acima da bandeja (a linha de status
          da calha fica abaixo da dobra). Ela é a região anunciada: a calha fica
          sem status nesse instante, para o leitor de tela não ouvir duas vezes. */}
      {errou && <AlertBox variant="info" theme="light" device="mobile" title={errada} />}
      {certo && <AlertBox variant="success" theme="light" device="mobile" title={certa} />}
      {naBandeja.length > 0 && (
        <section className="calha__bandeja" aria-label={bandeja}>
          <p className="escola__rotulo">{bandeja}</p>
          {naBandeja.map((i) => bloco(i, devolvidos.has(i.id) ? "returned" : "idle"))}
        </section>
      )}
      <PuzzleTrack
        label={calha}
        theme="light"
        slots={Array.from({ length: vagas }, (_, k) => {
          const id = ordem[k];
          const item = id ? porId.get(id) : undefined;
          return item ? bloco(item, certo ? "locked" : "placed") : null;
        })}
        emptySlotLabel={E5.vagaVazia}
        complete={certo}
        completeLabel={E5.calha}
        status={errou || certo ? "" : E5.preenchidas(ordem.length, vagas)}
      />
      {certo ? (
        <Button fullWidth onClick={aoContinuar}>
          {E5.avancar}
        </Button>
      ) : (
        <Button fullWidth disabled={ordem.length < vagas || enviando} isLoading={enviando} onClick={() => void conferir()}>
          {confirmar}
        </Button>
      )}
    </>
  );
}

// ──────────────────────────────────── E5-ALU-01: a cadeia (EF06CO03)

/** Um lado do par simulado: quantas publicações de cada área chegaram, e o tema que mais apareceu. */
function LadoDoPar({ titulo, historico, categorias }: { titulo: string; historico: Historico; categorias: readonly Categoria[] }) {
  const nome = (area: string) => categorias.find((c) => c.area === area)?.nome ?? area;
  return (
    <Card variant="outlined" theme="light" className="par__lado">
      <CardContent>
        <CardTitle as="h3" size="sm">
          {titulo}
        </CardTitle>
        {historico.areaPrincipal && (
          <p className="par__principal">
            {E5.maisVisto}: <Tag>{nome(historico.areaPrincipal)}</Tag>
          </p>
        )}
        <ul className="par__areas">
          {historico.porArea.map((a) => (
            <li key={a.area}>
              <span className="par__area">{nome(a.area)}</span>
              <span className="par__numeros">
                {E5.publicacoes(a.posts)} · {E5.curtidas(a.curtidas)}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/**
 * E5-ALU-01 — a ponte do Léo (a ÚNICA exclamação da missão), a comparação
 * LADO A LADO com o par simulado do servidor (o perfil OPOSTO gerado das áreas
 * reais deste feed — nunca dado de colega, melhoria 7) e a calha dos quatro
 * blocos. Os rótulos dos blocos vêm da api SEM o número da copy ("1. ...",
 * "2. ..."): o número entregaria a ordem, que é o gabarito.
 */
export function Cadeia({
  blocos,
  parSimulado,
  categorias,
  ordemInicial,
  enviando,
  aoMudarOrdem,
  aoConferir,
  aoContinuar,
}: {
  blocos: readonly BlocoDaCadeia[];
  parSimulado: ParSimulado;
  categorias: readonly Categoria[];
  ordemInicial: readonly string[];
  enviando: boolean;
  aoMudarOrdem: (ordem: string[]) => void;
  aoConferir: (ordem: string[]) => Promise<boolean | null>;
  aoContinuar: () => void;
}) {
  return (
    <Casca>
      <SectionHeader variant="mobile" title={E5.ponteLeo} description={E5.comparacao} />
      <div className="par">
        <LadoDoPar titulo={E5.voce} historico={parSimulado.voce} categorias={categorias} />
        <LadoDoPar titulo={E5.outroJurado} historico={parSimulado.outroJurado} categorias={categorias} />
      </div>
      <p className="escola__instrucao">{E5.instrucao}</p>
      <Calha
        bandeja={E5.bandeja}
        calha={E5.calha}
        confirmar={E5.validar}
        errada={E5.erro}
        certa={E5.correta}
        /* O mesmo glifo para os quatro: um ícone por bloco viraria pista da posição. */
        itens={blocos.map((b) => ({ id: b.id, rotulo: b.rotulo, icone: "settings" }))}
        ordemInicial={ordemInicial}
        enviando={enviando}
        aoMudarOrdem={aoMudarOrdem}
        aoConferir={aoConferir}
        aoContinuar={aoContinuar}
      />
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
        value={mecanismo ?? undefined}
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
        value={atitude ?? undefined}
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
