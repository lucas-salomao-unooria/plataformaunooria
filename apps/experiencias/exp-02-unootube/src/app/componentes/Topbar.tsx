import { ProfileCompact, SearchBox, TopBar } from "@edu/ui/ds-unootube";

interface Props {
  avatar: string;
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
 * não anda.
 *
 * O logotipo do DS não aceita `onClick` próprio, então o clique é capturado no
 * cabeçalho e filtrado pelo bloco da marca — é o que mantém "clicar na marca
 * volta ao feed" sem reimplementar a barra.
 */
export function Topbar({ avatar, perfilSelecionado, aoIrParaFeed, aoAbrirPerfil, aoBuscar }: Props) {
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
        <ProfileCompact
          initials={avatar}
          aria-label="Abrir seu perfil"
          aria-pressed={perfilSelecionado}
          className={perfilSelecionado ? "unootube-perfil-selecionado" : undefined}
          onClick={aoAbrirPerfil}
        />
      }
    />
  );
}
