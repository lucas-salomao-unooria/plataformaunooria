/**
 * Termos de Uso — página pública (`/termos`).
 *
 * O texto é dado (`SECOES`), não marcação livre: a casca numera, ancora e
 * monta o sumário a partir da mesma lista que renderiza o corpo. Ver
 * `components/legal/casca-legal.tsx`.
 *
 * ---------------------------------------------------------------------------
 * Decisões de redação — o porquê junto da regra, porque cada uma delas é uma
 * cláusula que uma peça de contrato genérica traria e que AQUI seria nula,
 * abusiva ou simplesmente falsa.
 *
 * 1. QUEM CONTRATA NÃO É QUEM USA. O contratante é uma rede pública, por
 *    contrato administrativo. O estudante não assinou nada, não paga nada e,
 *    na maior parte das vezes, não escolheu estar aqui. Por isso estes Termos
 *    regem o USO e dizem isso na primeira seção: eles não substituem o
 *    contrato com a rede e não impõem ao usuário final obrigação que só o
 *    contratante poderia assumir. Tratar o estudante como parte de um contrato
 *    de adesão seria ficção — e ficção que o CDC art. 51, IV derruba.
 *
 * 2. NÃO HÁ FORO DE ELEIÇÃO. Dois vetores em direções opostas: a Lei
 *    14.133/2021, art. 92, §1º manda o contrato com a Administração eleger o
 *    foro da SEDE DA ADMINISTRAÇÃO; e cláusula de foro que dificulte a defesa
 *    de titular hipossuficiente — ainda mais menor de idade — é abusiva
 *    (CDC art. 51, IV). Eleger foro aqui ou brigaria com o contrato ou seria
 *    nulo. A seção 15 remete ao contrato e ressalva, expressamente, o direito
 *    do usuário de acionar o juízo do próprio domicílio.
 *
 * 3. NÃO HÁ LIMITAÇÃO AMPLA DE RESPONSABILIDADE. O CDC art. 51 fulmina de
 *    pleno direito a exoneração por vício do serviço (I), a transferência de
 *    responsabilidade a terceiros (III) — inclusive o clássico “a
 *    responsabilidade pelos dados é da escola” —, a desvantagem exagerada (IV),
 *    a inversão do ônus da prova (VI) e a arbitragem compulsória (VII). E o
 *    art. 42, §1º, I da LGPD faz o operador responder solidariamente quando
 *    descumpre a lei. “Somos só operadores” não é escudo, então não está
 *    escrito. O que a seção 15 faz é o que se pode fazer: dizer qual é a
 *    disponibilidade prometida (a do contrato) e não excluir nada além disso.
 *
 * 4. O PRODUTO É DESCRITO COMO ELE É. As experiências SIMULAM Instagram,
 *    YouTube, ChatGPT e WhatsApp; o conteúdo do feed é gerado por IA, com
 *    personas fictícias; não existe interação entre estudantes reais nem
 *    publicação para colegas. Sem isso escrito com destaque, a família acredita
 *    que o filho está numa rede social — e o produto passa a prometer, por
 *    silêncio, o oposto do que é.
 *
 * 5. A IA TEM SEÇÃO PRÓPRIA porque é obrigação vigente: Decreto 12.880/2026,
 *    art. 11, I — transparência quanto ao caráter sintético e automatizado da
 *    interação, em produto acessível a menores.
 *
 * 6. NADA DE `[A DEFINIR]` NO TEXTO CORRIDO. O que depende do cliente está no
 *    bloco `IDENTIFICACAO` abaixo — ÚNICO LUGAR A TROCAR — e o que ainda não
 *    foi decidido está reunido, sem disfarce, na última seção.
 *
 * 7. LINGUAGEM. O leitor típico tem entre 11 e 17 anos e lê isto na escola.
 *    Frases curtas, voz ativa, sem juridiquês decorativo e sem infantilizar —
 *    exigência do art. 14, §6º da LGPD e do art. 18, §1º da Lei 15.211/2025,
 *    não escolha de estilo.
 */

import { CascaLegal, type SecaoLegal } from "@/components/legal/casca-legal";

export const metadata = {
  title: "Termos de Uso — Unooria",
  description:
    "As regras de uso da Plataforma Unooria: o que a plataforma é, o que cada perfil pode fazer, como a inteligência artificial aparece e a quem recorrer.",
};

/**
 * Dados que dependem do cliente e da constituição da empresa.
 *
 * ESTE É O ÚNICO LUGAR A TROCAR. O texto das seções lê daqui; nenhuma seção
 * repete um endereço ou um nome à mão. Campo vazio aparece na última seção
 * como pendência declarada, nunca como lacuna no meio de um parágrafo.
 *
 * `contato` e `acessibilidade` precisam ser CONFERIDOS antes da publicação —
 * caixa que não existe é pior que caixa nenhuma, porque a página promete um
 * canal e a mensagem volta.
 */
