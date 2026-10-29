"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Card, FeedbackAlert, Icon, ProgressBar, SectionHeader, Tag } from "@edu/ui/ds";
import {
  CAMINHO_DAS_IMAGENS_DO_BANCO,
  CHAVES_DAS_CENAS_FIXAS,
  CHAVES_DAS_IMAGENS,
  continuarGerando,
  erroDaResposta,
  falhasAcumuladas,
  rotuloDaImagemDoBanco,
  textoDoProgressoDoBanco,
  type ChaveDoBanco,
  type GeracaoDoBancoPadrao,
  type ImagensDoBancoPadrao,
} from "@/lib/nina-noticia-tipos";

const SEM_CONEXAO = "A conexão falhou. As imagens que já saíram ficaram guardadas; tente de novo.";

type Aviso = { tipo: "success" | "warning" | "error"; texto: string };

/** Os dois grupos da tela, na ordem da api. */
const GRUPOS: readonly { id: string; titulo: string; descricao: string; chaves: readonly ChaveDoBanco[] }[] = [
  {
    id: "pacote",
    titulo: "A Feira de Troca de Livros",
    descricao:
      "As três fotos das notícias (mural, portal e telão) e o cartaz da feira — as do “Usar Banco Padrão”. A professora ainda confere e aprova cada uma antes da turma.",
    chaves: CHAVES_DAS_IMAGENS,
  },
  {
    id: "cenas-fixas",
    titulo: "O caso novo e o Desafio Extra",
    descricao:
      "As cenas fixas, iguais para todas as turmas, em toda atividade (do banco ou da IA). A professora não as refaz.",
    chaves: CHAVES_DAS_CENAS_FIXAS,
  },
];

/**
 * A grade e o laço das imagens do banco padrão da Nina. O laço é o do Júri
 * (`continuarGerando`): a api gera ATÉ OITO por chamada — as oito numa volta
 * só, quatro de cada vez —, e a tela repete enquanto falta alguma e a chamada
 * anterior gerou pelo menos uma; repetir depois de uma volta sem nada seria
 * pedir de novo as mesmas que o provedor acabou de recusar.
 *
 * Sem abas: são oito imagens, em dois grupos. Sem "refazer" — o molde do Júri
 * não tem: o arquivo é o hash do PEDIDO, e trocar a imagem de um nome que
 * outras turmas já usam mudaria a foto de uma atividade aprovada.
 */
