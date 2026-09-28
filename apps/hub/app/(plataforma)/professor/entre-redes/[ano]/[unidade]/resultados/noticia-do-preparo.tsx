"use client";

import {
  Button,
  Icon,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  NEWS_MEDIUM_LABELS,
  NewsCard,
  RadioGroup,
  Tag,
  TextArea,
  TextField,
} from "@edu/ui/ds";
import {
  CARACTERES,
  ETIQUETA_DO_GABARITO,
  IDS_DE_NOTICIA,
  MEIO_NO_DS,
  REGUAS_DE_PALAVRAS,
  ROTULO_DA_PISTA,
  ROTULO_DO_GABARITO,
  TIPOS_DE_PISTA,
  escolhaDoGabarito,
  gabaritoDaEscolha,
  palavras,
  type CampoDaNoticia,
  type EscolhaDoGabarito,
  type Meio,
  type NoticiaDoPacote,
} from "@/lib/jornal-escola-tipos";

/**
 * Uma notícia no PREPARO (E0-PROF-04): o cartão como a mesa da criança o
 * mostra, e a janela em que o professor edita tudo o que ela tem.
 *
 * **O cartão é o `NewsCard` do DS, o MESMO da mesa.** O professor revisa o que
 * a turma vai ver, com o rótulo e o desenho do meio de verdade — e o cartão é
 * um botão que abre um diálogo (`aria-haspopup="dialog"`), que é exatamente o
 * que ele faz aqui: abre a janela de edição.
 *
 * **Editar a notícia é editar o gabarito e a consequência dela** (PDF §10):
 * por isso as três partes estão na mesma janela, e a homologação as leva juntas.
 * O MEIO não tem campo: as oito precisam de oito meios diferentes, e a
 * regeneração o mantém — trocá-lo aqui desmontaria o conjunto.
 *
 * "Vai para a capa?" é UM rádio de quatro opções, e não um "publicável" mais um
 * "pilar": o par nunca fica incoerente (`gabaritoDaEscolha`), que é a primeira
 * coisa que a api recusaria.
 */

const ESCOLHAS: readonly EscolhaDoGabarito[] = ["publicavel", "data", "fonte", "autoria"];

/** Quem fala, pelo meio: o locutor do rádio não é o "falante" de um blog. */
function rotuloDoFalante(meio: Meio): string {
  if (meio === "radio") return "Locutor ou locutora do boletim";
  if (meio === "tv") return "Apresentador ou repórter (opcional)";
  if (meio === "mensagem") return "Quem mandou a mensagem (opcional)";
  return "Quem fala na matéria (opcional)";
}

/** "7 palavras · de 3 a 10" — a régua à vista enquanto o professor digita. */
function contagem(texto: string | null, regua?: { min: number; max: number }): string {
  const n = palavras(texto ?? "");
  const unidade = n === 1 ? "palavra" : "palavras";
  return regua ? `${n} ${unidade} · de ${regua.min} a ${regua.max}` : `${n} ${unidade}`;
}

export function posicaoDaNoticia(id: NoticiaDoPacote["id"]): number {
  return IDS_DE_NOTICIA.indexOf(id) + 1;
}

