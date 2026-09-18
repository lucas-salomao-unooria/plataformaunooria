"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Button,
  Card,
  Collapse,
  FeedbackAlert,
  RadioGroup,
  Tag,
  TextArea,
  TextField,
} from "@edu/ui/ds";
import {
  ROTULO_DA_VERACIDADE,
  ROTULO_DO_GATILHO,
  type ConteudoDaTurma,
  type Gatilho,
  type MensagemDoLote,
} from "@/lib/quem-mandou-tipos";

/**
 * E0-PROF-01 — a PREPARAÇÃO do grupo da turma, dentro do painel de resultados.
 *
 * Mora AQUI, e não numa rota `/professor/exp-05-quem-mandou-isso/preparar`,
 * pela mesma razão da exp-08: a professora já vem a esta tela para conduzir a
 * aula (é onde estão os dois botões e a folha da turma), o preparo é POR TURMA
 * e o seletor de turma já está no topo, e uma rota nova pediria linha no
 * `middleware.ts` e no registro da trilha.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A EXIGÊNCIA QUE ESTE COMPONENTE EXISTE PARA CUMPRIR: **nada chega aos
 * estudantes sem o clique dela em "Aprovar e publicar"** — e aqui isso é mais
 * forte que nas outras missões, porque a exp-05 NASCE VAZIA. Sem homologação
 * não há lote curado assumindo sozinho: o estudante vê tela de espera. A
 * aprovação não é revisão de um conteúdo que já ia rodar; ela é a porta.
 *
 * Por isso `gerar` NÃO persiste nada: devolve rascunho para os campos, e o que
 * grava é `homologar`. E por isso todo texto é EDITÁVEL — curadoria é poder
 * reescrever, não só concordar. Aprovar sem editar também é curadoria: passou
 * pelos olhos dela.
 *
 * O que NÃO é editável, e a ausência é deliberada: `tipo`, `veracidade` e `tom`
 * de cada posição. Eles são do MOLDE (`MOLDE_DO_LOTE`, na api) e sustentam a
 * simetria formal do lote — o áudio está numa mensagem falsa e a foto numa
 * verdadeira porque "áudio é sempre mentira" seria a heurística que a criança
 * levaria embora. Mexer nisso é mexer no molde, do lado da api, com o teste de
 * paridade junto.
 */
/**
 * OS PISOS DO LOTE, repetidos aqui de propósito.
 *
 * Eles são do `MensagemDoLoteSchema` e do `HomologacaoSchema`
 * (`apps/api/src/quem-mandou-isso/contrato-de-rotas.ts`); a tela só declarava
 * os TETOS, em `maxLength`.
 *
 * COMO FALHAVA: a professora apagava a explicação da 4ª mensagem para
 * reescrever, era interrompida, clicava em "Aprovar e publicar". O Zod recusava
 * o corpo inteiro com `payload-invalido` e a tela imprimia "Não entendi o que
 * veio da tela." — uma frase que não aponta nem mensagem nem campo, sobre um
 * formulário de ~40 campos. Ela relia as oito mensagens procurando o erro
 * enquanto a turma inteira esperava em tela de espera. Vale igual para um
 * `titulo` esvaziado: `.min(1).optional()` recusa `""`.
 *
 * A duplicação é consciente, e o que ela acrescenta NÃO é segurança: quem
 * recusa de verdade continua sendo o Zod da api. O que mora aqui é o
 * APONTAMENTO — qual mensagem, qual campo —, que só a tela sabe onde desenhar.
 * Mudou o piso lá, muda aqui: o número tem de ser o mesmo, e a api é a fonte.
 */
const PISO_DO_TEMA = 10;

const PISO_DO_CAMPO = {
  remetente: 2,
  corpo: 1,
  titulo: 1,
  fonte: 1,
  data: 1,
  explicacao: 5,
} as const;

type CampoComPiso = keyof typeof PISO_DO_CAMPO;

const CAMPOS_COM_PISO = Object.keys(PISO_DO_CAMPO) as CampoComPiso[];