export function ImagensDoBancoDaNina({ inicial }: { inicial: ImagensDoBancoPadrao }) {
  const [banco, setBanco] = useState<ImagensDoBancoPadrao>(inicial);
  const [gerando, setGerando] = useState(false);
  const [falhas, setFalhas] = useState<ChaveDoBanco[]>([]);
  const [aviso, setAviso] = useState<Aviso | null>(null);

  /* O laço não pode seguir pagando imagem depois que a pessoa saiu da tela. */
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  async function gerar() {
    setGerando(true);
    setAviso(null);
    let acumuladas = falhas;
    let geradas = 0;
    let ultimo: GeracaoDoBancoPadrao | null = null;
    const tetoDeVoltas = Math.max(banco.faltam.length, 1) + 2;
    try {
      for (let volta = 0; volta < tetoDeVoltas && vivo.current; volta += 1) {
        const r = await fetch(`/api/plataforma${CAMINHO_DAS_IMAGENS_DO_BANCO}`, { method: "POST" });
        if (!r.ok) {
          /* 429 `muitas-requisicoes` (o rate limit da rota) ou o provedor fora:
             a frase da api já está na voz certa. */
          const { mensagem } = erroDaResposta(await r.json().catch(() => null), "As imagens não puderam ser geradas agora.");
          if (vivo.current) setAviso({ tipo: "error", texto: mensagem });
          return;
        }
        const progresso = (await r.json()) as GeracaoDoBancoPadrao;
        if (!vivo.current) return;
        ultimo = progresso;
        geradas += progresso.geradas.length;
        acumuladas = falhasAcumuladas(acumuladas, progresso);
        setBanco({
          total: progresso.total,
          prontas: progresso.prontas,
          faltam: progresso.faltam,
          completo: progresso.completo,
          imagens: progresso.imagens,
        });
        setFalhas(acumuladas);
        if (!continuarGerando(progresso)) break;
      }
      if (!vivo.current || !ultimo) return;
      if (ultimo.completo) {
        setAviso({ tipo: "success", texto: `Concluído: as ${ultimo.total} imagens do banco estão prontas.` });
      } else {
        const faltam = ultimo.faltam.length;
        setAviso({
          tipo: "warning",
          texto:
            `${geradas === 1 ? "1 imagem saiu" : `${geradas} imagens saíram`} nesta rodada, e ` +
            `${faltam === 1 ? "1 ainda falta" : `${faltam} ainda faltam`}: o gerador recusou ou não respondeu. ` +
            "Tente de novo daqui a pouco — as que já saíram não são geradas outra vez.",
        });
      }
    } catch {
      if (vivo.current) setAviso({ tipo: "error", texto: SEM_CONEXAO });
    } finally {
      if (vivo.current) setGerando(false);
    }
  }

  return (
    <section className="flex flex-col gap-4" data-imagens-do-banco-da-nina>
      <SectionHeader
        title="Imagens do banco padrão de Nina e a Notícia que Desapareceu"
        description="As oito imagens da missão do 3º ano: as quatro da Feira de Troca de Livros, que o banco padrão usa, e as quatro cenas fixas do caso novo e do Desafio Extra, que toda atividade usa. Gerar aqui adianta o trabalho: a professora que encontrar a imagem pronta não espera nem gasta a cota dela, e a que faltar ela mesma gera no preparo."
      />

      <Card variant="outlined">
        <div className="flex flex-col gap-3">
          <ProgressBar
            label={textoDoProgressoDoBanco(banco)}
            value={banco.prontas}
            max={Math.max(banco.total, 1)}
            valueFormatter={(v, m) => `${v} de ${m}`}
            variant={banco.completo ? "success" : "brand"}
            data-progresso-do-banco
          />
          <p className="max-w-3xl text-[13px] leading-snug text-unooria-neutral-700">
            Cada rodada gera até oito imagens, quatro de cada vez, e a tela repete sozinha até não faltar nenhuma.
            Deixe esta página aberta enquanto saem. O custo aparece em Custos de IA.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Icon name="image" size={18} />}
              onClick={() => void gerar()}
              isDisabled={gerando || banco.completo}
              isLoading={gerando}
              data-acao="gerar-imagens-do-banco"
            >
              {gerando ? "Gerando…" : "Gerar as imagens que faltam"}
            </Button>
            <span className="text-[12px] leading-snug text-unooria-neutral-600" role="status" aria-live="polite">
              {gerando
                ? `Gerando as que faltam: ${banco.prontas} de ${banco.total} prontas.`
                : banco.completo
                  ? "Não falta nenhuma imagem."
                  : `${banco.faltam.length === 1 ? "Falta 1 imagem" : `Faltam ${banco.faltam.length} imagens`}.`}
            </span>
          </div>
          {falhas.length > 0 && !gerando ? (
            <p className="text-[12px] leading-snug text-unooria-neutral-700" data-falharam={falhas.length}>
              {falhas.length === 1 ? "1 imagem falhou" : `${falhas.length} imagens falharam`} nesta sessão (
              {falhas.map(rotuloDaImagemDoBanco).join("; ")}). Gerar de novo tenta só as que faltam.
            </p>
          ) : null}
          {aviso ? <FeedbackAlert type={aviso.tipo} description={aviso.texto} /> : null}
        </div>
      </Card>

      {GRUPOS.map((grupo) => (
        <Card key={grupo.id} variant="outlined" title={grupo.titulo}>
          <div className="flex flex-col gap-3" data-grupo={grupo.id}>
            <p className="max-w-3xl text-[13px] leading-snug text-unooria-neutral-700">{grupo.descricao}</p>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label={grupo.titulo}>
              {grupo.chaves.map((chave) => {
                const url = banco.imagens[chave];
                const falhou = falhas.includes(chave);
                const rotulo = rotuloDaImagemDoBanco(chave);
                return (
                  <li
                    key={chave}
                    className="flex flex-col gap-2 rounded-lg border border-unooria-neutral-200 p-3"
                    data-imagem-do-banco={chave}
                    data-tem-imagem={url ? "sim" : "nao"}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold text-unooria-neutral-950">{rotulo}</span>
                      <Tag variant={url ? "success" : falhou ? "warning" : "neutral"} size="sm">
                        {url ? "Pronta" : falhou ? "Falhou" : "Falta"}
                      </Tag>
                    </div>
                    {/* O quadro tem a proporção da foto do jornal (4:3). É MEDIDA, não componente. */}
                    <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-md bg-unooria-neutral-100">
                      {url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt={`${rotulo}, do banco padrão`} className="h-full w-full object-cover" />
                      ) : (
                        <span className="px-2 text-center text-[11px] text-unooria-neutral-600">
                          {gerando ? "Na fila para gerar" : "Ainda sem imagem: a turma vê a ilustração da missão"}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </Card>
      ))}
    </section>
  );
}
