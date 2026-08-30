"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  AlertBox,
  Badge,
  Button,
  Card,
  Tag,
  TextArea,
  TextField,
} from "@edu/ui/ds";
import type { Antagonismo, LadoAntagonismo } from "@/lib/insta-tipos";

import { MedidorEquilibrio } from "./medidor-equilibrio";

interface Props {
  activityId: string;
  perguntaChaveInicial: string;
  antagonismoInicial: Antagonismo | null;
  qtdPostsTese: number;
  categoriasIniciais: string[];
  neutrosNoTemaIniciais: string[];
  /** Configuração de neutros da atividade, para o texto refletir a escolha. */
  neutros: { ativo: boolean; modo: string; proporcao: number };
}

/**
 * Passo 2 do doc 05: a IA propõe, o professor decide. Tudo é editável —
 * rótulos, teses, argumentos, tom e categorias neutras.
 */
export function PainelAntagonismo({
  activityId,
  perguntaChaveInicial,
  antagonismoInicial,
  qtdPostsTese,
  categoriasIniciais,
  neutrosNoTemaIniciais,
  neutros,
}: Props) {
  const router = useRouter();
  const parametros = useSearchParams();

  const [pergunta, setPergunta] = useState(perguntaChaveInicial);
  const [antagonismo, setAntagonismo] = useState<Antagonismo | null>(
    antagonismoInicial,
  );
  const [categorias, setCategorias] = useState<string[]>(
    categoriasIniciais.length > 0
      ? categoriasIniciais
      : (antagonismoInicial?.categorias_neutras_sugeridas ?? []),
  );
  const [novaCategoria, setNovaCategoria] = useState("");
  /**
   * Neutros DENTRO do tema (doc 05 §1): fato, cronologia, fontes — informam sem
   * defender nenhum dos dois lados. Lista separada das categorias porque são
   * coisas diferentes: uma é assunto fora da disputa, a outra é o tema sem lado.
   */
  const [neutrosNoTema, setNeutrosNoTema] = useState<string[]>(
    neutrosNoTemaIniciais.length > 0
      ? neutrosNoTemaIniciais
      : (antagonismoInicial?.neutros_no_tema_sugeridos ?? []),
  );
  const [novoNeutroNoTema, setNovoNeutroNoTema] = useState("");
  const [analisando, setAnalisando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [forcar, setForcar] = useState(false);

  /**
   * `perguntaAtual` vazia = "IA, proponha as candidatas". Com texto = o
   * professor editou ou escreveu a sua, e a IA só destila essa (doc 07).
   */
  const analisar = useCallback(
    async (perguntaAtual: string) => {
      setErro(null);
      setAnalisando(true);
      try {
        const resposta = await fetch(`/api/plataforma/atividades/${activityId}/destilar`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            perguntaAtual.trim().length >= 10
              ? { perguntaChave: perguntaAtual.trim() }
              : {},
          ),
        });
        const corpo = (await resposta.json().catch(() => null)) as {
          antagonismo?: Antagonismo;
          mensagem?: string;
        } | null;

        if (!resposta.ok || !corpo?.antagonismo) {
          setErro(
            corpo?.mensagem ?? "Não foi possível analisar a pergunta agora.",
          );
          return;
        }

        setAntagonismo(corpo.antagonismo);
        setCategorias(corpo.antagonismo.categorias_neutras_sugeridas);
        setNeutrosNoTema(corpo.antagonismo.neutros_no_tema_sugeridos);
        // A pergunta do campo passa a ser a candidata escolhida pela IA.
        setPergunta(
          corpo.antagonismo.perguntas_candidatas[corpo.antagonismo.escolhida]
            ?.pergunta ?? perguntaAtual,
        );
        setForcar(false);
      } catch {
        setErro("Sem conexão agora. Tente de novo.");
      } finally {
        setAnalisando(false);
      }
    },
    [activityId],
  );

  // Vindo do formulário (?analisar=1), a primeira análise dispara sozinha.
  const jaDisparou = useRef(false);
  useEffect(() => {
    if (jaDisparou.current) return;
    if (parametros.get("analisar") === "1" && !antagonismoInicial) {
      jaDisparou.current = true;
      // Sem pergunta ainda: a primeira chamada pede as candidatas à IA.
      void analisar(perguntaChaveInicial);
    }
  }, [analisar, antagonismoInicial, parametros, perguntaChaveInicial]);

  function editarLado(
    qual: "ladoA" | "ladoB",
    campo: keyof LadoAntagonismo,
    valor: string | string[],
  ) {
    setAntagonismo((atual) =>
      atual ? { ...atual, [qual]: { ...atual[qual], [campo]: valor } } : atual,
    );
  }

  async function aprovarEGerar() {
    if (!antagonismo) return;

    setErro(null);
    setGerando(true);
    try {
      const aprovacao = await fetch(
        `/api/plataforma/atividades/${activityId}/antagonismo`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            /**
             * A pergunta que vale é a que está no campo — o professor pode ter
             * trocado de cartão ou editado o texto sem reanalisar. Aqui ela é
             * gravada como a candidata escolhida.
             */
            antagonismo: {
              ...antagonismo,
              perguntas_candidatas: antagonismo.perguntas_candidatas.map(
                (candidata, indice) =>
                  indice === antagonismo.escolhida
                    ? { ...candidata, pergunta: pergunta.trim() }
                    : candidata,
              ),
            },
            categoriasNeutras: neutros.modo === "no_tema" ? [] : categorias,
            neutrosNoTema: neutros.modo === "fora_do_tema" ? [] : neutrosNoTema,
            forcar,
          }),
        },
      );

      if (!aprovacao.ok) {
        const corpo = (await aprovacao.json().catch(() => null)) as {
          mensagem?: string;
        } | null;
        setErro(corpo?.mensagem ?? "Não foi possível salvar os dois lados.");
        setGerando(false);
        return;
      }

      const geracao = await fetch(`/api/plataforma/atividades/${activityId}/gerar`, {
        method: "POST",
      });
      if (!geracao.ok) {
        const corpo = (await geracao.json().catch(() => null)) as {
          mensagem?: string;
        } | null;
        setErro(corpo?.mensagem ?? "Não foi possível iniciar a geração.");
        setGerando(false);
        return;
      }

      router.replace(`/professor/atividades/${activityId}`);
      router.refresh();
    } catch {
      setErro("Sem conexão agora. Tente de novo.");
      setGerando(false);
    }
  }

  const equilibrioOk = antagonismo?.equilibrio.ok ?? false;
  /** Neutros derivados da configuração: múltiplo de 4, um por perfil (doc 05 §2). */
  const qtdNeutros = neutros.ativo
    ? Math.round((qtdPostsTese * neutros.proporcao) / 4) * 4
    : 0;

  return (
    <div className="flex flex-col gap-5">
      {erro ? (
        <AlertBox
          theme="light"
          variant="error"
          device="auto"
          description={erro}
        />
      ) : null}

      {antagonismo && antagonismo.perguntas_candidatas.length > 1 ? (
        <Card variant="outlined" title="Perguntas propostas pela IA">
          <div className="flex flex-col gap-2">
            {antagonismo.perguntas_candidatas.map((candidata, indice) => {
              const selecionada = candidata.pergunta.trim() === pergunta.trim();
              return (
                <button
                  key={`${indice}-${candidata.pergunta.slice(0, 24)}`}
                  type="button"
                  onClick={() => setPergunta(candidata.pergunta)}
                  aria-pressed={selecionada}
                  className={`flex flex-col gap-1.5 rounded-lg border p-3 text-left transition-colors ${
                    selecionada
                      ? "border-unooria-navy-800 bg-unooria-neutral-100"
                      : "border-unooria-neutral-200 hover:border-unooria-navy-800"
                  }`}
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <Tag
                      variant={candidata.equilibrio.ok ? "success" : "warning"}
                      size="sm"
                    >
                      equilíbrio {Math.round(candidata.equilibrio.nota * 100)}%
                    </Tag>
                    {selecionada ? (
                      <Tag variant="info" size="sm">
                        em uso
                      </Tag>
                    ) : null}
                  </span>
                  <span className="text-[14px] font-semibold text-unooria-neutral-950">
                    {candidata.pergunta}
                  </span>
                  <span className="text-[12px] text-unooria-neutral-500">
                    {candidata.por_que}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-[12px] text-unooria-neutral-500">
            Escolha uma, edite o texto abaixo ou escreva a sua. Depois de editar,
            use &ldquo;Reanalisar&rdquo; para a IA destilar os lados da SUA versão.
          </p>
        </Card>
      ) : null}

      <Card variant="elevated">
        <div className="flex flex-col gap-3">
          <TextArea
            id="pergunta-chave"
            label="Pergunta-chave do debate"
            rows={2}
            value={pergunta}
            onChange={(evento) => setPergunta(evento.target.value)}
            helperText={
              antagonismo
                ? "Editar aqui e reanalisar faz a pergunta contar como sua."
                : "A IA vai propor candidatas a partir do tema — você não precisa escrever nada."
            }
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant={antagonismo ? "outline" : "primary"}
              size="sm"
              isLoading={analisando}
              loadingText="Analisando…"
              onClick={() => void analisar(pergunta.trim())}
            >
              {antagonismo
                ? "Reanalisar"
                : pergunta.trim().length >= 10
                  ? "Analisar minha pergunta"
                  : "Propor perguntas"}
            </Button>
            {antagonismo ? (
              <div className="min-w-[220px] flex-1">
                <MedidorEquilibrio
                  nota={antagonismo.equilibrio.nota}
                  ok={equilibrioOk}
                />
              </div>
            ) : (
              <span className="text-[12px] text-unooria-neutral-500">
                A IA destila os dois lados e avalia se a pergunta gera disputa
                real.
              </span>
            )}
          </div>
        </div>
      </Card>

      {antagonismo && !equilibrioOk ? (
        <AlertBox
          theme="light"
          variant="warning"
          device="auto"
          title="Essa pergunta tende a não formar bolha"
          description={
            antagonismo.equilibrio.aviso ??
            "Reformule a pergunta para ter dois lados defensáveis."
          }
        />
      ) : null}

      {antagonismo && antagonismo.reformulacoes_sugeridas.length > 0 ? (
        <Card variant="outlined" title="Reformulações sugeridas">
          <ul className="flex flex-col gap-2">
            {antagonismo.reformulacoes_sugeridas.map((sugestao) => (
              <li
                key={sugestao}
                className="flex items-start justify-between gap-3"
              >
                <span className="text-[14px] text-unooria-neutral-800">
                  {sugestao}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPergunta(sugestao)}
                >
                  Usar
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {antagonismo ? (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            {(["ladoA", "ladoB"] as const).map((qual) => {
              const lado = antagonismo[qual];
              return (
                <Card key={qual} variant="outlined">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <Badge variant={qual === "ladoA" ? "info" : "warning"}>
                        {qual === "ladoA" ? "Lado A" : "Lado B"}
                      </Badge>
                      <TextField
                        value={lado.label}
                        onChange={(evento) =>
                          editarLado(qual, "label", evento.target.value)
                        }
                        aria-label={`Rótulo do ${qual === "ladoA" ? "lado A" : "lado B"}`}
                      />
                    </div>

                    <TextArea
                      label="Tese"
                      rows={3}
                      value={lado.tese}
                      onChange={(evento) =>
                        editarLado(qual, "tese", evento.target.value)
                      }
                    />

                    <div>
                      <TextArea
                        label="Argumentos (um por linha)"
                        rows={5}
                        value={lado.argumentos.join("\n")}
                        onChange={(evento) =>
                          editarLado(
                            qual,
                            "argumentos",
                            evento.target.value
                              .split("\n")
                              .map((linha) => linha.trim())
                              .filter(Boolean),
                          )
                        }
                      />
                    </div>

                    <TextArea
                      label="Tom típico"
                      rows={2}
                      value={lado.tom_tipico}
                      onChange={(evento) =>
                        editarLado(qual, "tom_tipico", evento.target.value)
                      }
                    />
                  </div>
                </Card>
              );
            })}
          </div>

          {neutros.ativo && neutros.modo !== 'fora_do_tema' ? (
            <Card variant="outlined" title="Neutro dentro do tema">
              <div className="flex flex-col gap-3">
                <p className="text-[12px] text-unooria-neutral-500">
                  Fato sem lado: cronologia, fontes, &ldquo;como se sabe
                  isso&rdquo;. Informa sem defender nenhuma das duas leituras — é
                  a terceira opção que o estudante tem no feed.
                </p>
                <ul className="flex flex-wrap gap-2">
                  {neutrosNoTema.map((rotulo) => (
                    <li key={rotulo}>
                      <button
                        type="button"
                        className="rounded-full border border-unooria-neutral-200 px-3 py-1 text-[13px] text-unooria-neutral-800 hover:border-unooria-danger hover:text-unooria-danger"
                        onClick={() =>
                          setNeutrosNoTema((atual) =>
                            atual.filter((item) => item !== rotulo),
                          )
                        }
                        title="Remover"
                      >
                        {rotulo} ✕
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <TextField
                    placeholder="Adicionar recorte sem lado"
                    value={novoNeutroNoTema}
                    onChange={(evento) => setNovoNeutroNoTema(evento.target.value)}
                    onKeyDown={(evento) => {
                      if (evento.key !== "Enter") return;
                      evento.preventDefault();
                      const valor = novoNeutroNoTema.trim();
                      if (valor.length >= 2 && !neutrosNoTema.includes(valor)) {
                        setNeutrosNoTema((atual) => [...atual, valor]);
                        setNovoNeutroNoTema("");
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    size="md"
                    isDisabled={novoNeutroNoTema.trim().length < 2}
                    onClick={() => {
                      const valor = novoNeutroNoTema.trim();
                      if (!neutrosNoTema.includes(valor)) {
                        setNeutrosNoTema((atual) => [...atual, valor]);
                        setNovoNeutroNoTema("");
                      }
                    }}
                  >
                    Adicionar
                  </Button>
                </div>
              </div>
            </Card>
          ) : null}

          {neutros.ativo && neutros.modo !== 'no_tema' ? (
          <Card variant="outlined" title="Categorias neutras">
            <div className="flex flex-col gap-3">
              <p className="text-[12px] text-unooria-neutral-500">
                Assuntos fora da disputa, para o feed parecer rede social e não
                panfleto.
              </p>
              <ul className="flex flex-wrap gap-2">
                {categorias.map((categoria) => (
                  <li key={categoria}>
                    <button
                      type="button"
                      className="rounded-full border border-unooria-neutral-200 px-3 py-1 text-[13px] text-unooria-neutral-800 hover:border-unooria-danger hover:text-unooria-danger"
                      onClick={() =>
                        setCategorias((atual) =>
                          atual.filter((item) => item !== categoria),
                        )
                      }
                      title="Remover"
                    >
                      {categoria} ✕
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <TextField
                  placeholder="Adicionar categoria neutra"
                  value={novaCategoria}
                  onChange={(evento) => setNovaCategoria(evento.target.value)}
                  onKeyDown={(evento) => {
                    if (evento.key !== "Enter") return;
                    evento.preventDefault();
                    const valor = novaCategoria.trim();
                    if (valor.length >= 2 && !categorias.includes(valor)) {
                      setCategorias((atual) => [...atual, valor]);
                      setNovaCategoria("");
                    }
                  }}
                />
                <Button
                  variant="outline"
                  size="md"
                  isDisabled={novaCategoria.trim().length < 2}
                  onClick={() => {
                    const valor = novaCategoria.trim();
                    if (!categorias.includes(valor))
                      setCategorias((atual) => [...atual, valor]);
                    setNovaCategoria("");
                  }}
                >
                  Adicionar
                </Button>
              </div>
            </div>
          </Card>
          ) : null}

          <Card variant="elevated">
            <div className="flex flex-col gap-3">
              {!equilibrioOk ? (
                <label className="flex items-start gap-2 text-[13px] text-unooria-neutral-800">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={forcar}
                    onChange={(evento) => setForcar(evento.target.checked)}
                  />
                  Gerar mesmo assim — eu assumo que a bolha pode não se formar
                  com essa pergunta.
                </label>
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="primary"
                  isLoading={gerando}
                  loadingText="Iniciando…"
                  isDisabled={
                    (!equilibrioOk && !forcar) || categorias.length < 3
                  }
                  onClick={() => void aprovarEGerar()}
                >
                  Aprovar e gerar conteúdo
                </Button>
                <span className="text-[12px] text-unooria-neutral-500">
                  Serão gerados ~{qtdPostsTese + qtdNeutros} posts (
                  {qtdPostsTese} de tese
                  {qtdNeutros > 0 ? ` + ${qtdNeutros} neutros` : ", sem neutros"}
                  ), com imagem, comentários e métricas.
                </span>
              </div>
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}
