import { lazy, type ComponentType } from "react";

/**
 * `React.lazy` com repetição — para os dois pedaços que chegam SÓ na hora
 * (a ficha técnica e a explicação, ver `lib/textos-da-ficha.ts`).
 *
 * O chunk é baixado no instante em que a professora aperta o botão, com trinta
 * máquinas pedindo ao mesmo tempo no Wi-Fi da escola. Um `import()` que falha
 * uma vez derrubaria a árvore inteira (não há fronteira de erro que traga o
 * chunk de volta), então ele tenta de novo: 1 s, 2 s, 4 s, 8 s — e só depois
 * desiste e deixa o erro subir para o SDK, que o reporta e avisa o hub.
 */
export function preguicoso<P extends object>(carregar: () => Promise<{ default: ComponentType<P> }>) {
  return lazy(async () => {
    let ultimoErro: unknown;
    for (let tentativa = 0; tentativa < 5; tentativa += 1) {
      try {
        return await carregar();
      } catch (erro) {
        ultimoErro = erro;
        await new Promise((resolve) => window.setTimeout(resolve, 1000 * 2 ** tentativa));
      }
    }
    throw ultimoErro;
  });
}