/** O que falta em cada campo, por id de mensagem. Objeto vazio = dá para publicar. */
type ErrosDoLote = Record<string, Partial<Record<CampoComPiso, string>>>;

/**
 * `undefined` é campo que ESTE tipo de mensagem não tem (`fonte` só existe no
 * link, `data` só na ambígua) — não é campo vazio, e cobrar piso dele marcaria
 * de vermelho um campo que nem está na tela.
 */
function faltaNoCampo(valor: string | undefined, piso: number): string | undefined {
  if (valor === undefined) return undefined;
  const limpo = valor.trim();
  if (limpo.length >= piso) return undefined;
  return limpo.length === 0
    ? "Este campo não pode ficar vazio."
    : `Escreva pelo menos ${piso} caracteres.`;
}

function conferirLote(mensagens: MensagemDoLote[]): ErrosDoLote {
  const erros: ErrosDoLote = {};
  for (const m of mensagens) {
    const doCampo: Partial<Record<CampoComPiso, string>> = {};
    for (const campo of CAMPOS_COM_PISO) {
      const falta = faltaNoCampo(m[campo], PISO_DO_CAMPO[campo]);
      if (falta) doCampo[campo] = falta;
    }
    if (Object.keys(doCampo).length > 0) erros[m.id] = doCampo;
  }
  return erros;
}

