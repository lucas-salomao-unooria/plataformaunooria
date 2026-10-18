"use client";

import {
  Button,
  Card,
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
  IDS_DE_SIMULACAO,
  MEIOS_DA_SIMULACAO,
  MEIO_NO_DS,
  REGUAS_DE_PALAVRAS,
  ROTULO_DA_PISTA,
  ROTULO_DO_GABARITO,
  TIPOS_DE_PISTA,
  escolhaDoGabarito,
  gabaritoDaEscolha,
  palavras,
  type CampoDaMateria,
  type EscolhaDoGabarito,
  type MateriaDaSimulacao,
  type Meio,
} from "@/lib/jornal-escola-tipos";

/**
 * As duas matérias da SIMULAÇÃO (3.0.0, ADR-168) no preparo e na página da
 * atividade. Depois da 2ª edição, cada computador aplica a Chave do Editor que
 * montou a estas duas matérias novas — uma que pode ir para a capa, uma com
 * UMA pista em falta. Não têm imagem, corpo nem reação do leitor: não vão para
 * capa nenhuma, só testam a Chave.
 *
 * O cartão é o `NewsCard` do DS sem imagem (é o meio desenhado que a criança
 * vê), e a janela de edição segue a da notícia (`noticia-do-preparo.tsx`), com
 * menos campos. Aqui o MEIO tem campo, ao contrário das oito: são só dois, e a
 * regra é que sejam diferentes entre jornal, blog, portal e mural — trocar um
 * deles é como o professor conserta um par que veio repetido.
 */

const ESCOLHAS: readonly EscolhaDoGabarito[] = ["publicavel", "data", "fonte", "autoria"];

function contagem(texto: string | null, regua?: { min: number; max: number }): string {
  const n = palavras(texto ?? "");
  const unidade = n === 1 ? "palavra" : "palavras";
  return regua ? `${n} ${unidade} · de ${regua.min} a ${regua.max}` : `${n} ${unidade}`;
}

function posicao(id: MateriaDaSimulacao["id"]): number {
  return IDS_DE_SIMULACAO.indexOf(id) + 1;
}

