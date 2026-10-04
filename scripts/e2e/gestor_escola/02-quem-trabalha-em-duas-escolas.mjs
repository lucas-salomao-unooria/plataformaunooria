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
    slug: "gestor_escola/02-quem-trabalha-em-duas-escolas",
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
      "No celular o seletor continua no cabeçalho: dá para trocar de escola pelo telefone",
    ],
    comando: "node scripts/e2e/gestor_escola/02-quem-trabalha-em-duas-escolas.mjs",
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

      // ── a experiência embutida também troca de escola ─────────────────
      /* O caso mais grave do mesmo defeito, e o menos visível: numa tela de
         embed o token viaja UMA vez, no `hub:init` que responde ao `exp:ready`.
         Se o iframe não for remontado, a experiência segue com o token da
         escola ANTERIOR em memória até ele expirar — e aí não é tela velha, é
         escrita na escola errada, que a RLS não tem como barrar porque o token
         é legítimo.

         A prova é de identidade do elemento: marca-se o iframe, troca-se a
         escola e confere-se se a marca sobreviveu. Marca ausente = elemento
         novo = handshake refeito com o token da escola nova. Não depende da
         origem do bundle (dev server ou CDN), que muda por ambiente. */
      await p.goto(`${HUB}/professor/plano-de-aula`, { waitUntil: "domcontentloaded" });
      const aparelho = p.locator('iframe[title="experiencia"]');
      await aparelho.waitFor({ state: "attached", timeout: 30_000 });
      await aparelho.evaluate((el) => {
        el.dataset.marcaDoTeste = "antes-da-troca";
      });

      await Promise.all([
        p.waitForResponse(
          (resp) => resp.url().includes("/api/escola-ativa") && resp.request().method() === "POST",
          { timeout: 20_000 },
        ),
        p.locator('select[aria-label="Escola ativa"]').selectOption({ label: ESCOLA_1 }),
      ]);
      await p.waitForTimeout(3000);

      const marcaSobreviveu = await p
        .locator('iframe[title="experiencia"]')
        .getAttribute("data-marca-do-teste");
      r.exigir(
        marcaSobreviveu === null,
        "trocar de escola REMONTA o aparelho da experiência — o token da escola anterior não fica",
      );
      const travou = await p.locator('[data-testid="erro-da-experiencia"]').count();
      r.exigir(travou === 0, "e a experiência volta funcionando depois de remontar");

      await r.registrar(p, "aparelho-remontado-na-troca", {
        titulo: "A experiência embutida acompanha a troca",
        mostra: `O Gerador de Plano de Aula recarregado já na ${ESCOLA_1}, sem F5.`,
        prova:
          "Numa tela de embed o token só viaja no handshake. Sem remontar o aparelho, o professor " +
          "continuaria escrevendo na escola de onde acabou de sair — com um token válido, que a " +
          "RLS aceita sem reclamar.",
        detalhe: marcaSobreviveu === null ? "iframe remontado" : "iframe NÃO remontado",
        inteira: true,
      });
    }

    // ── o mesmo professor, no celular (H01.3.1) ─────────────────────────
    const celular = await r.pagina("professor-no-celular", { viewport: { width: 390, height: 844 }, mobile: true });
    await r.entrar(celular, professor.login);
    const seletorNoCelular = celular.locator('select[aria-label="Escola ativa"]');
    await seletorNoCelular.waitFor({ timeout: 20_000 }).catch(() => {});
    const noCelular = await celular.evaluate(() => {
      const s = document.querySelector('select[aria-label="Escola ativa"]');
      if (!s) return { visivel: false, cabe: false };
      const caixa = s.getBoundingClientRect();
      return {
        visivel: caixa.width > 0 && caixa.height > 0,
        cabe: caixa.right <= innerWidth && document.documentElement.scrollWidth <= innerWidth,
      };
    });
    r.exigir(noCelular.visivel, "no celular, o seletor de escola ativa aparece no cabeçalho");
    r.exigir(noCelular.cabe, "e cabe na largura, sem empurrar o menu da conta para fora da tela");
    await r.registrar(celular, "seletor-no-celular", {
      titulo: "Trocar de escola pelo telefone",
      mostra: "O cabeçalho em 390px com o seletor de escola ativa ao lado do avatar.",
      prova:
        "Ele ficava escondido abaixo da largura de tablet, e quem tinha duas cadeiras não trocava de " +
        "escola no celular. Agora a caixa só encolhe: o seletor nativo do telefone abre com os nomes inteiros.",
      detalhe: noCelular.cabe ? "cabe em 390px" : "NÃO cabe em 390px",
    });

    // ── a supervisora de diretoria ──────────────────────────────────────
    const supervisora = conta("gestor_escola (supervisora");
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

      // ── trocar SEM sair da tela ───────────────────────────────────────
      /* O passo que faltava, e que deixou um defeito passar despercebido: até
         aqui toda troca desta suíte era seguida de um `goto`, que é um F5 — e o
         F5 mascara exatamente o que quebrava. O produto trocava a escola no
         token, o cabeçalho passava a dizer o nome novo, e a TELA continuava com
         os dados da escola anterior, porque `router.refresh()` re-renderiza só
         os Server Components e não remonta o Client Component que já tinha
         buscado a lista. Quem usava só descobria dando F5.

         Por isso a prova aqui é conferir a MESMA tela, sem navegar: o que
         sustenta a correção é a fronteira de remontagem por escola ativa
         (`components/escopo-da-escola.tsx`, ADR-85), e é ela que este passo
         guarda. */
      const seletorDaSupervisora = s.locator('select[aria-label="Escola ativa"]');
      const opcoesDela = await seletorDaSupervisora.locator("option").all();
      const valorAtual = await seletorDaSupervisora.inputValue();
      let outraEscola = null;
      for (const opcao of opcoesDela) {
        const valor = await opcao.getAttribute("value");
        if (valor && valor !== valorAtual) {
          outraEscola = { valor, rotulo: (await opcao.innerText()).trim() };
          break;
        }
      }

      if (outraEscola) {
        const antesDaTroca = await s.locator("table tbody tr").allInnerTexts();

        /* A prova é a lista ser BUSCADA de novo. Sem a fronteira, este `fetch`
           simplesmente não acontece — então a espera é pela requisição, e não
           por um seletor que continuaria ali com o conteúdo velho. O `catch`
           existe para o vermelho dizer a verdade: um timeout cru reportaria
           "esperei 20s por uma resposta" no lugar do que de fato falhou. */
        const listaRecarregada = s
          .waitForResponse(
            (resp) =>
              resp.url().includes("/api/plataforma/usuarios") && resp.request().method() === "GET",
            { timeout: 20_000 },
          )
          .then(() => true)
          .catch(() => false);

        await Promise.all([
          s.waitForResponse(
            (resp) => resp.url().includes("/api/escola-ativa") && resp.request().method() === "POST",
            { timeout: 20_000 },
          ),
          seletorDaSupervisora.selectOption(outraEscola.valor),
        ]);

        const buscouDeNovo = await listaRecarregada;
        r.exigir(
          buscouDeNovo,
          "trocar a escola no cabeçalho REBUSCA a lista da tela aberta, sem recarregar a página",
        );

        await s.waitForTimeout(2000);
        const depoisDaTroca = await s.locator("table tbody tr").allInnerTexts();
        const mudouSemF5 = JSON.stringify(depoisDaTroca) !== JSON.stringify(antesDaTroca);
        r.exigir(mudouSemF5, "a lista de pessoas na tela MUDOU sem F5");
        r.exigir(
          s.url().includes("/admin/usuarios"),
          "e nada disso navegou: a prova é a mesma tela, não uma tela nova",
        );

        await r.registrar(s, "troca-sem-recarregar-a-pagina", {
          titulo: "Trocar de escola sem sair da tela",
          mostra: `A mesma tela de Usuários, agora com as pessoas da ${outraEscola.rotulo} — sem F5.`,
          prova:
            "Trocar de escola é mover a fronteira de tenancy inteira, e a tela aberta precisa " +
            "acompanhar. Quando não acompanhava, o cabeçalho dizia uma escola e a tabela mostrava " +
            "outra — e a pessoa agia sobre a lista errada acreditando no cabeçalho.",
          detalhe: `${antesDaTroca.length} → ${depoisDaTroca.length} linha(s) · escola ativa: ${outraEscola.rotulo}`,
          inteira: true,
        });
      }
    }
  },
);
