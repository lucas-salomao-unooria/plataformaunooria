"use client";

import {
  Button,
  Card,
  Icon,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Tag,
  TextArea,
  TextField,
} from "@edu/ui/ds";
import {
  CARACTERES,
  MAX_PALAVRAS_DA_LEGENDA,
  MAX_PALAVRAS_DO_BASTIDOR,
  palavras,
  rotuloCurtoDaArea,
  type CampoDoEstande,
  type CategoriaDaMostra,
  type ProjetoDoPacote,
} from "@/lib/juri-estadual-tipos";

/**
 * Um estande da mostra no PREPARO (E0-PROF-04) e na página da atividade: o
 * cartão com o que o post mostra à criança, e a janela em que o professor
 * edita o que ela lê.
 *
 * O cartão é o `Card` do DS, da seção `unooria`: o professor está na tela da
 * plataforma, e o post do Unoovista com barra e coração seria peça do clone
 * fora do lugar (ADR-117 vale para conteúdo que a CRIANÇA reconhece, não para
 * a curadoria).
 *
 * **O que se edita é o que a criança lê**: o título, a legenda da
 * apresentação e o texto do bastidor. A área, as hashtags, o perfil e a
 * descrição da imagem ficam como a geração os deixou — a primeira hashtag é a
 * da área, e trocá-la desmontaria a busca da galeria; quem quiser outro
 * estande usa "Regenerar estande", que escreve um novo para caber no resto.
 */

/** "7 palavras · até 60" — a régua à vista enquanto o professor digita. */
function contagem(texto: string, max?: number): string {
  const n = palavras(texto);
  const unidade = n === 1 ? "palavra" : "palavras";
  return max ? `${n} ${unidade} · até ${max}` : `${n} ${unidade}`;
}

