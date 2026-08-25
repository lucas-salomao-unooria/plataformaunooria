interface Props {
  avatar: string;
  perfilSelecionado: boolean;
  aoIrParaFeed: () => void;
  aoAbrirPerfil: () => void;
  aoBuscar: () => void;
}

export function Marca() {
  return (
    <button className="brand" type="button" aria-label="Voltar ao feed do UnooTube">
      <span className="brand-mark" aria-hidden="true"><i /></span>
      <span className="youtube-wordmark">UnooTube</span>
      <sup>BR</sup>
    </button>
  );
}

export function Topbar({ avatar, perfilSelecionado, aoIrParaFeed, aoAbrirPerfil, aoBuscar }: Props) {
  return (
    <header className="topbar">
      <div className="header-left">
        <button className="menu-button" type="button" aria-label="Menu"><span aria-hidden="true">☰</span></button>
        <div onClick={aoIrParaFeed}><Marca /></div>
      </div>

      <div className="search-shell">
        <input aria-label="Pesquisar" placeholder="Pesquisar" readOnly onFocus={aoBuscar} />
        <button type="button" aria-label="Pesquisa indisponível nesta missão" onClick={aoBuscar}>
          <span className="search-glyph" aria-hidden="true" />
        </button>
      </div>

      <div className="header-right">
        <button
          className={`profile-button ${perfilSelecionado ? "selected" : ""}`}
          type="button"
          aria-label="Abrir seu perfil"
          onClick={aoAbrirPerfil}
        >
          {avatar}
        </button>
      </div>
    </header>
  );
}
