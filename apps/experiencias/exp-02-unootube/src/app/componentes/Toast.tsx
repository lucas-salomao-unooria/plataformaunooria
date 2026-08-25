interface Props {
  mensagem: string;
  cheio: boolean;
  aoAbrirPlaylist: () => void;
}

export function Toast({ mensagem, cheio, aoAbrirPlaylist }: Props) {
  return (
    <div className={`toast ${cheio ? "toast-full" : ""}`} role="status" aria-live="polite">
      <span>{mensagem}</span>
      {cheio && <button type="button" onClick={aoAbrirPlaylist}>Abrir playlist</button>}
    </div>
  );
}