const IDENTIFICACAO = {
  /** Nome comercial usado no texto. */
  nome: "Unooria",
  /** Razão social completa, como no contrato. */
  razaoSocial: "",
  /** CNPJ, formatado. */
  cnpj: "",
  /** Canal geral de contato e de denúncia. */
  contato: "",
  /** Canal para pedir adaptação de acessibilidade. */
  acessibilidade: "",
};

/** Campo do bloco acima ainda vazio: cai numa frase honesta, nunca num `[A DEFINIR]`. */
const ou = (valor: string, quandoVazio: string) => (valor === "" ? quandoVazio : valor);

const SECOES: SecaoLegal[] = [
  {
    id: "quem-e-quem",
    titulo: "Quem é quem aqui",
    conteudo: (
      <>
        <p>
          Estes Termos explicam como a Plataforma {IDENTIFICACAO.nome} pode ser usada. Eles valem
          para quem usa: estudantes, professores e a equipe gestora da escola.
        </p>
        <p>
          <strong>Você não contratou nada e não paga nada.</strong> Quem contrata a plataforma é a
          sua rede de ensino — a secretaria estadual ou municipal —, por meio de um contrato público.
          É esse contrato que decide prazos, preços, obrigações e responsabilidades entre a rede e a{" "}
          {IDENTIFICACAO.nome}. Estes Termos não substituem esse contrato e não criam para você
          nenhuma obrigação que só a rede poderia assumir.
        </p>
        <div className="legal-cards">
          <div className="legal-card">
            <p className="legal-card__titulo">A {IDENTIFICACAO.nome}</p>
            <p className="legal-card__texto">
              Desenvolve e opera o software. Cuida da infraestrutura, da segurança e das correções.
            </p>
          </div>
          <div className="legal-card">
            <p className="legal-card__titulo">A rede de ensino</p>
            <p className="legal-card__texto">
              Contrata a plataforma, decide quais escolas e turmas a usam, cadastra as pessoas e
              define o uso pedagógico. É a dona da relação com você.
            </p>
          </div>
          <div className="legal-card">
            <p className="legal-card__titulo">Você</p>
            <p className="legal-card__texto">
              Usa a plataforma dentro da escola. Tem direitos garantidos por lei, e nenhum deles é
              afastado por este texto.
            </p>
          </div>
        </div>
        <p>
          A razão social, o CNPJ e os canais oficiais da empresa estão na{" "}
          <a href="#em-definicao">última seção</a>.
        </p>
      </>
    ),
  },

  {
    id: "o-que-e-a-plataforma",
    titulo: "O que é a plataforma",
    conteudo: (
      <>
        <p>
          A Plataforma {IDENTIFICACAO.nome} tem duas partes. A primeira é o <strong>hub</strong>: a
          área onde você entra com seu login, vê suas turmas, seu percurso e abre as missões. A
          segunda são as <strong>experiências</strong> — atividades imersivas que abrem dentro do
          hub, cada uma com um tema, uma série e um objetivo pedagógico.
        </p>
        <p>
          Uma experiência não é um site solto na internet: ela roda dentro de uma moldura fechada, com
          permissões limitadas, e conversa apenas com os serviços da própria plataforma. Ela não pede
          câmera, microfone nem sua localização. A única permissão especial que existe hoje é o
          travamento do cursor no jogo em três dimensões da Vila do Lume — o mesmo recurso que
          qualquer jogo de computador usa para você olhar em volta.
        </p>
        <p>
          <strong>Não há publicidade.</strong> Nenhum anúncio, nenhum patrocínio dentro do conteúdo,
          nenhuma compra, nenhuma caixa de recompensa paga, nenhum ranking que dependa de gastar
          dinheiro. Também não existe perfil comportamental para fins publicitários. Isso não é uma
          promessa comercial: é vedação da Lei 15.211/2025 e do Decreto 12.880/2026.
        </p>
      </>
    ),
  },

  {
    id: "simulacoes",
    titulo: "As experiências são simulações — leia esta parte",
    conteudo: (
      <>
        <div className="legal-nota legal-nota--atencao">
          <div className="legal-nota__corpo">
            <p>
              <strong>
                Algumas experiências se parecem com aplicativos que você conhece. Elas não são esses
                aplicativos.
              </strong>{" "}
              São cópias de mentira, feitas para a aula. Nada do que acontece ali sai para a internet,
              e ninguém de fora da escola vê.
            </p>
          </div>
        </div>
        <p>
          O Instanooria imita um aplicativo de fotos; o UnooTube, um site de vídeos; o UnooGPT, um
          assistente de conversa; O Eco no Grupo, um aplicativo de mensagens. A semelhança é
          proposital: a missão só funciona se o ambiente parecer o de verdade. Mas o ambiente é
          fechado, e a diferença importa.
        </p>
        <div className="legal-cards">
          <div className="legal-card">
            <p className="legal-card__titulo">Os perfis não são pessoas</p>
            <p className="legal-card__texto">
              As contas, os vídeos, as fotos, os comentários e as reações que você vê no feed são
              conteúdo gerado por inteligência artificial. As pessoas ali são personagens inventados.
            </p>
          </div>
          <div className="legal-card">
            <p className="legal-card__titulo">Você não publica para colegas</p>
            <p className="legal-card__texto">
              O que você escreve na missão não aparece para outros estudantes. Não há feed
              compartilhado, não há mural da turma, não há mensagem de um estudante para outro.
            </p>
          </div>
          <div className="legal-card">
            <p className="legal-card__titulo">Não há público externo</p>
            <p className="legal-card__texto">
              Nada é postado no Instagram, no YouTube, no WhatsApp nem em qualquer serviço de fora. A
              plataforma não se conecta a essas empresas e não é ligada a elas.
            </p>
          </div>
          <div className="legal-card">
            <p className="legal-card__titulo">Quem lê é o seu professor</p>
            <p className="legal-card__texto">
              O que você escreve fica registrado e aparece para o professor da sua turma, que usa
              aquilo para conduzir a aula. É a parte que mais surpreende — por isso está escrita aqui.
            </p>
          </div>
        </div>
        <p>
          Os nomes e as marcas dos aplicativos imitados pertencem a seus donos. As experiências são
          material pedagógico e não têm nenhuma relação, autorização ou patrocínio dessas empresas.
        </p>
      </>
    ),
  },

  {
    id: "quem-pode-usar",
    titulo: "Quem pode usar, e a partir de que idade",
    conteudo: (
      <>
        <p>
          A plataforma é feita para a escola pública e atende do 1º ano do ensino fundamental ao 3º
          ano do ensino médio. Ou seja: <strong>o público é formado por menores de idade</strong>, e a
          plataforma foi construída sabendo disso. Não fingimos que o serviço é para adultos.
        </p>
        <p>
          Cada experiência declara para qual série ela foi desenhada e em que unidade do ano ela entra.
          O professor escolhe quando abrir cada uma. Não existe conteúdo adulto, violento ou impróprio:
          o material é curricular e passa por revisão pedagógica antes de chegar à turma.
        </p>
        <p>
          Você não escolhe sua idade nem sua turma aqui, e a plataforma não pergunta isso. Esses dados
          vêm do cadastro que a sua rede de ensino já mantém.
        </p>
      </>
    ),
  },

  {
    id: "contas-e-acesso",
    titulo: "Sua conta, sua senha e seu acesso",
    conteudo: (
      <>
        <p>
          <strong>Não existe cadastro por conta própria.</strong> Ninguém cria uma conta na plataforma
          sozinho. As contas são criadas pela escola ou pela rede, a partir da lista de estudantes e
          servidores que ela já tem. Se algum dado seu está errado — nome, turma, matrícula —, quem
          corrige é a secretaria da escola, porque é de lá que o dado vem.
        </p>
        <div className="legal-cards">
          <div className="legal-card">
            <p className="legal-card__titulo">Primeiro acesso</p>
            <p className="legal-card__texto">
              A escola entrega uma senha provisória. Na primeira entrada, a plataforma obriga você a
              trocá-la antes de qualquer outra coisa.
            </p>
          </div>
          <div className="legal-card">
            <p className="legal-card__titulo">Sessão</p>
            <p className="legal-card__texto">
              A sessão dura no máximo o dia de aula e depois expira sozinha. Ao abrir uma experiência,
              ela recebe uma autorização de curta duração, guardada só na memória do navegador — nunca
              gravada no aparelho.
            </p>
          </div>
          <div className="legal-card">
            <p className="legal-card__titulo">Tentativas de entrada</p>
            <p className="legal-card__texto">
              Há um limite de tentativas de login por minuto. Errar a senha várias vezes seguidas
              bloqueia a entrada por um tempo curto — é proteção, não punição.
            </p>
          </div>
        </div>
        <p>
          Use um computador ou celular compartilhado com cuidado: <strong>saia da sua conta</strong> ao
          terminar. Se você perder a senha ou desconfiar que alguém a descobriu, avise seu professor ou
          a secretaria da escola no mesmo dia.
        </p>
      </>
    ),
  },

  {
    id: "o-que-cada-perfil-faz",
    titulo: "O que cada perfil pode fazer",
    conteudo: (
      <>
        <p>
          A plataforma tem quatro perfis. O que você enxerga depende do seu, e o limite não é só de
          tela: o servidor recusa o que o perfil não pode, mesmo que alguém tente pelo caminho errado.
        </p>
        <div className="legal-cards">
          <div className="legal-card">
            <p className="legal-card__titulo">Estudante</p>
            <p className="legal-card__texto">
              Entra nas missões da própria turma, produz dentro delas e acompanha o próprio percurso.
            </p>
            <dl className="legal-card__campos">
              <div className="legal-card__campo">
                <dt>Enxerga</dt>
                <dd>o que é seu</dd>
              </div>
              <div className="legal-card__campo">
                <dt>Não enxerga</dt>
                <dd>dados de colegas, de outras turmas ou de outras escolas</dd>
              </div>
            </dl>
          </div>
          <div className="legal-card">
            <p className="legal-card__titulo">Professor</p>
            <p className="legal-card__texto">
              Prepara e conduz a aula, acompanha a turma, lê a produção dos estudantes e usa as
              ferramentas de trabalho docente.
            </p>
            <dl className="legal-card__campos">
              <div className="legal-card__campo">
                <dt>Enxerga</dt>
                <dd>as turmas em que está lotado</dd>
              </div>
              <div className="legal-card__campo">
                <dt>Não enxerga</dt>
                <dd>turmas de outros professores nem outras escolas</dd>
              </div>
            </dl>
          </div>
          <div className="legal-card">
            <p className="legal-card__titulo">Gestor</p>
            <p className="legal-card__texto">
              Cuida do cadastro da escola: importa as listas, corrige dados, monta turmas e emite o
              perfil de quem se transfere.
            </p>
            <dl className="legal-card__campos">
              <div className="legal-card__campo">
                <dt>Enxerga</dt>
                <dd>a escola dele, incluindo dados cadastrais</dd>
              </div>
              <div className="legal-card__campo">
                <dt>Não enxerga</dt>
                <dd>outras escolas da rede</dd>
              </div>
            </dl>
          </div>
          <div className="legal-card">
            <p className="legal-card__titulo">Administrador do contrato</p>
            <p className="legal-card__texto">
              Perfil da rede. É o único que atravessa escolas, para acompanhar o contrato inteiro e
              extrair relatórios agregados.
            </p>
            <dl className="legal-card__campos">
              <div className="legal-card__campo">
                <dt>Enxerga</dt>
                <dd>todas as escolas do contrato</dd>
              </div>
              <div className="legal-card__campo">
                <dt>Quem indica</dt>
                <dd>a rede de ensino, não a escola</dd>
              </div>
            </dl>
          </div>
        </div>
      </>
    ),
  },

  {
    id: "regras-de-convivencia",
    titulo: "Regras de convivência",
    conteudo: (
      <>
        <p>
          São poucas e todas têm a mesma razão: a plataforma é um lugar de aula, e o que acontece aqui
          afeta gente real. Elas valem para todos os perfis.
        </p>
        <div className="legal-cards">
          <div className="legal-card">
            <p className="legal-card__titulo">Sua senha é sua</p>
            <p className="legal-card__texto">
              Não empreste, não peça a de ninguém e não entre com a conta de outra pessoa. O que for
              feito na sua conta aparece como seu.
            </p>
          </div>
          <div className="legal-card">
            <p className="legal-card__titulo">Não exponha ninguém</p>
            <p className="legal-card__texto">
              Nada de escrever nome, foto, endereço, telefone ou segredo de um colega, de um professor
              ou de qualquer pessoa. Nem para brincar. Nem em campo de texto de missão.
            </p>
          </div>
          <div className="legal-card">
            <p className="legal-card__titulo">A inteligência artificial não é atalho para machucar</p>
            <p className="legal-card__texto">
              Não use as ferramentas de IA para criar ofensa, ameaça, discurso de ódio, conteúdo sexual
              ou material que exponha alguém. O que você pede fica registrado.
            </p>
          </div>
          <div className="legal-card">
            <p className="legal-card__titulo">Não tente burlar</p>
            <p className="legal-card__texto">
              Não tente entrar em área de outro perfil, alterar respostas pelo caminho, sobrecarregar o
              serviço, copiar conteúdo em massa ou explorar falha em vez de avisá-la.
            </p>
          </div>
          <div className="legal-card">
            <p className="legal-card__titulo">Achou uma falha? Conte</p>
            <p className="legal-card__texto">
              Quem avisa sobre um problema de segurança ajuda e não é punido por isso. Quem se aproveita
              dele em silêncio, sim.
            </p>
          </div>
          <div className="legal-card">
            <p className="legal-card__titulo">O conteúdo é da aula</p>
            <p className="legal-card__texto">
              O material das experiências é para uso pedagógico dentro da plataforma. Não republique
              como se fosse seu nem venda o que encontrar aqui.
            </p>
          </div>
        </div>
        <h3>O que acontece se uma regra for quebrada</h3>
        <p>
          Nada é automático e nada é secreto. A plataforma não expulsa ninguém por conta própria: quem
          decide é a escola, dentro das regras dela e do regimento escolar, como em qualquer outra
          situação da vida escolar. Se for preciso interromper um acesso por segurança — uma conta
          claramente invadida, por exemplo —, a interrupção é comunicada à escola e o motivo é
          registrado.
        </p>
        <p>
          Você tem direito de saber o que foi apontado, de dar sua versão e de pedir que a decisão seja
          revista. Não existe punição em silêncio.
        </p>
      </>
    ),
  },

  {
    id: "inteligencia-artificial",
    titulo: "A inteligência artificial na plataforma",
    conteudo: (
      <>
        <div className="legal-nota">
          <div className="legal-nota__corpo">
            <p>
              <strong>
                Quando você conversa com um personagem, lê um comentário do feed ou recebe uma
                devolutiva escrita, quem escreveu foi um computador.
              </strong>{" "}
              É conteúdo sintético, gerado automaticamente. Não é uma pessoa do outro lado.
            </p>
          </div>
        </div>
        <p>Hoje a IA aparece nestes lugares:</p>
        <ul>
          <li>no feed do Instanooria, criando os perfis, as publicações e as reações dos personagens;</li>
          <li>no UnooGPT, na conversa com o personagem que responde às suas perguntas;</li>
          <li>em O Eco no Grupo, na conversa com a personagem e na devolutiva sobre suas escolhas;</li>
          <li>nas ferramentas do professor: no rascunho do plano de aula e no texto do check-in de bem-estar.</li>
        </ul>
        <h3>O que você precisa saber sobre ela</h3>
        <p>
          <strong>Ela erra.</strong> Um modelo de linguagem inventa fatos com naturalidade, escreve com
          segurança sobre o que não sabe e às vezes contradiz o que disse antes. Trate o que ela diz
          como material para discutir na aula, não como resposta certa. Confira antes de usar.
        </p>
        <p>
          <strong>Ela não substitui o professor.</strong> A IA não avalia, não dá nota e não decide
          nada sobre a sua vida escolar. Quem lê, interpreta e avalia é o professor.
        </p>
        <p>
          <strong>O que você escreve é enviado para processamento.</strong> Para gerar a resposta, o
          texto que você digitou sai da plataforma e vai para o serviço de inteligência artificial que
          a plataforma utiliza. Ele fica registrado na plataforma e fica visível para o professor da sua turma.
          Por isso: não escreva ali informação pessoal sua ou de outra pessoa.
        </p>
        <p>
          <strong>Há um limite de uso por dia.</strong> Cada pessoa tem uma cota diária de IA, diferente
          para estudante e para professor. Ao atingi-la, as funções que dependem de IA param até o dia
          seguinte — o resto da plataforma continua funcionando. A cota existe para manter o custo
          previsível para a rede e para desestimular uso compulsivo.
        </p>
        <p>
          <strong>Seu texto não vira treinamento.</strong> A {IDENTIFICACAO.nome} não usa o que
          estudantes e professores escrevem para treinar modelos de inteligência artificial, nem para
          qualquer finalidade fora do contrato com a rede de ensino.
        </p>
        <p>
          Onde a IA passa perto de saúde ou de sentimento — como no check-in de bem-estar do professor —
          o uso é voluntário, o resultado não vai para a gestão e o titular pode apagar tudo o que
          respondeu. Detalhes na <a href="/privacidade">Política de Privacidade</a>.
        </p>
      </>
    ),
  },

  {
    id: "correcao-e-nota",
    titulo: "Correção, pontuação e nota",
    conteudo: (
      <>
        <p>
          Quando uma missão tem resposta certa, quem corrige é o servidor da plataforma, não o programa
          que roda no seu navegador. O gabarito nunca é enviado para o aparelho. Isso vale também para
          a pontuação: ela é calculada no servidor a partir do que você fez, e o aparelho não pode
          informar a própria nota.
        </p>
        <p>
          <strong>A plataforma não atribui nota escolar.</strong> Ela registra o que você fez e mostra
          isso ao professor. A nota do boletim é decisão dele, dentro dos critérios da escola. Nenhum
          texto escrito por inteligência artificial entra nessa conta.
        </p>
        <p>
          Se você discordar de uma pontuação ou de um retrato que a plataforma mostrou sobre você — como
          o resumo de escolhas ao fim de uma missão —, fale com seu professor e peça revisão. Você tem
          direito de entender em que critérios aquilo se baseou.
        </p>
      </>
    ),
  },

  {
    id: "o-que-e-de-quem",
    titulo: "O que é de quem",
    conteudo: (
      <>
        <div className="legal-cards">
          <div className="legal-card">
            <p className="legal-card__titulo">Da {IDENTIFICACAO.nome}</p>
            <p className="legal-card__texto">
              O software, o design, a marca, o conteúdo pedagógico das experiências e o material gerado
              para as missões. A rede recebe licença de uso enquanto o contrato durar; não há cessão de
              propriedade.
            </p>
          </div>
          <div className="legal-card">
            <p className="legal-card__titulo">Do estudante</p>
            <p className="legal-card__texto">
              O que você escreve, cria e responde continua sendo seu. A plataforma usa isso apenas para
              o fim pedagógico da missão e para mostrar ao professor da sua turma.
            </p>
            <dl className="legal-card__campos">
              <div className="legal-card__campo">
                <dt>Não fazemos</dt>
                <dd>usar sua produção em propaganda, vendê-la ou usá-la para treinar modelos</dd>
              </div>
            </dl>
          </div>
          <div className="legal-card">
            <p className="legal-card__titulo">Do professor</p>
            <p className="legal-card__texto">
              Planos de aula e materiais que o professor escreve na plataforma são obra dele. O rascunho
              gerado por IA fica guardado ao lado da versão editada, para comparação.
            </p>
          </div>
          <div className="legal-card">
            <p className="legal-card__titulo">Da rede de ensino</p>
            <p className="legal-card__texto">
              O currículo, os materiais próprios e os dados cadastrais que a rede carrega na plataforma
              continuam dela.
            </p>
          </div>
        </div>
        <p>
          A escola e a rede têm acesso à produção do estudante para fim pedagógico e de acompanhamento
          escolar — é para isso que a plataforma existe. Fora disso, não reivindicamos nenhuma licença
          sobre o que um estudante produz.
        </p>
      </>
    ),
  },

  {
    id: "privacidade-e-dados",
    titulo: "Privacidade e dados pessoais",
    conteudo: (
      <>
        <p>
          O detalhe está na <a href="/privacidade">Política de Privacidade</a>, que é parte destes
          Termos e pode ser lida sem login. O resumo:
        </p>
        <ul>
          <li>
            <strong>Quem manda nos dados é a sua rede de ensino.</strong> Ela é a controladora; a{" "}
            {IDENTIFICACAO.nome} trata os dados seguindo as instruções dela.
          </li>
          <li>
            <strong>O tratamento não depende do seu consentimento</strong> — e não é por descuido. O
            serviço faz parte de uma política pública de educação, e é essa a base legal. Por isso não
            há botão de “aceito” fingindo uma escolha que não existe.
          </li>
          <li>
            <strong>Os dados de cada escola são separados no banco</strong>, com exceções nominadas na
            Política — como o perfil de quem se transfere de escola.
          </li>
          <li>
            <strong>Seus direitos da LGPD valem</strong>: saber o que existe sobre você, acessar,
            corrigir, se opor. O pedido começa na escola ou na rede, que é a controladora.
          </li>
        </ul>
        <p>
          A plataforma não pede câmera, microfone nem localização, e não acompanha sua navegação fora
          dela.
        </p>
      </>
    ),
  },

  {
    id: "acessibilidade",
    titulo: "Acessibilidade",
    conteudo: (
      <>
        <p>
          Acessibilidade digital é obrigação legal — Lei 13.146/2015, artigos 55 e 63 —, não cortesia. A
          plataforma é construída para funcionar com teclado, com leitor de tela, com contraste
          suficiente, com foco visível e sem depender apenas de cor para transmitir informação. O alvo
          declarado é o padrão internacional WCAG na versão 2.2, nível AA.
        </p>
        <p>
          Isso é o alvo, e ainda não foi auditado por terceiro. Se algo na plataforma impede você de
          estudar ou de trabalhar — uma tela que o leitor não lê, um controle que o teclado não alcança,
          um texto que você não consegue enxergar —, avise: é defeito nosso, e adaptação de conteúdo ou
          de interface pode ser feita.
        </p>
        <p>Canal para pedir adaptação: {ou(IDENTIFICACAO.acessibilidade, "ver a última seção")}.</p>
      </>
    ),
  },

  {
    id: "denuncia-e-suporte",
    titulo: "Como pedir ajuda e como denunciar",
    conteudo: (
      <>
        <p>
          <strong>Problema com a aula, com a turma ou com uma conta:</strong> fale com seu professor ou
          com a secretaria da escola. É o caminho mais rápido, e quase tudo se resolve ali.
        </p>
        <p>
          <strong>Problema técnico:</strong> a escola aciona o suporte da rede, que aciona a{" "}
          {IDENTIFICACAO.nome}.
        </p>
        <p>
          <strong>Violação de direito de criança ou adolescente</strong> — exposição, assédio, ameaça,
          conteúdo impróprio, uso indevido de dados de um estudante: isso não passa pelo caminho comum.
          Escreva para {ou(IDENTIFICACAO.contato, "o canal indicado na última seção")}. A denúncia pode
          ser feita pelo próprio estudante, por responsável, pela escola, pelo Ministério Público ou por
          autoridade competente, e não exige ordem judicial para que o conteúdo apontado seja avaliado e
          removido.
        </p>
        <p>
          Denunciar é gratuito. Você recebe resposta sobre o que foi feito. Se preferir, o Conselho
          Tutelar, o Ministério Público e a Autoridade Nacional de Proteção de Dados também recebem
          denúncias diretamente — nada aqui limita esse caminho.
        </p>
      </>
    ),
  },

  {
    id: "disponibilidade",
    titulo: "Disponibilidade, mudanças e encerramento",
    conteudo: (
      <>
        <p>
          Trabalhamos para a plataforma estar no ar durante o horário escolar. O nível de
          disponibilidade prometido, as janelas de manutenção e o que acontece quando esse nível não é
          cumprido estão no contrato firmado com a sua rede — é lá que essa obrigação vive, e é a rede
          quem pode cobrá-la.
        </p>
        <p>
          A plataforma muda: experiências novas entram, telas mudam, funções são ajustadas. Mudança que
          altere de forma relevante o que estes Termos dizem é avisada com destaque antes de valer, e a
          data da versão fica no alto desta página.
        </p>
        <p>
          Quando o contrato com a rede terminar, o acesso é encerrado. Os dados são devolvidos ou
          eliminados conforme o contrato e a lei, ressalvado o que a legislação obriga a guardar por um
          prazo — a Política de Privacidade nomeia essas exceções.
        </p>
      </>
    ),
  },

  {
    id: "responsabilidade-e-lei",
    titulo: "Responsabilidade, lei aplicável e onde reclamar",
    conteudo: (
      <>
        <p>
          <strong>Não há aqui nenhuma cláusula que exclua nossa responsabilidade.</strong> A{" "}
          {IDENTIFICACAO.nome} responde por defeito e por vício do serviço nos termos da lei brasileira,
          e por dano que causar. Não transferimos à escola, ao professor ou ao estudante uma
          responsabilidade que é nossa, e não invertemos o ônus da prova contra você. Cláusulas assim
          seriam nulas de pleno direito — Código de Defesa do Consumidor, artigo 51 — e por isso não
          estão escritas.
        </p>
        <p>
          O que se pode dizer com honestidade é o limite do que prometemos: a disponibilidade e os
          prazos de atendimento são os do contrato com a rede, e não respondemos por interrupção causada
          por falha da infraestrutura da escola — energia, internet local, equipamento — nem por uso
          contrário a estes Termos.
        </p>
        <h3>Lei aplicável</h3>
        <p>
          Aplica-se a lei brasileira, em especial a LGPD (Lei 13.709/2018), o Estatuto da Criança e do
          Adolescente (Lei 8.069/1990) e o Estatuto Digital da Criança e do Adolescente (Lei
          15.211/2025) com seu regulamento, o Código de Defesa do Consumidor (Lei 8.078/1990), a Lei
          Brasileira de Inclusão (Lei 13.146/2015) e o Marco Civil da Internet (Lei 12.965/2014).
        </p>
        <h3>Onde se resolve uma disputa</h3>
        <p>
          <strong>Estes Termos não elegem foro.</strong> A relação contratual é entre a{" "}
          {IDENTIFICACAO.nome} e a rede pública, e o foro dela é o do contrato administrativo — a sede
          da Administração, como manda a Lei 14.133/2021.
        </p>
        <p>
          E, principalmente: <strong>nada aqui tira de você o direito de procurar a Justiça do lugar
          onde mora.</strong> Estudante, responsável, professor e servidor podem acionar o juízo do
          próprio domicílio, os órgãos de defesa do consumidor, o Conselho Tutelar, o Ministério Público
          e a Autoridade Nacional de Proteção de Dados. Não há arbitragem obrigatória.
        </p>
      </>
    ),
  },

  {
    id: "em-definicao",
    titulo: "O que ainda está sendo definido",
    conteudo: (
      <>
        <p>
          Esta página é honesta sobre o que ainda não existe. Os pontos abaixo dependem do contrato com
          cada rede, de decisões que não são de software, ou de revisão jurídica em andamento. Enquanto
          um deles estiver aberto, ele aparece aqui — e não disfarçado no meio do texto.
        </p>
        <div className="legal-cards">
          <div className="legal-card">
            <p className="legal-card__titulo">Identificação da empresa</p>
            <dl className="legal-card__campos">
              <div className="legal-card__campo">
                <dt>Razão social</dt>
                <dd>{ou(IDENTIFICACAO.razaoSocial, "a publicar")}</dd>
              </div>
              <div className="legal-card__campo">
                <dt>CNPJ</dt>
                <dd>{ou(IDENTIFICACAO.cnpj, "a publicar")}</dd>
              </div>
              <div className="legal-card__campo">
                <dt>Contato</dt>
                <dd>{ou(IDENTIFICACAO.contato, "a publicar")}</dd>
              </div>
              <div className="legal-card__campo">
                <dt>Acessibilidade</dt>
                <dd>{ou(IDENTIFICACAO.acessibilidade, "a publicar")}</dd>
              </div>
            </dl>
          </div>
          <div className="legal-card">
            <p className="legal-card__titulo">Encarregado de dados</p>
            <p className="legal-card__texto">
              A LGPD exige um encarregado com contato divulgado. A rede indica o dela; a{" "}
              {IDENTIFICACAO.nome} indica o seu. Nenhum dos dois está publicado ainda.
            </p>
          </div>
          <div className="legal-card">
            <p className="legal-card__titulo">Prazos de guarda</p>
            <p className="legal-card__texto">
              Por quanto tempo cada tipo de registro fica guardado ainda está sendo definido com as
              redes. Enquanto não estiver, não anunciamos prazo nenhum — inventar um seria pior que
              admitir a lacuna.
            </p>
          </div>
          <div className="legal-card">
            <p className="legal-card__titulo">Supervisão parental</p>
            <p className="legal-card__texto">
              A plataforma não tem hoje uma área para responsáveis acompanharem o estudante. Quem
              informa a família é a escola. Se essa ferramenta existir, ela será anunciada aqui.
            </p>
          </div>
          <div className="legal-card">
            <p className="legal-card__titulo">Onde a IA processa</p>
            <p className="legal-card__texto">
              A região em que o serviço de inteligência artificial processa os textos e as salvaguardas
              contratuais correspondentes estão sendo tratadas com cada rede. A Política de Privacidade
              descreve a situação atual.
            </p>
          </div>
          <div className="legal-card">
            <p className="legal-card__titulo">Auditoria de acessibilidade</p>
            <p className="legal-card__texto">
              O alvo WCAG 2.2 AA ainda não passou por avaliação independente. O resultado será
              publicado quando houver.
            </p>
          </div>
        </div>
      </>
    ),
  },
];