/** O cartão de uma matéria da simulação, com o gabarito embaixo — só o professor vê esta faixa. */
export function CartaoDaSimulacao({
  materia,
  problemas,
  errosDaApi,
  aoEditar,
  ocupado,
}: {
  materia: MateriaDaSimulacao;
  problemas: number;
  errosDaApi: readonly string[];
  /** `undefined` = só leitura (a página da atividade). */
  aoEditar?: () => void;
  ocupado?: boolean;
}) {
  const escolha = escolhaDoGabarito(materia.gabarito);
  const pendencias = problemas + errosDaApi.length;
  return (
    <div className="flex flex-col gap-2" data-materia-da-simulacao={materia.id}>
      <NewsCard
        medium={MEIO_NO_DS[materia.meio]}
        headline={materia.manchete}
        summary={materia.resumo}
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
      {aoEditar ? (
        <div>
          <Button variant="outline" size="sm" leftIcon={<Icon name="edit" size={16} />} onClick={aoEditar} isDisabled={ocupado}>
            Editar
          </Button>
        </div>
      ) : (
        <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[12px] leading-snug text-unooria-neutral-700">
          {TIPOS_DE_PISTA.map((tipo) => (
            <div key={tipo} className="contents">
              <dt className="font-semibold">{ROTULO_DA_PISTA[tipo]}:</dt>
              <dd>{materia.pistas[tipo]}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/** As duas matérias, só leitura, na página da atividade: o que a turma vai testar com a Chave. */
export function SimulacaoDoPacote({ simulacao }: { simulacao: readonly MateriaDaSimulacao[] }) {
  return (
    <Card variant="elevated" title="As duas matérias para testar a Chave — só para você">
      <div className="flex flex-col gap-3" data-simulacao-do-pacote>
        <p className="max-w-3xl text-[12px] leading-snug text-unooria-neutral-600">
          Depois da 2ª edição, cada computador aplica a Chave do Editor que montou a estas duas matérias novas, sem
          imagem. Uma pode ir para a capa e a outra tem uma pista que falha. <strong>Não projete:</strong> a etiqueta
          é a resposta.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {simulacao.map((m) => (
            <CartaoDaSimulacao key={m.id} materia={m} problemas={0} errosDaApi={[]} />
          ))}
        </div>
      </div>
    </Card>
  );
}

/** A janela de edição de UMA matéria da simulação: o que a criança lê, as pistas e o gabarito. */
export function EditorDaMateria({
  materia,
  problemas,
  errosDaApi,
  aoMudar,
  aoFechar,
}: {
  materia: MateriaDaSimulacao;
  problemas: Partial<Record<CampoDaMateria, string>>;
  errosDaApi: readonly string[];
  aoMudar: (m: MateriaDaSimulacao) => void;
  aoFechar: () => void;
}) {
  const r = REGUAS_DE_PALAVRAS;
  const c = CARACTERES;
  const m = materia;
  const mudar = (parcial: Partial<MateriaDaSimulacao>) => aoMudar({ ...m, ...parcial });
  const erro = (campo: CampoDaMateria) => problemas[campo];

  return (
    <Modal isOpen onClose={aoFechar} size="lg">
      <ModalHeader
        title={`Matéria ${posicao(m.id)} de ${IDS_DE_SIMULACAO.length} da simulação · ${NEWS_MEDIUM_LABELS[MEIO_NO_DS[m.meio]]}`}
        description="A criança aplica a Chave dela a esta matéria depois da 2ª edição. Ela não tem imagem e não vai para capa nenhuma."
        onClose={aoFechar}
      />
      <ModalBody scrollable maxHeight="65vh">
        <div className="flex flex-col gap-6" data-editor-da-materia={m.id}>
          {errosDaApi.length > 0 ? (
            <ul className="list-disc pl-5 text-[13px] leading-snug text-unooria-danger" role="status">
              {errosDaApi.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : null}

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 text-[14px] font-semibold text-unooria-neutral-950">O que a criança lê</legend>
            <RadioGroup
              label="De que meio é a matéria"
              name={`meio-${m.id}`}
              direction="horizontal"
              value={m.meio}
              error={erro("meio")}
              options={MEIOS_DA_SIMULACAO.map((meio) => ({ value: meio, label: NEWS_MEDIUM_LABELS[MEIO_NO_DS[meio]] }))}
              onChange={(valor) => mudar({ meio: String(valor) as Meio })}
            />
            <div className="grid gap-3 md:grid-cols-2">
              <TextField
                label="Veículo"
                value={m.veiculo}
                maxLength={c.veiculo.max}
                error={erro("veiculo")}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => mudar({ veiculo: e.target.value })}
              />
              <TextField
                label="Quem fala na matéria (opcional)"
                value={m.falante ?? ""}
                maxLength={c.falante.max}
                error={erro("falante")}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => mudar({ falante: e.target.value })}
              />
            </div>
            <TextField
              label="Manchete"
              value={m.manchete}
              maxLength={c.manchete.max}
              error={erro("manchete")}
              helperText={erro("manchete") ? undefined : contagem(m.manchete, r.manchete)}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => mudar({ manchete: e.target.value })}
            />
            <TextArea
              label="Resumo"
              value={m.resumo}
              rows={3}
              maxLength={c.resumo.max}
              error={erro("resumo")}
              helperText={erro("resumo") ? undefined : contagem(m.resumo, r.resumo)}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => mudar({ resumo: e.target.value })}
            />
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 text-[14px] font-semibold text-unooria-neutral-950">As pistas</legend>
            <p className="text-[12px] leading-snug text-unooria-neutral-600">
              A criança abre as pistas na ordem da Chave dela. Cada pista precisa ter resposta clara: na matéria que
              não pode ir para a capa, só UMA falha.
            </p>
            <div className="grid gap-3 md:grid-cols-3">
              {TIPOS_DE_PISTA.map((tipo) => (
                <TextArea
                  key={tipo}
                  label={ROTULO_DA_PISTA[tipo]}
                  value={m.pistas[tipo]}
                  rows={3}
                  maxLength={c.pista.max}
                  error={erro(tipo)}
                  helperText={erro(tipo) ? undefined : contagem(m.pistas[tipo], r.pista)}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => mudar({ pistas: { ...m.pistas, [tipo]: e.target.value } })}
                />
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 text-[14px] font-semibold text-unooria-neutral-950">O gabarito — só você vê</legend>
            <RadioGroup
              label="Esta matéria poderia ir para a capa?"
              name={`gabarito-${m.id}`}
              value={escolhaDoGabarito(m.gabarito)}
              options={ESCOLHAS.map((escolha) => ({ value: escolha, label: ROTULO_DO_GABARITO[escolha] }))}
              onChange={(valor) =>
                mudar({ gabarito: { ...m.gabarito, ...gabaritoDaEscolha(String(valor) as EscolhaDoGabarito) } })
              }
            />
            <TextArea
              label="Por que ela poderia ou não ir para a capa (para você)"
              value={m.gabarito.explicacao}
              rows={3}
              maxLength={c.explicacao.max}
              error={erro("explicacao")}
              helperText={erro("explicacao") ? undefined : contagem(m.gabarito.explicacao, r.explicacao)}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                mudar({ gabarito: { ...m.gabarito, explicacao: e.target.value } })
              }
            />
          </fieldset>
        </div>
      </ModalBody>
      <ModalFooter align="end" divider>
        <Button variant="primary" size="sm" onClick={aoFechar}>
          Pronto
        </Button>
      </ModalFooter>
    </Modal>
  );
}
