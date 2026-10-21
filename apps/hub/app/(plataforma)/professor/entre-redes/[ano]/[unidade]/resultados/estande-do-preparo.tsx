"use client";

import { useState, type ReactNode } from "react";
import {
  Button,
  Card,
  Icon,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ScrollBar,
  Tabs,
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
  type Area,
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
 * apresentação e o bastidor (o resumo técnico: a segunda lâmina do post e a
 * ficha da Galeria Oculta). A área, as hashtags, o perfil e a
 * descrição da imagem ficam como a geração os deixou — a primeira hashtag é a
 * da área, e trocá-la desmontaria a busca da galeria; quem quiser outro
 * estande usa "Regenerar estande", que escreve um novo para caber no resto.
 *
 * **As hashtags vão em `subtags`, nunca em `tags`** (o pedido do PO): `tags` é o
 * cabeçalho do `Card`, uma linha só e sem quebra — as três ou quatro hashtags
 * de um estande vazavam pela borda do cartão logo depois da geração. `subtags`
 * é o contêiner do DS que quebra linha, abaixo da descrição.
 */

/** Uma aba de área: o rótulo (`rotuloDaAbaDaArea`) e o que ela mostra. */
export interface AbaDaArea {
  area: Area;
  rotulo: string;
  conteudo: ReactNode;
}

/**
 * AS QUATRO ÁREAS EM ABAS — as telas de quarenta estandes (a curadoria, a
 * grade das imagens e os estandes da página da atividade). Quarenta cartões
 * numa coluna só eram uma rolagem em que o professor perdia o estande com
 * ajuste; uma aba por área, com a pendência no rótulo, diz onde procurar.
 *
 * `Tabs` do DS em modo CONTROLADO (como `professor/turmas/[id]/abas-da-sala.tsx`),
 * e só a aba aberta é RENDERIZADA — nunca `Collapse` nem painel escondido: a
 * área fechada deixaria dezenas de botões focáveis dentro de `aria-hidden`.
 * O estado é local (não `?aba=`): três telas montam o componente, uma delas
 * dentro do assistente da criação, onde a URL é do assistente.
 *
 * Serve a Server Components: o conteúdo de cada aba chega pronto, como nó.
 */
export function AbasDasAreas({ abas, rotulo }: { abas: readonly AbaDaArea[]; rotulo: string }) {
  const [area, setArea] = useState<Area | undefined>(abas[0]?.area);
  const aberta = abas.find((a) => a.area === area) ?? abas[0];
  if (!aberta) return null;
  return (
    <div className="flex flex-col gap-4" aria-label={rotulo} role="group">
      {/* Sem o ícone padrão do `Tab` (um "+" que leria como "adicionar"), e numa
          faixa que rola na horizontal: o nome da área vem da IA e pode ser
          longo, e a quarta aba saía cortada a 1440 px (e2e 13). */}
      <ScrollBar orientation="horizontal" autoHide>
        <Tabs
          value={aberta.area}
          onChange={(valor) => setArea(String(valor) as Area)}
          items={abas.map((a) => ({ value: a.area, label: a.rotulo, showIcon: false }))}
        />
      </ScrollBar>
      <div key={aberta.area} data-area={aberta.area}>
        {aberta.conteudo}
      </div>
    </div>
  );
}

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
        subtags={projeto.hashtags.map((h) => (
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

/** A janela de edição de UM estande: o que a criança lê no post e na ficha da Galeria Oculta. */
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
  /**
   * Muda SÓ os campos de `parcial` no estande `id`, sobre o estado ATUAL do
   * rascunho. Nunca o estande inteiro a partir da prop: com digitação rápida,
   * duas teclas chegam antes do re-render e a segunda, montada sobre a prop
   * velha, apagava a primeira ("Protótipo" virava "Proótipo" na e2e).
   */
  aoMudar: (id: string, parcial: Partial<ProjetoDoPacote>) => void;
  aoFechar: () => void;
  aoRegenerar: () => void;
  regenerando: boolean;
  ocupado: boolean;
}) {
  const p = projeto;
  const mudar = (parcial: Partial<ProjetoDoPacote>) => aoMudar(p.id, parcial);
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
            label="Bastidor (o resumo técnico: a segunda página do carrossel do post e a ficha da Galeria Oculta)"
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