export default function Termos() {
  return (
    <CascaLegal
      titulo="Termos de Uso"
      resumo={
        <p>
          As regras de uso da Plataforma {IDENTIFICACAO.nome}. Quem contrata é a sua rede de ensino;
          quem usa é você. Esta página explica o que a plataforma é, o que você pode fazer nela, onde a
          inteligência artificial entra e a quem recorrer quando algo dá errado.
        </p>
      }
      meta={[
        { rotulo: "Versão", valor: "1.0 — rascunho para revisão jurídica" },
        { rotulo: "Última atualização", valor: "5 de setembro de 2026" },
        { rotulo: "Aplica-se a", valor: "Hub e experiências da plataforma" },
        { rotulo: "Público", valor: "Estudantes, professores e gestão escolar" },
      ]}
      secoes={SECOES}
      aviso={
        <div className="legal-nota legal-nota--atencao">
          <div className="legal-nota__corpo">
            <p>
              <strong>Rascunho em revisão jurídica.</strong> Este texto ainda não foi validado por
              advogado e não vale como peça contratual. Em qualquer divergência, prevalece o contrato
              administrativo firmado entre a {IDENTIFICACAO.nome} e a rede de ensino.
            </p>
          </div>
        </div>
      }
      atalhos={[
        {
          href: "/privacidade",
          titulo: "Política de Privacidade",
          texto: "Quais dados a plataforma trata, por quê e quais são os seus direitos.",
          icone: "shield_person",
        },
        {
          href: "/",
          titulo: "Conhecer a plataforma",
          texto: "O que a Unooria faz e como as experiências funcionam na aula.",
          icone: "school",
        },
      ]}
    />
  );
}
