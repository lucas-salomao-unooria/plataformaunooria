/**
 * URLs das fontes aparecem como TEXTO, não como link: dentro do iframe sandbox
 * do hub popups são bloqueados e, por decisão de produto, estudantes de 9-10 anos
 * não saem da plataforma. O sinal pedagógico (a fonte citada) continua visível.
 */
export function Descricao({ texto }: { texto: string }) {
  return (
    <>
      {texto.split(/(https?:\/\/[^\s]+)/g).map((parte, indice) => {
        if (!parte.startsWith("http")) return <span key={`${indice}-${parte.slice(0, 8)}`}>{parte}</span>;
        const url = parte.replace(/[.,!?;:)]+$/, "");
        const sufixo = parte.slice(url.length);
        return (
          <span key={`${indice}-${url}`}>
            <span className="fonte-url">{url}</span>{sufixo}
          </span>
        );
      })}
    </>
  );
}
