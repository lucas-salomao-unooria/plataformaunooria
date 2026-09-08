import { HUB, suite } from "../lib/roteiro.mjs";
import { conta, escolas } from "../lib/credenciais.mjs";

/**
 * Quem trabalha em mais de uma escola — o caso que quebra a suposição mais
 * confortável da modelagem, a de que uma pessoa pertence a uma escola.
 *
 * Ele é comum na rede pública: professor com duas cadeiras, supervisor de
 * diretoria com dez unidades. A plataforma resolve isso com ESCOLA ATIVA: uma
 * por vez, trocável no cabeçalho, e é ela que entra no token.
 *
 * A regra que esta suíte prova é a mais importante e a menos óbvia: o panorama
 * LISTA as escolas, não SOMA. Nenhuma tela do produto agrega dados de duas
 * escolas — a única exceção cross-escola do sistema inteiro é o
 * `gestor_contrato`, e mesmo ele precisa dizer de qual escola está falando.
 */
const { primeira: ESCOLA_1, segunda: ESCOLA_2 } = escolas();

await suite(
  {
    slug: "gestor/02-quem-trabalha-em-duas-escolas",
    papel: "gestor_escola",
    titulo: "Quem trabalha em duas escolas",
    subtitulo: "escola ativa, o panorama que lista em vez de somar, e o que muda ao trocar",
    contexto:
      "Professor com duas cadeiras e supervisor de diretoria são a regra, não a exceção, na rede " +
      "pública. A plataforma dá a eles um seletor de escola ativa no cabeçalho — e nada mais: " +
      "nenhuma tela mistura as duas.",
    prova: [
      "Quem tem mais de uma lotação ganha um seletor de escola no cabeçalho",
      "Trocar a escola ativa muda o que a pessoa vê, porque muda o token",
      "O panorama de quem administra várias escolas LISTA, nunca soma",
      "Abrir uma escola pelo panorama troca a escola ativa e leva às pessoas dela",
    ],
    comando: "node scripts/e2e/gestor/02-quem-trabalha-em-duas-escolas.mjs",
  },
  async (r) => {
    // ── o professor com duas cadeiras ───────────────────────────────────
    const professor = conta("professor (2 unidades)");
    const p = await r.pagina("professor-de-duas");
    await r.entrar(p, professor.login);

    const seletor = p.locator('select[aria-label="Escola ativa"]');
    const temSeletor = (await seletor.count()) > 0;
    r.exigir(temSeletor, "quem tem duas lotações vê o seletor de escola ativa no cabeçalho");
    const opcoes = temSeletor ? await seletor.locator("option").allInnerTexts() : [];
    await r.registrar(p, "seletor-de-escola-ativa", {
      titulo: "O seletor de escola ativa",
      mostra: `O cabeçalho com as duas unidades deste professor: ${opcoes.join(" | ")}.`,
      prova:
        "Uma escola POR VEZ. Somar as duas numa tela só faria o professor corrigir a prova da " +
        "turma errada — e, pior, faria a plataforma atravessar a fronteira de tenancy que ela " +
        "existe para sustentar.",
      detalhe: opcoes.join(" | "),
    });

    await p.goto(`${HUB}/professor/turmas`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(1800);
    const naPrimeira = await p.locator('a[href^="/professor/turmas/"]').allInnerTexts();
    await r.registrar(p, "turmas-na-escola-1", {
      titulo: `As turmas dele na ${ESCOLA_1}`,
      mostra: naPrimeira.map((t) => t.split("\n")[0]).join(", ") || "nenhuma turma nesta unidade",
      prova: "O que ele vê é o que a escola ATIVA do token permite — nem mais, nem menos.",
      detalhe: `${naPrimeira.length} turma(s)`,
    });

    if (temSeletor) {
      /* Esperar a RESPOSTA do POST, e não um `waitForTimeout` cego: o `select`
         existe no HTML do SSR antes de o React estar hidratado, e um clique
         nesse intervalo troca o valor na tela sem chamar handler nenhum. */
      await p.waitForTimeout(2000);
      const [resposta] = await Promise.all([
        p.waitForResponse(
          (resp) => resp.url().includes("/api/escola-ativa") && resp.request().method() === "POST",
          { timeout: 20_000 },
        ),
        p.locator('select[aria-label="Escola ativa"]').selectOption({ label: ESCOLA_2 }),
      ]);
      r.exigir(resposta.ok(), `trocar a escola ativa grava no servidor (HTTP ${resposta.status()})`);

      await p.waitForTimeout(1500);
      await p.goto(`${HUB}/professor/turmas`, { waitUntil: "domcontentloaded" });
      await p.waitForTimeout(1800);
      const naSegunda = await p.locator('a[href^="/professor/turmas/"]').allInnerTexts();
      const mudou = JSON.stringify(naSegunda) !== JSON.stringify(naPrimeira);
      r.exigir(mudou, "a lista de turmas MUDOU ao trocar de escola — o token é outro");
      await r.registrar(p, "turmas-na-escola-2", {
        titulo: `E as turmas dele na ${ESCOLA_2}`,
        mostra: naSegunda.map((t) => t.split("\n")[0]).join(", ") || "nenhuma turma nesta unidade",
        prova:
          "A troca reemite o token com o outro `escola_id`. Não é filtro de tela: é a fronteira de " +
          "tenancy inteira que se move junto, incluindo as queries e a RLS.",
        detalhe: `${naSegunda.length} turma(s) · a lista ${mudou ? "mudou" : "NÃO mudou"}`,
      });
    }

    // ── a supervisora de diretoria ──────────────────────────────────────
    const supervisora = conta("gestor (supervisora");
    const s = await r.pagina("supervisora");
    await r.entrar(s, supervisora.login);

    await s.goto(`${HUB}/admin/minhas-escolas`, { waitUntil: "domcontentloaded" });
    await s.waitForTimeout(2500);
    const linhas = await s.locator("table tbody tr").allInnerTexts();
    r.exigir(linhas.length >= 2, `o panorama lista ${linhas.length} escolas desta supervisora`);
    await r.registrar(s, "panorama-do-supervisor", {
      titulo: "O panorama de quem tem muitas escolas",
      mostra: `Uma linha por unidade, com a contagem de cada uma: ${linhas.map((t) => t.split("\n")[0]).join(" | ")}.`,
      prova:
        "Ele LISTA, não soma. Um total agregado das duas escolas seria o primeiro dado " +
        "cross-escola do produto — e o começo do fim do isolamento lógico por `escola_id`.",
      detalhe: `${linhas.length} escolas`,
      inteira: true,
    });

    const trocar = s.getByRole("button", { name: "Trocar e abrir" }).first();
    if (await trocar.count()) {
      await Promise.all([
        s.waitForResponse(
          (resp) => resp.url().includes("/api/escola-ativa") && resp.request().method() === "POST",
          { timeout: 20_000 },
        ),
        trocar.click(),
      ]);
      await s.waitForURL(/\/admin\/usuarios/, { timeout: 20_000 });
      await s.waitForTimeout(2500);
      const escolaNoCabecalho = await s
        .locator('select[aria-label="Escola ativa"]')
        .inputValue()
        .catch(() => "(sem seletor)");
      await r.registrar(s, "supervisora-trocou-de-escola", {
        titulo: "Abrir uma unidade troca a escola ativa",
        mostra: "As pessoas da unidade escolhida, com o cabeçalho já apontando para ela.",
        prova:
          "Um clique faz as duas coisas — trocar e navegar — porque separá-las produziria o erro " +
          "clássico: abrir a tela da escola A com o token da escola B e ver uma lista vazia sem " +
          "entender por quê.",
        detalhe: `escola ativa: ${escolaNoCabecalho}`,
        inteira: true,
      });
    }
  },
);
