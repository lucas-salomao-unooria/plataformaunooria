import { useEffect, useRef, useState } from "react";
import { ProfileCompact, SearchBox, TopBar } from "@edu/ui/ds-unootube";

import { ContadorInscritos } from "./ContadorInscritos";

interface Props {
  avatar: string;
  inscritos: number;
  perfilSelecionado: boolean;
  aoIrParaFeed: () => void;
  aoAbrirPerfil: () => void;
  aoBuscar: () => void;
}

/**
 * Barra superior do DS (`TopBar`), com os dois blocos laterais trocados pelo
 * que esta missão precisa.
 *
 * `search`: o campo é do DS, mas a busca está BLOQUEADA durante a missão. Em
 * vez de um `readOnly` (que não avisa nada a quem digita), o campo é
 * controlado em string vazia: qualquer tecla devolve o valor para "" e dispara
 * o aviso. O aluno vê que o campo existe, como num app real, e entende por que
 * não anda. O wireframe só mostra o campo apagado; este comportamento é um
 * desvio deliberado, e é o que explica o bloqueio em vez de o esconder.
 *
 * O logotipo do DS não aceita `onClick` próprio, então o clique é capturado no
 * cabeçalho e filtrado pelo bloco da marca — é o que mantém "clicar na marca
 * volta ao feed" sem reimplementar a barra.
 *
 * O chip "Seu canal · N inscritos" (Figma `4:9`) põe na tela, desde o primeiro
 * segundo, o número que vai crescer — a nota `ETAPA 1` chama isso de linha de
 * base, e o ponto é justamente que a criança veja o zero antes de ele se mexer.
 */
export function Topbar({
  avatar,
  inscritos,
  perfilSelecionado,
  aoIrParaFeed,
  aoAbrirPerfil,
  aoBuscar,
}: Props) {
  const ganho = useGanhoDeInscritos(inscritos);
  return (
    <TopBar
      className="unootube-topbar"
      onClick={(evento) => {
        const alvo = evento.target as HTMLElement;
        if (alvo.closest(".uni-topbar__logo")) aoIrParaFeed();
      }}
      search={
        <SearchBox
          placeholder="Pesquisar"
          value=""
          showVoiceSearch={false}
          onValueChange={aoBuscar}
          onSearch={aoBuscar}
        />
      }
      actions={
        <span className="chip-do-canal">
          {ganho !== null && (
            <span className="ganho-de-inscritos" role="status">
              ↑ +{ganho.toLocaleString("pt-BR")}
            </span>
          )}
          <ProfileCompact
            initials={avatar}
            aria-label="Abrir seu perfil"
            aria-pressed={perfilSelecionado}
            className={perfilSelecionado ? "unootube-perfil-selecionado" : undefined}
            onClick={aoAbrirPerfil}
          />
          <span className="chip-do-canal__texto">
            <small>Seu canal</small>
            {/* O contador é `aria-hidden` (ele muda 60x por segundo); o valor
                final é anunciado uma vez só, aqui. */}
            <span aria-label={`${inscritos.toLocaleString("pt-BR")} inscritos`}>
              <ContadorInscritos valor={inscritos} />
              <span aria-hidden="true"> inscritos</span>
            </span>
          </span>
        </span>
      }
    />
  );
}

/**
 * O quanto o número acabou de subir, por ~1,4 s (Figma `8:11`).
 *
 * DECISÃO REGISTRADA EM ADR: o ganho por vídeo é 1.000 para um fake e 50 para
 * uma fonte confiável, então mostrá-lo torna o padrão legível DURANTE a missão
 * — antes da virada do ranking. Foi aceito porque o total já se movia (o delta
 * sempre foi derivável de dois quadros seguidos) e porque a nota `ETAPA 3` pede
 * exatamente isto: o ganho varia, e o motivo não é explicado aqui.
 *
 * Não dispara na montagem: quem volta com a missão em andamento veria um "+"
 * por algo que fez ontem.
 */
function useGanhoDeInscritos(inscritos: number): number | null {
  const [ganho, setGanho] = useState<number | null>(null);
  const anterior = useRef<number | null>(null);

  useEffect(() => {
    const antes = anterior.current;
    anterior.current = inscritos;
    if (antes === null || inscritos <= antes) return;
    setGanho(inscritos - antes);
    const timer = window.setTimeout(() => setGanho(null), 1400);
    return () => window.clearTimeout(timer);
  }, [inscritos]);

  return ganho;
}
