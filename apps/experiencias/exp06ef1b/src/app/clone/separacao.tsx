import { useState } from "react";
import { AvatarUnv, ButtonUnv, Chip, IconUnv, ListItem } from "@edu/ui/ds-unoovista";
import { respostasDaSeparacao, separacaoValida } from "../../lib/regras";
import { SEPARACAO } from "../../lib/textos";
import { AREAS, type Area, type Categoria, type ItemDaClassificacao } from "../../lib/tipos";
import { srcDoEstande, usePaleta } from "../componentes/midia";
import { Cabecalho } from "./cabecalho";

/**
 * A SEPARAÇÃO (EF06CO01, ADR-174), logo depois do voto: a criança põe cada
 * estande que viu numa das quatro áreas. É antes da Galeria Oculta, com o
 * disfarce de pé — quem pede é a COMISSÃO, dentro do Unoovista.
 *
 * Cada estande é o `ListItem` do DS (`as="div"`: é rótulo, não botão) com a
 * miniatura e o título — **sem hashtag, sem perfil, sem legenda**: o perfil do
 * post É a hashtag, e com ela a tarefa viraria copiar a etiqueta. As áreas são
 * `Chip` do DS em grupo de rádio (`radiogroup`/`radio`/`aria-checked`, como a
 * certeza da cédula): escolha por TOQUE, sem arrastar (AA, ADR-162), e o
 * teclado chega a cada uma.
 *
 * A arte procedural (sem foto gerada) nasce do id opaco, não do projeto: o id
 * do projeto diria a área. Com foto, é a mesma do feed.
 *
 * Uma vez só: "Enviar" acende com todos separados, e depois do envio não há
 * certo nem errado na tela — o nível é do professor. As escolhas tocadas ficam
 * na memória de F5 até o envio.
 */
export function Separacao({
  itens,
  categorias,
  guardada,
  enviando,
  aoMudar,
  aoEnviar,
}: {
  itens: readonly ItemDaClassificacao[];
  categorias: readonly Categoria[];
  guardada: Readonly<Record<string, string>>;
  enviando: boolean;
  aoMudar: (escolhas: Record<string, Area>) => void;
  aoEnviar: (respostas: { itemId: string; area: Area }[]) => void;
}) {
  const paleta = usePaleta();
  const [escolhas, setEscolhas] = useState<Record<string, Area>>(() => separacaoValida(guardada, itens, AREAS));
  const respostas = respostasDaSeparacao(itens, escolhas);
  const feitos = itens.filter((i) => escolhas[i.id]).length;

  function escolher(itemId: string, area: Area) {
    const novas = { ...escolhas, [itemId]: area };
    setEscolhas(novas);
    aoMudar(novas);
  }

  return (
    <div className="tela">
      <Cabecalho />
      <div className="rolagem separacao">
        <h1 className="separacao__titulo">{SEPARACAO.titulo}</h1>
        <p className="separacao__instrucao">
          {SEPARACAO.instrucao} {SEPARACAO.pedido}
        </p>
        <ul className="separacao__lista">
          {itens.map((item) => (
            <li key={item.id} className="separacao__estande">
              <ListItem
                as="div"
                leading={
                  <AvatarUnv
                    src={srcDoEstande(
                      {
                        projetoId: item.id,
                        titulo: item.titulo,
                        imagem: item.imagem,
                      },
                      paleta,
                    )}
                    alt=""
                    size="md"
                  />
                }
                title={item.titulo}
              />
              <div role="radiogroup" aria-label={SEPARACAO.areaDo(item.titulo)} className="separacao__areas">
                {categorias.map((c) => {
                  const marcada = escolhas[item.id] === c.area;
                  return (
                    <Chip
                      key={c.area}
                      role="radio"
                      aria-checked={marcada}
                      selected={marcada}
                      disabled={enviando}
                      leadingIcon={marcada ? <IconUnv name="check" size="sm" tone="inherit" /> : undefined}
                      onClick={() => escolher(item.id, c.area)}
                    >
                      {c.nome}
                    </Chip>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="doca">
        <p className="separacao__contador" role="status">
          {SEPARACAO.contador(feitos, itens.length)}
        </p>
        <ButtonUnv
          variant="primary"
          size="lg"
          block
          disabled={!respostas || enviando}
          leadingIcon={<IconUnv name="lock" size={18} tone="inherit" />}
          onClick={() => {
            if (respostas) aoEnviar(respostas);
          }}
        >
          {SEPARACAO.enviar}
        </ButtonUnv>
      </div>
    </div>
  );
}