export function CartaoDoEstande({
  projeto,
  imagem,
  problemas,
  errosDaApi,
  aoEditar,
  aoRegenerar,
  regenerando = false,
  ocupado = false,
}: {
  projeto: ProjetoDoPacote;
  /** A URL da imagem gerada; sem ela, a criança vê a arte desenhada. */
  imagem?: string;
  problemas?: number;
  errosDaApi?: readonly string[];
  /** Sem as duas ações, o cartão é só leitura (a página da atividade). */
  aoEditar?: () => void;
  aoRegenerar?: () => void;
  regenerando?: boolean;
  ocupado?: boolean;
}) {
  const pendencias = (problemas ?? 0) + (errosDaApi?.length ?? 0);
  return (
    <div className="flex flex-col gap-2" data-estande={projeto.id}>
      <Card
        variant="outlined"
        image={imagem}
        imageAlt={imagem ? projeto.imagem.alt : undefined}
        title={projeto.titulo}
        subtitle={`${projeto.escola} · ${projeto.perfil}`}
        description={projeto.legenda}
        tags={projeto.hashtags.map((h) => (
          <Tag key={h} variant="neutral" size="sm">
            {h}
          </Tag>
        ))}
      >
        <p className="pt-2 text-[12px] leading-snug text-unooria-neutral-600">
          <strong className="text-unooria-neutral-800">Bastidor:</strong> {projeto.bastidor}
        </p>
      </Card>
      {pendencias > 0 ? (
        <div>
          <Tag variant="danger" size="sm">
            {pendencias === 1 ? "1 ajuste" : `${pendencias} ajustes`}
          </Tag>
        </div>
      ) : null}
      {aoEditar || aoRegenerar ? (
        <div className="flex flex-wrap gap-2">
          {aoEditar ? (
            <Button variant="outline" size="sm" leftIcon={<Icon name="edit" size={16} />} onClick={aoEditar} isDisabled={ocupado}>
              Editar estande
            </Button>
          ) : null}
          {aoRegenerar ? (
            <Button
              variant="ai"
              size="sm"
              leftIcon={<Icon name="autorenew" size={16} />}
              onClick={aoRegenerar}
              isDisabled={ocupado}
              data-acao="regenerar-estande"
            >
              {regenerando ? "Regenerando…" : "Regenerar estande"}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** A janela de edição de UM estande: o que a criança lê no post da apresentação e no do bastidor. */
export function EditorDoEstande({
  projeto,
  categoria,
  problemas,
  errosDaApi,
  aoMudar,
  aoFechar,
  aoRegenerar,
  regenerando,
  ocupado,
}: {
  projeto: ProjetoDoPacote;
  categoria: CategoriaDaMostra | undefined;
  problemas: Partial<Record<CampoDoEstande, string>>;
  errosDaApi: readonly string[];
  aoMudar: (p: ProjetoDoPacote) => void;
  aoFechar: () => void;
  aoRegenerar: () => void;
  regenerando: boolean;
  ocupado: boolean;
}) {
  const p = projeto;
  const mudar = (parcial: Partial<ProjetoDoPacote>) => aoMudar({ ...p, ...parcial });
  /* Os campos que esta janela NÃO edita também podem ter problema (um estande
     regenerado, por exemplo): a lista deles aparece no topo, para o professor
     saber que a saída é regenerar. */
  const foraDaJanela = (["escola", "perfil", "hashtags", "descricao", "alt"] as const)
    .map((campo) => problemas[campo])
    .filter((e): e is string => Boolean(e));

  return (
    <Modal isOpen onClose={aoFechar} size="lg">
      <ModalHeader
        title="Editar Projeto Escolar"
        description={`${rotuloCurtoDaArea(p.area)}${categoria ? ` · ${categoria.nome} (${categoria.hashtag})` : ""} · ${p.escola}`}
        onClose={aoFechar}
      />
      <ModalBody scrollable maxHeight="65vh">
        <div className="flex flex-col gap-4" data-editor-do-estande={p.id}>
          {errosDaApi.length > 0 || foraDaJanela.length > 0 ? (
            <ul className="list-disc pl-5 text-[13px] leading-snug text-unooria-danger" role="status">
              {[...errosDaApi, ...foraDaJanela].map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : null}
          <TextField
            label="Título do estande"
            value={p.titulo}
            maxLength={CARACTERES.titulo.max}
            error={problemas.titulo}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => mudar({ titulo: e.target.value })}
          />
          <TextArea
            label="Legenda da apresentação (o post do estande)"
            value={p.legenda}
            rows={5}
            maxLength={CARACTERES.legenda.max}
            error={problemas.legenda}
            helperText={problemas.legenda ? undefined : contagem(p.legenda, MAX_PALAVRAS_DA_LEGENDA)}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => mudar({ legenda: e.target.value })}
          />
          <TextArea
            label="Bastidor (o post do protótipo sendo testado)"
            value={p.bastidor}
            rows={3}
            maxLength={CARACTERES.bastidor.max}
            error={problemas.bastidor}
            helperText={problemas.bastidor ? undefined : contagem(p.bastidor, MAX_PALAVRAS_DO_BASTIDOR)}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => mudar({ bastidor: e.target.value })}
          />
          <p className="text-[12px] leading-snug text-unooria-neutral-600">
            Hashtags: {p.hashtags.join(" ")}. A primeira é a da área, e é por ela que a busca da Galeria Oculta
            encontra o estande. Sem exclamação: a mostra é escrita num tom sóbrio, e a que aparecer vira ponto.
          </p>
        </div>
      </ModalBody>
      <ModalFooter align="space-between" divider>
        <Button variant="ai" size="sm" leftIcon={<Icon name="autorenew" size={16} />} onClick={aoRegenerar} isDisabled={ocupado}>
          {regenerando ? "Regenerando…" : "Regenerar estande"}
        </Button>
        <Button variant="primary" size="sm" onClick={aoFechar}>
          Pronto
        </Button>
      </ModalFooter>
    </Modal>
  );
}
