import { useState, type ReactNode } from "react";
import { AlertBox, Button, Logo, PuzzleBlock, PuzzleTrack, ScrollBar, SectionHeader } from "@edu/ui/ds";
import { tocarNoBloco } from "../../lib/regras";
import { E5, ESCOLA } from "../../lib/textos";
import type { BlocoDaCadeia } from "../../lib/tipos";

/**
 * As telas em que a ESCOLA fala — a seção `unooria`, pela ponte `@edu/ui/ds`.
 *
 * **A fronteira do disfarce é QUEM FALA, não o momento.** Depois da galeria, a
 * missão sai do clone para EXPLICAR: montar a cadeia que controlou o feed
 * (EF06CO03) é a Unooria mostrando a engrenagem — dentro do app, a explicação voltaria para a
 * ficção que a missão acabou de desmontar. O caso Mariana e a consulta voltam
 * ao clone (é a comissão quem pergunta).
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
 * apoio — nunca qual vaga errou, nunca um "errado".
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
        completeLabel={certa}
        status={errou || certo ? "" : E5.preenchidas(ordem.length, vagas)}
      />
      {certo ? (
        <Button fullWidth onClick={aoContinuar}>
          {E5.continuar}
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

/**
 * A tela da cadeia abre com a frase do Léo — a ÚNICA exclamação da missão —,
 * que até a 0.1.x ficava no topo dos pacotes. O pedido do PO tirou a tela dos
 * pacotes (a EF06CO07 saiu da missão), e a ponte com o livro didático continua
 * no primeiro momento em que a Unooria mostra a engrenagem.
 */

export function Cadeia({
  blocos,
  ordemInicial,
  enviando,
  aoMudarOrdem,
  aoConferir,
  aoContinuar,
}: {
  blocos: readonly BlocoDaCadeia[];
  ordemInicial: readonly string[];
  enviando: boolean;
  aoMudarOrdem: (ordem: string[]) => void;
  aoConferir: (ordem: string[]) => Promise<boolean | null>;
  aoContinuar: () => void;
}) {
  return (
    <Casca>
      <SectionHeader variant="mobile" title={E5.ponteLeo} description={E5.cadeiaInstrucao} />
      <Calha
        bandeja={E5.bandejaDaCadeia}
        calha={E5.calhaDaCadeia}
        confirmar={E5.validar}
        errada={E5.cadeiaErrada}
        certa={E5.cadeiaCerta}
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
