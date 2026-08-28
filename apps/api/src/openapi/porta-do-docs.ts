import { createHash, timingSafeEqual } from "node:crypto";

/** O mínimo do express que esta porta usa — evita depender de `@types/express`,
 *  que não é dependência da api (o `express` chega só por baixo do Nest). */
type Requisicao = { headers: Record<string, string | string[] | undefined> };
type Resposta = {
  setHeader(nome: string, valor: string): void;
  status(codigo: number): Resposta;
  send(corpo: string): void;
};
type Adiante = () => void;

export type CredenciaisDoDocs = { usuario: string; senha: string };

/**
 * As credenciais do `/docs`, ou `null` quando a documentação não deve subir.
 *
 * **Variável ausente ⇒ a rota não é montada, e quem responde é o 404 do
 * roteador.** Não 401. As rotas de serviço da casa devolvem 401/503 quando a
 * env falta, mas ali a existência da rota já é pública — aqui o ativo protegido
 * É o mapa das 146 rotas, e um 401 confirmaria que ele está atrás daquela porta.
 * A api tem domínio próprio no balanceador (docs/INFRA.md), então isto não é
 * defesa em profundidade: é a barreira.
 */
export function credenciaisDoDocs(env: NodeJS.ProcessEnv = process.env): CredenciaisDoDocs | null {
  const usuario = env.SWAGGER_USUARIO;
  const senha = env.SWAGGER_SENHA;
  if (!usuario || !senha) return null;
  return { usuario, senha };
}

/** Comparação de tempo constante. O sha256 entra para igualar o comprimento —
 *  `timingSafeEqual` estoura com buffers de tamanhos diferentes, e o tamanho da
 *  senha vazaria justamente pelo erro. */
function igual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

function credencialEnviada(req: Requisicao): { usuario: string; senha: string } | null {
  const bruto = req.headers.authorization;
  const cabecalho = Array.isArray(bruto) ? bruto[0] : bruto;
  if (!cabecalho?.startsWith("Basic ")) return null;
  const decodificado = Buffer.from(cabecalho.slice("Basic ".length), "base64").toString("utf8");
  const corte = decodificado.indexOf(":");
  if (corte < 0) return null;
  // Corta no PRIMEIRO ":": senha com dois-pontos é legítima e um `split(":")`
  // a truncaria, recusando quem digitou a senha certa.
  return { usuario: decodificado.slice(0, corte), senha: decodificado.slice(corte + 1) };
}

export function portaDoDocs(credenciais: CredenciaisDoDocs) {
  return (req: Requisicao, res: Resposta, next: Adiante): void => {
    const enviada = credencialEnviada(req);
    // As duas comparações rodam SEMPRE, e só depois entram no `&&`: parar na
    // primeira diria, pelo tempo de resposta, que o usuário já estava certo.
    const usuarioOk = enviada ? igual(enviada.usuario, credenciais.usuario) : false;
    const senhaOk = enviada ? igual(enviada.senha, credenciais.senha) : false;
    if (usuarioOk && senhaOk) {
      next();
      return;
    }
    // Realm em ASCII puro: cabeçalho HTTP é latin-1, e o "ç" de "Documentação"
    // chegava ao navegador como byte inválido. O `charset` do RFC 7617 fala das
    // CREDENCIAIS enviadas, não do realm — não salva o acento.
    res.setHeader("WWW-Authenticate", 'Basic realm="Documentacao da API", charset="UTF-8"');
    // Sem `index`/`follow`: documento de API atrás de senha não deve acabar
    // num buscador se um dia a senha for removida por engano.
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    res.status(401).send("Credencial necessária.");
  };
}