export function PreparoQuemMandou({
  turmaId,
  inicial,
}: {
  turmaId: string;
  inicial: ConteudoDaTurma;
}) {
  const router = useRouter();
  const [, transicionar] = useTransition();

  const [tema, setTema] = useState(inicial.tema);
  const [gatilho, setGatilho] = useState<Gatilho>(inicial.gatilho);
  const [contextoDaEscola, setContextoDaEscola] = useState("");
  const [pacote, setPacote] = useState(inicial);
  const [gerando, setGerando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const base = `/api/plataforma/quem-mandou-isso/turmas/${encodeURIComponent(turmaId)}`;

  /* A conferência roda a cada tecla, não no clique: o campo fica marcado
     enquanto ela edita, e o botão de publicar só volta quando a tela inteira
     fecha. É o oposto do que havia — descobrir no 400, sem saber onde. */
  const errosDoLote = conferirLote(pacote.mensagens);
  const mensagensComErro = Object.keys(errosDoLote);
  const temaCurto = tema.trim().length < PISO_DO_TEMA;
  const podePublicar = !temaCurto && mensagensComErro.length === 0;

  async function gerar() {
    setGerando(true);
    setErro(null);
    setAviso(null);
    try {
      const r = await fetch(`${base}/gerar-conteudo`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tema, gatilho, contextoDaEscola: contextoDaEscola || undefined }),
      });
      if (!r.ok) {
        const corpo = (await r.json().catch(() => ({}))) as { mensagem?: string };
        setErro(corpo.mensagem ?? "O gerador não respondeu. O lote curado continua disponível.");
        return;
      }
      const novo = (await r.json()) as ConteudoDaTurma;
      setPacote(novo);
      setTema(novo.tema);
      /* A tela DIZ quando a IA não respondeu, em vez de fingir que respondeu.
         O lote curado é homologado pela Unooria — não é remendo —, e a
         professora precisa saber o que está prestes a aprovar. Sem esta frase
         ela aprovaria um texto sobre o intervalo da cantina achando que era
         sobre o tema que acabou de digitar. */
      setAviso(
        novo.usouIa
          ? "Lote gerado. Leia as 8 mensagens antes de aprovar — nada vai aos estudantes sem o seu clique."
          : "Utilizando o lote curado padrão da Unooria. Ele é homologado, tem as 8 mensagens na proporção certa e roda a aula inteira.",
      );
    } catch {
      setErro("A conexão falhou. Tente de novo.");
    } finally {
      setGerando(false);
    }
  }

  async function homologar() {
    setSalvando(true);
    setErro(null);
    try {
      const r = await fetch(`${base}/homologar`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tema,
          gatilho,
          /* A ORIGEM vai como o rascunho a trouxe, sem a tela recalcular nada:
             quando a geração cai no lote curado, a api já devolve `padrao`, e
             recalcular aqui criaria uma segunda regra para a mesma pergunta —
             "a curadoria assistida está sendo usada?" — que diverge na primeira
             vez que uma das duas mudar. */
          origem: pacote.origem,
          mensagens: pacote.mensagens,
        }),
      });
      if (!r.ok) {
        const corpo = (await r.json().catch(() => ({}))) as { mensagem?: string };
        setErro(corpo.mensagem ?? "Não deu para publicar agora.");
        return;
      }
      setAviso("Lote publicado. A turma já pode entrar no grupo.");
      transicionar(() => router.refresh());
    } catch {
      setErro("A conexão falhou. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  function trocar(indice: number, campo: keyof MensagemDoLote, valor: string) {
    setPacote((p) => ({
      ...p,
      mensagens: p.mensagens.map((m, i) => (i === indice ? { ...m, [campo]: valor } : m)),
    }));
  }

  return (
    <Card
      variant="elevated"
      title={
        pacote.aprovadoPorProfessor
          ? "Preparação da missão · lote publicado"
          : "Preparação da missão · a turma ainda não entra"
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-[13px] leading-relaxed text-unooria-neutral-700">
          Escreva o assunto que está circulando na sua escola e escolha o que faz as pessoas
          repassarem sem conferir. As 8 mensagens do grupo são geradas em cima disso, e você edita
          o que quiser antes de publicar.{" "}
          <strong>
            Nenhum texto gerado por inteligência artificial é exibido aos estudantes sem a sua
            aprovação neste painel.
          </strong>
        </p>

        {/* O estado da turma vem antes dos campos: "a missão não abre" é a
            pergunta que chega como chamado, e a resposta precisa estar onde a
            professora olha primeiro. */}
        <p
          className="text-[12px] text-unooria-neutral-600"
          data-publicado={pacote.aprovadoPorProfessor}
        >
          {pacote.aprovadoPorProfessor
            ? "Esta turma já tem lote publicado — os estudantes entram no grupo normalmente."
            : "Esta turma ainda NÃO tem lote publicado. Enquanto não houver, o estudante entra e vê uma tela de espera."}
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="O assunto que está circulando"
            placeholder="ex.: Mudança nas regras do intervalo e da cantina"
            helperText="De 10 a 60 caracteres. É sobre isto que as 8 mensagens falam."
            value={tema}
            maxLength={60}
            error={temaCurto ? `Escreva pelo menos ${PISO_DO_TEMA} caracteres.` : undefined}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTema(e.target.value)}
          />
          <TextField
            label="Um detalhe da sua escola (opcional)"
            placeholder="ex.: a obra da quadra começou na semana passada"
            value={contextoDaEscola}
            maxLength={100}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setContextoDaEscola(e.target.value)
            }
          />
        </div>

        <RadioGroup
          label="O que faz a mensagem ser repassada sem checar"
          helperText="É o tom das mensagens falsas do grupo. As verdadeiras continuam calmas, sempre."
          direction="vertical"
          value={gatilho}
          onChange={(valor) => setGatilho(String(valor) as Gatilho)}
          options={(Object.keys(ROTULO_DO_GATILHO) as Gatilho[]).map((chave) => ({
            value: chave,
            label: ROTULO_DO_GATILHO[chave],
          }))}
        />

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void gerar()}
            isDisabled={gerando || tema.trim().length < 10}
            data-acao="gerar-lote"
          >
            {gerando ? "Gerando…" : "Gerar lote de mensagens com IA"}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => void homologar()}
            isDisabled={salvando || !podePublicar}
            data-acao="aprovar-lote"
          >
            {salvando ? "Publicando…" : "Aprovar e publicar"}
          </Button>
        </div>

        {/* O botão desabilitado sem motivo escrito é o mesmo silêncio de antes,
            um passo mais cedo — e as 8 mensagens ficam num `Collapse` fechado,
            então dizer QUANTAS e onde abrir é o que impede a professora de
            procurar o problema numa tela que não mostra o problema. */}
        {!podePublicar && (
          <p className="text-[12px] leading-snug text-unooria-danger" role="status">
            {temaCurto
              ? `Falta o assunto: escreva pelo menos ${PISO_DO_TEMA} caracteres no campo acima.`
              : `${
                  mensagensComErro.length === 1
                    ? "Uma das 8 mensagens tem"
                    : `${mensagensComErro.length} das 8 mensagens têm`
                } campo vazio ou curto demais. Abra “Ler e editar as 8 mensagens do grupo”: o campo está marcado.`}
          </p>
        )}

        {aviso && <FeedbackAlert type="success" description={aviso} />}
        {erro && <FeedbackAlert type="error" description={erro} />}

        {/*
          As 8 mensagens em `Collapse`, fechado por padrão: são oito textos, e
          abertos eles empurram a barra de prontidão e a folha da turma para
          fora da tela no meio da aula. A armadilha do `Collapse` registrada na
          exp-92 (o conteúdo fechado continua focável) é aceitável aqui porque o
          conteúdo é um formulário do professor — não trinta alvos numa tela de
          criança. Some sozinha quando o pacote publicar a correção.
        */}
        <Collapse title="Ler e editar as 8 mensagens do grupo (só você vê o selo)">
          <div className="flex flex-col gap-5 pt-2">
            {pacote.mensagens.map((m, i) => (
              <div
                key={m.id}
                className="flex flex-col gap-2 rounded-lg border border-unooria-neutral-200 p-3"
                data-mensagem={m.id}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[12px] font-semibold uppercase tracking-wide text-unooria-neutral-500">
                    {i + 1}ª mensagem · {m.tipo}
                  </span>
                  {/* O SELO, e ele é só seu: o estudante só o vê quando você
                      acende o telão. Fica visível aqui porque conduzir a aula
                      sem saber qual é qual é impossível. */}
                  <Tag
                    variant={
                      m.veracidade === "verdadeira"
                        ? "success"
                        : m.veracidade === "falsa"
                          ? "danger"
                          : "warning"
                    }
                    size="sm"
                    pill
                  >
                    {ROTULO_DA_VERACIDADE[m.veracidade]}
                  </Tag>
                  <span className="text-[11px] text-unooria-neutral-500">{m.hora}</span>
                </div>

                <TextField
                  label="Quem manda"
                  value={m.remetente}
                  maxLength={30}
                  error={errosDoLote[m.id]?.remetente}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    trocar(i, "remetente", e.target.value)
                  }
                />
                {m.titulo !== undefined && (
                  <TextField
                    label={m.tipo === "link" ? "A manchete" : "O que a foto mostra"}
                    value={m.titulo}
                    maxLength={120}
                    error={errosDoLote[m.id]?.titulo}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      trocar(i, "titulo", e.target.value)
                    }
                  />
                )}
                {m.fonte !== undefined && (
                  <TextField
                    label="O site que publicou"
                    value={m.fonte}
                    maxLength={60}
                    error={errosDoLote[m.id]?.fonte}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      trocar(i, "fonte", e.target.value)
                    }
                  />
                )}
                {m.data !== undefined && (
                  <TextField
                    label="A data que aparece no card"
                    helperText="É o detalhe que faz esta mensagem ser ambígua: a notícia é real, mas antiga."
                    value={m.data}
                    maxLength={40}
                    error={errosDoLote[m.id]?.data}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      trocar(i, "data", e.target.value)
                    }
                  />
                )}
                <TextArea
                  label={
                    m.tipo === "audio"
                      ? `O que se ouve no áudio (${m.duracaoSeg ?? 0}s, transcrito na tela)`
                      : "A mensagem, como a turma lê"
                  }
                  value={m.corpo}
                  rows={3}
                  maxLength={600}
                  error={errosDoLote[m.id]?.corpo}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    trocar(i, "corpo", e.target.value)
                  }
                />
                <TextArea
                  label="A explicação do selo (aparece na revelação, sob a mensagem)"
                  value={m.explicacao}
                  rows={2}
                  maxLength={160}
                  error={errosDoLote[m.id]?.explicacao}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    trocar(i, "explicacao", e.target.value)
                  }
                />
              </div>
            ))}
          </div>
        </Collapse>
      </div>
    </Card>
  );
}