/** O cartão da mesa, com o gabarito e o estado da revisão embaixo — só o professor vê esta faixa. */
export function CartaoDoPreparo({
  noticia,
  imagem,
  problemas,
  errosDaApi,
  aoEditar,
  aoRegenerar,
  regenerando,
  ocupado,
}: {
  noticia: NoticiaDoPacote;
  imagem: string | undefined;
  problemas: number;
  errosDaApi: readonly string[];
  aoEditar: () => void;
  aoRegenerar: () => void;
  regenerando: boolean;
  ocupado: boolean;
}) {
  const escolha = escolhaDoGabarito(noticia.gabarito);
  const pendencias = problemas + errosDaApi.length;
  return (
    <div className="flex flex-col gap-2" data-noticia={noticia.id}>
      <NewsCard
        medium={MEIO_NO_DS[noticia.meio]}
        headline={noticia.manchete}
        summary={noticia.resumo}
        imageSrc={imagem}
        imageAlt={noticia.descricaoImagem ?? undefined}
        onClick={aoEditar}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Tag variant={escolha === "publicavel" ? "success" : "warning"} size="sm">
          {ETIQUETA_DO_GABARITO[escolha]}
        </Tag>
        {pendencias > 0 ? (
          <Tag variant="danger" size="sm">
            {pendencias === 1 ? "1 ajuste" : `${pendencias} ajustes`}
          </Tag>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" leftIcon={<Icon name="edit" size={16} />} onClick={aoEditar} isDisabled={ocupado}>
          Editar
        </Button>
        <Button
          variant="ai"
          size="sm"
          leftIcon={<Icon name="autorenew" size={16} />}
          onClick={aoRegenerar}
          isDisabled={ocupado}
          data-acao="regenerar-noticia"
        >
          {regenerando ? "Regenerando…" : "Regenerar Notícia"}
        </Button>
      </div>
    </div>
  );
}

/** A janela de edição de UMA notícia: o que a criança lê, as pistas, o gabarito e a reação do leitor. */
export function EditorDaNoticia({
  noticia,
  problemas,
  errosDaApi,
  aoMudar,
  aoFechar,
  aoRegenerar,
  regenerando,
  ocupado,
}: {
  noticia: NoticiaDoPacote;
  problemas: Partial<Record<CampoDaNoticia, string>>;
  errosDaApi: readonly string[];
  aoMudar: (n: NoticiaDoPacote) => void;
  aoFechar: () => void;
  aoRegenerar: () => void;
  regenerando: boolean;
  ocupado: boolean;
}) {
  const r = REGUAS_DE_PALAVRAS;
  const c = CARACTERES;
  const n = noticia;
  const mudar = (parcial: Partial<NoticiaDoPacote>) => aoMudar({ ...n, ...parcial });
  const erro = (campo: CampoDaNoticia) => problemas[campo];

  return (
    <Modal isOpen onClose={aoFechar} size="lg">
      <ModalHeader
        title={`Notícia ${posicaoDaNoticia(n.id)} de ${IDS_DE_NOTICIA.length} · ${NEWS_MEDIUM_LABELS[MEIO_NO_DS[n.meio]]}`}
        description="O que a criança lê, as pistas, se a notícia pode ir para a capa e a reação do leitor. Editar uma parte pede rever as outras."
        onClose={aoFechar}
      />
      <ModalBody scrollable maxHeight="65vh">
        <div className="flex flex-col gap-6" data-editor-da-noticia={n.id}>
          {errosDaApi.length > 0 ? (
            <ul className="list-disc pl-5 text-[13px] leading-snug text-unooria-danger" role="status">
              {errosDaApi.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : null}

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 text-[14px] font-semibold text-unooria-neutral-950">O que a criança lê na mesa</legend>
            <div className="grid gap-3 md:grid-cols-2">
              <TextField
                label={n.meio === "rede_social" ? "Perfil que publicou (com @)" : "Veículo"}
                value={n.veiculo}
                maxLength={c.veiculo.max}
                error={erro("veiculo")}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => mudar({ veiculo: e.target.value })}
              />
              <TextField
                label={rotuloDoFalante(n.meio)}
                value={n.falante ?? ""}
                maxLength={c.falante.max}
                error={erro("falante")}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => mudar({ falante: e.target.value })}
              />
            </div>
            <TextField
              label="Manchete"
              value={n.manchete}
              maxLength={c.manchete.max}
              error={erro("manchete")}
              helperText={erro("manchete") ? undefined : contagem(n.manchete, r.manchete)}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => mudar({ manchete: e.target.value })}
            />
            <TextArea
              label="Resumo do cartão"
              value={n.resumo}
              rows={3}
              maxLength={c.resumo.max}
              error={erro("resumo")}
              helperText={erro("resumo") ? undefined : contagem(n.resumo, r.resumo)}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => mudar({ resumo: e.target.value })}
            />
            <TextArea
              label="A matéria no formato original (o que abre na gaveta)"
              value={n.corpo}
              rows={5}
              maxLength={c.corpo.max}
              error={erro("corpo")}
              helperText={erro("corpo") ? undefined : contagem(n.corpo, r.corpo)}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => mudar({ corpo: e.target.value })}
            />
            <div className="grid gap-3 md:grid-cols-2">
              <TextArea
                label="O que a imagem mostra (vazio = sem imagem)"
                value={n.descricaoImagem ?? ""}
                rows={3}
                maxLength={c.descricaoImagem.max}
                error={erro("descricaoImagem")}
                helperText={
                  erro("descricaoImagem")
                    ? undefined
                    : "É o pedido da geração da imagem e o texto alternativo. Pessoa real identificável, não."
                }
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => mudar({ descricaoImagem: e.target.value })}
              />
              <TextArea
                label="Legenda da foto ou do quadro (opcional)"
                value={n.legenda ?? ""}
                rows={3}
                maxLength={c.legenda.max}
                error={erro("legenda")}
                helperText={erro("legenda") ? undefined : contagem(n.legenda, r.legenda)}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => mudar({ legenda: e.target.value })}
              />
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 text-[14px] font-semibold text-unooria-neutral-950">As pistas</legend>
            <p className="text-[12px] leading-snug text-unooria-neutral-600">
              É o texto que abre em cada botão da gaveta. A ausência também é pista: “Sem assinatura” é uma
              resposta válida.
            </p>
            <div className="grid gap-3 md:grid-cols-3">
              {TIPOS_DE_PISTA.map((tipo) => (
                <TextArea
                  key={tipo}
                  label={`${ROTULO_DA_PISTA[tipo]}`}
                  value={n.pistas[tipo]}
                  rows={3}
                  maxLength={c.pista.max}
                  error={erro(tipo)}
                  helperText={erro(tipo) ? undefined : contagem(n.pistas[tipo], r.pista)}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => mudar({ pistas: { ...n.pistas, [tipo]: e.target.value } })}
                />
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 text-[14px] font-semibold text-unooria-neutral-950">O gabarito — só você vê</legend>
            <RadioGroup
              label="Esta notícia pode ir para a capa?"
              name={`gabarito-${n.id}`}
              value={escolhaDoGabarito(n.gabarito)}
              options={ESCOLHAS.map((escolha) => ({ value: escolha, label: ROTULO_DO_GABARITO[escolha] }))}
              onChange={(valor) =>
                mudar({ gabarito: { ...n.gabarito, ...gabaritoDaEscolha(String(valor) as EscolhaDoGabarito) } })
              }
            />
            <TextArea
              label="Por que ela vai ou não vai para a capa (para você)"
              value={n.gabarito.explicacao}
              rows={3}
              maxLength={c.explicacao.max}
              error={erro("explicacao")}
              helperText={erro("explicacao") ? undefined : contagem(n.gabarito.explicacao, r.explicacao)}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                mudar({ gabarito: { ...n.gabarito, explicacao: e.target.value } })
              }
            />
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 text-[14px] font-semibold text-unooria-neutral-950">A reação do leitor</legend>
            <p className="text-[12px] leading-snug text-unooria-neutral-600">
              O balão que aparece no mural quando esta notícia vai para a capa. Ele precisa combinar com o
              gabarito: a notícia antiga leva gente a um evento que já passou; a publicável ajuda alguém.
            </p>
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <TextField
                label="Quem reage"
                value={n.consequencia.leitor}
                maxLength={c.leitor.max}
                error={erro("leitor")}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  mudar({ consequencia: { ...n.consequencia, leitor: e.target.value } })
                }
              />
              <TextArea
                label="O que o leitor diz"
                value={n.consequencia.fala}
                rows={3}
                maxLength={c.fala.max}
                error={erro("fala")}
                helperText={erro("fala") ? undefined : contagem(n.consequencia.fala, r.fala)}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  mudar({ consequencia: { ...n.consequencia, fala: e.target.value } })
                }
              />
            </div>
          </fieldset>
        </div>
      </ModalBody>
      <ModalFooter align="space-between" divider>
        <Button
          variant="ai"
          size="sm"
          leftIcon={<Icon name="autorenew" size={16} />}
          onClick={aoRegenerar}
          isDisabled={ocupado}
        >
          {regenerando ? "Regenerando…" : "Regenerar Notícia"}
        </Button>
        <Button variant="primary" size="sm" onClick={aoFechar}>
          Pronto
        </Button>
      </ModalFooter>
    </Modal>
  );
}
