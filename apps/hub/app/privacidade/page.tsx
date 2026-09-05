import { CascaLegal, type SecaoLegal } from "@/components/legal/casca-legal";

/**
 * Política de Privacidade — página pública (`/privacidade`), sem login.
 *
 * POR QUE ESTE TEXTO DIZ O QUE DIZ
 *
 * Ele foi escrito a partir de uma auditoria do que o código FAZ, não do que
 * seria bonito prometer. Toda frase aqui tem lastro em tabela, rota ou envio
 * verificado. Documento de privacidade que descreve um sistema imaginário é
 * pior que documento nenhum: ele vira declaração falsa ao titular (LGPD
 * art. 9º, VI) e a primeira fiscalização o desmonta.
 *
 * O QUE ESTA PÁGINA NÃO PODE PROMETER (cada item já foi tentado e é FALSO hoje)
 *
 *  - "coletamos com consentimento do responsável" — não existe entidade,
 *    coluna, papel nem tela de responsável legal, e a base legal correta aqui
 *    NÃO é consentimento (Guia da ANPD para o Poder Público + Enunciado
 *    CD/ANPD 1/2023: consentimento em relação compulsória é nulo).
 *  - "você pode pedir a exclusão dos seus dados" — não há rota de exclusão de
 *    pessoa. Desligar alguém é `ativo = false`.
 *  - "guardamos apenas pelo tempo necessário" / qualquer prazo em meses — não
 *    existe NENHUMA rotina de retenção no repositório. Inventar "12 meses"
 *    seria a mentira mais fácil de escrever e a mais fácil de provar.
 *  - "seus dados ficam no Brasil" — a stack está em `us-east1` e a IA no
 *    endpoint `global` do Vertex. Há transferência internacional, e ela está
 *    declarada.
 *  - "o CPF é criptografado" — `users.cpf` é TEXT em claro (ADR-33, decisão
 *    deliberada: o gestor precisa ver o número). O que é verdade é o acesso
 *    restrito e a garantia de não vazar em log, token, telemetria ou bundle.
 *  - "a telemetria é anônima" — é PSEUDONIMIZADA. `estudante_id` é chave
 *    estrangeira direta para `users`. Anonimizado e pseudonimizado são coisas
 *    diferentes na LGPD (art. 12, §2º), e chamar um de outro é erro jurídico.
 *  - "o analytics não captura o que você digita" — o Clarity é gravador de
 *    sessão e não há masking no repositório. Por isso a página fala do que a
 *    plataforma ENVIA e da decisão de manter a ferramenta desligada, nunca do
 *    que o script de terceiro captura por conta própria.
 *  - "registramos os acessos aos dados para auditoria" — não há log de acesso
 *    individual. Ninguém sabe hoje qual gestor abriu o CPF de qual criança.
 *
 * UMA LACUNA JÁ FECHOU, e o registro serve de aviso ao próximo. Quando este
 * texto foi escrito, a liberação por turma (ADR-69) não estava em `dev`, e por
 * isso a página EVITA afirmar que "a missão só abre quando o professor libera".
 * A ADR-69 entrou depois (PR #29): `exigirMissaoLiberada` vive em
 * `apps/api/src/comum/liberacao.ts` e guarda a entrada de estudante em cinco
 * módulos. A afirmação passou a ser verdadeira e PODE entrar na seção de
 * segurança — não entrou ainda porque calar um controle que existe é
 * conservador, enquanto anunciar um que não existe é falso. Quem for escrever:
 * confirme a guarda no funil das rotas de estudante antes.
 *
 * FORMA. Linguagem acessível a adolescente é exigência legal (LGPD art. 14,
 * §6º; Lei 15.211/2025 art. 18, §1º), não gentileza: frase curta, voz ativa,
 * termo técnico explicado na sequência. Sem tabela — cards. Sem `[A DEFINIR]`
 * espalhado: o que depende do contrato mora no bloco IDENTIFICACAO abaixo, e o
 * que ainda não foi decidido tem uma seção final própria e honesta.
 */

/**
 * O ÚNICO lugar deste arquivo com dado que depende do contrato e do cadastro.
 * Trocar aqui atualiza a página inteira — nenhum destes valores está repetido
 * no texto corrido. Os que ainda não estão fechados aparecem nominalmente na
 * última seção, para que a página não minta por omissão.
 */
const IDENTIFICACAO = {
  /*
   * Razão social e CNPJ ficam VAZIOS até virem do cadastro — dado registral não
   * se estima. Preenchido, o texto vira "A Unooria (Razão Social, CNPJ nn) é a
   * operadora"; vazio, cai na frase sem os dados e a última seção diz que
   * faltam. Um CNPJ de exemplo numa página pública é declaração falsa, e ainda
   * por cima uma que passa despercebida na revisão justamente por parecer
   * preenchida. Mesmo bloco e mesmo critério dos Termos de Uso.
   */
  razaoSocial: "",
  cnpj: "",
  encarregado: "Encarregado de Proteção de Dados da Unooria",
  emailEncarregado: "privacidade@unooria.com",
  emailDenuncia: "denuncia@unooria.com",
  versao: "1.0",
  vigenciaDesde: "5 de setembro de 2026",
};

/**
 * A qualificação registral entre parênteses só aparece quando existe. Sem isso,
 * a página publicaria "A Unooria (, CNPJ )" no dia em que alguém esvaziasse o
 * campo — o tipo de defeito que nenhum typecheck pega e que só a tela mostra.
 */
const qualificacao = () => {
  const partes = [
    IDENTIFICACAO.razaoSocial,
    IDENTIFICACAO.cnpj && `CNPJ ${IDENTIFICACAO.cnpj}`,
  ].filter(Boolean);
  return partes.length > 0 ? ` (${partes.join(", ")})` : "";
};

export const metadata = {
  title: "Política de Privacidade — Unooria",
  description:
    "Quais dados a Plataforma Unooria trata, por quê, com quem compartilha e como exercer seus direitos.",
};

const SECOES: SecaoLegal[] = [
  /* ------------------------------------------------------------------ 01 */
  {
    id: "quem-somos",
    titulo: "Quem somos e quem manda nos seus dados",
    conteudo: (
      <>
        <p>
          A Plataforma Unooria é usada dentro da escola pública. Quem decide que
          ela seja usada, quem entra nela e para quê é a{" "}
          <strong>rede pública de ensino</strong> — a secretaria de educação do
          estado ou do município que contratou a plataforma. Na linguagem da Lei
          Geral de Proteção de Dados (LGPD), a rede é a{" "}
          <strong>controladora</strong>: é ela quem manda nos dados.
        </p>
        <p>
          A Unooria{qualificacao()} é a <strong>operadora</strong>: tratamos os
          dados seguindo as instruções da rede, e só para o que o contrato com
          ela prevê. Não usamos dado de estudante para finalidade própria — não
          vendemos, não cedemos a terceiro para uso comercial e não usamos para
          treinar modelos de inteligência artificial.
        </p>
        <p>
          Na prática, isso muda o caminho de quem quer reclamar ou pedir alguma
          coisa: <strong>quem responde por você é a sua rede de ensino</strong>.
          A Unooria atende os pedidos por meio dela, e ajuda a cumpri-los. A
          seção <a href="#seus-direitos">Seus direitos</a> mostra o caminho
          passo a passo.
        </p>
        <p>
          <strong>Há uma exceção, e é justo dizê-la.</strong> O Marco Civil da
          Internet (art. 15) obriga quem oferece uma aplicação de internet a
          guardar registros de acesso por seis meses, sob sigilo. Essa obrigação
          é da Unooria, não da rede — nesse conjunto específico de registros, a
          controladora somos nós.
        </p>
        <p>
          Somos empresa brasileira, com sede no Brasil, e é aqui que respondemos
          legalmente.
        </p>
      </>
    ),
  },

  /* ------------------------------------------------------------------ 02 */
  {
    id: "sem-consentimento",
    titulo: "Por que não pedimos o seu “aceito”",
    conteudo: (
      <>
        <p>
          Você não vai encontrar aqui um botão de aceitar. Isso é de propósito,
          e não é descuido.
        </p>
        <p>
          A plataforma faz parte da política pública de educação da sua rede. A
          base legal para tratar os dados é o{" "}
          <strong>art. 7º, III da LGPD</strong> — execução de política pública
          prevista em lei, regulamento ou instrumento contratual — somada, no
          que decorre do dever de escolarização, ao art. 7º, II (cumprimento de
          obrigação legal).
        </p>
        <p>
          Pedir consentimento aqui seria pior do que inútil: seria{" "}
          <strong>nulo</strong>. A Autoridade Nacional de Proteção de Dados
          (ANPD) usa exatamente este cenário como exemplo no Guia do Poder
          Público — matrícula de estudante — e conclui que o consentimento
          obtido numa relação compulsória não vale, porque o estudante não tem
          condição efetiva de recusar. E um consentimento falso cria uma
          promessa impossível: se um responsável o revogasse, o estudante não
          poderia ser desmatriculado da política pública.
        </p>
        <p>
          <strong>
            Existe um único consentimento de verdade nesta plataforma:
          </strong>{" "}
          o do professor adulto que decide participar do check-in de bem-estar.
          Esse é livre, específico, pode ser recusado sem consequência e pode
          ser revogado a qualquer momento. Está descrito em{" "}
          <a href="#bem-estar">Bem-estar do professor</a>.
        </p>
        <div className="legal-nota">
          <div className="legal-nota__corpo">
            <p>
              <strong>O tratamento é condição para usar a plataforma.</strong>{" "}
              Sem os dados de identidade e de participação não há como abrir uma
              missão, salvar o que você fez nem devolver o resultado ao
              professor. Como a base não é consentimento, não existe aqui um
              “recusar e continuar usando”. O que existe é o direito de se opor,
              de pedir correção e de reclamar — e esses caminhos estão na seção
              13.
            </p>
          </div>
        </div>
      </>
    ),
  },

  /* ------------------------------------------------------------------ 03 */
  {
    id: "quem-usa",
    titulo: "De quem são os dados que tratamos",
    conteudo: (
      <>
        <p>
          A plataforma atende do 1º ano do ensino fundamental ao 3º ano do
          ensino médio. Ou seja:{" "}
          <strong>
            a maioria das pessoas cujos dados tratamos é criança ou adolescente
          </strong>
          , de 6 a 17 anos. Não fingimos o contrário, e é isso que faz o ECA
          Digital (Lei 15.211/2025) e o art. 14 da LGPD se aplicarem inteiros ao
          que fazemos.
        </p>
        <div className="legal-cards">
          <div className="legal-card">
            <p className="legal-card__titulo">Estudante</p>
            <p className="legal-card__texto">
              É de quem mais tratamos dados, e é quem tem a proteção mais forte.
              Entra na plataforma porque a escola o matriculou, não porque se
              cadastrou.
            </p>
          </div>
          <div className="legal-card">
            <p className="legal-card__titulo">Professor</p>
            <p className="legal-card__texto">
              Servidor da rede. Além do cadastro, é o único que pode fornecer
              dado de saúde, e só se escolher participar do check-in de
              bem-estar.
            </p>
          </div>
          <div className="legal-card">
            <p className="legal-card__titulo">Gestor da escola</p>
            <p className="legal-card__texto">
              Importa a lista de pessoas da rede, corrige cadastro e emite o
              perfil portátil. É quem enxerga o CPF em tela.
            </p>
          </div>
          <div className="legal-card">
            <p className="legal-card__titulo">Administrador do contrato</p>
            <p className="legal-card__texto">
              Único papel que enxerga mais de uma escola. Existe para operar o
              contrato inteiro da rede e para exportar análises agregadas.
            </p>
          </div>
        </div>
        <p>
          <strong>
            Responsáveis e famílias não têm conta na plataforma hoje.
          </strong>{" "}
          Não há login de responsável, não há painel de acompanhamento e não há
          ferramenta própria de supervisão parental. O caminho da família é a
          escola — e dizemos isso porque a alternativa seria descrever uma
          funcionalidade que não existe. Está listado em{" "}
          <a href="#em-definicao">O que ainda está sendo definido</a>.
        </p>
      </>
    ),
  },

  /* ------------------------------------------------------------------ 04 */
  {
    id: "dados-de-cadastro",
    titulo: "Os dados de cadastro",
    conteudo: (
      <>
        <p>
          Esses dados não são digitados por você. Eles chegam da rede: a escola
          importa uma planilha (ou a integração com o sistema acadêmico) e é
          essa importação que cria as pessoas na plataforma. Por isso, corrigir
          um nome errado começa na secretaria da escola — se a correção não
          voltar à origem, a próxima importação a desfaz.
        </p>
        <div className="legal-cards">
          <div className="legal-card">
            <p className="legal-card__titulo">Nome, login e e-mail</p>
            <p className="legal-card__texto">
              Para reconhecer você nas telas e para o professor saber de quem é
              cada trabalho.
            </p>
            <dl className="legal-card__campos">
              <div className="legal-card__campo">
                <dt>Origem</dt>
                <dd>Importação feita pela escola</dd>
              </div>
              <div className="legal-card__campo">
                <dt>Quem vê</dt>
                <dd>Você, seu professor e a gestão da sua escola</dd>
              </div>
            </dl>
          </div>
          <div className="legal-card">
            <p className="legal-card__titulo">CPF</p>
            <p className="legal-card__texto">
              É o que permite reconhecer a mesma pessoa quando ela troca de
              escola dentro da rede, e é a chave do documento de portabilidade.
            </p>
            <dl className="legal-card__campos">
              <div className="legal-card__campo">
                <dt>Quem vê</dt>
                <dd>Só a gestão da escola e o administrador do contrato</dd>
              </div>
              <div className="legal-card__campo">
                <dt>Guarda</dt>
                <dd>Em texto legível no banco — ver a seção 12</dd>
              </div>
            </dl>
          </div>
          <div className="legal-card">
            <p className="legal-card__titulo">Senha</p>
            <p className="legal-card__texto">
              Guardada apenas como resumo criptográfico (bcrypt). Ninguém na
              Unooria consegue ler sua senha, nem recuperá-la — só trocá-la por
              uma nova.
            </p>
            <dl className="legal-card__campos">
              <div className="legal-card__campo">
                <dt>Quem vê</dt>
                <dd>Ninguém</dd>
              </div>
            </dl>
          </div>
          <div className="legal-card">
            <p className="legal-card__titulo">Escola, turma e matrícula</p>
            <p className="legal-card__texto">
              Define o que você alcança e o que o seu professor alcança. É o que
              mantém os dados de uma escola separados dos de outra.
            </p>
            <dl className="legal-card__campos">
              <div className="legal-card__campo">
                <dt>Saída</dt>
                <dd>Quem sai da rede tem o vínculo encerrado, não apagado</dd>
              </div>
            </dl>
          </div>
        </div>
        <p>
          <strong>Base legal de tudo nesta seção:</strong> art. 7º, III da LGPD
          (execução de política pública), com o art. 7º, II para o que decorre
          do dever de escolarização.
        </p>
      </>
    ),
  },

  /* ------------------------------------------------------------------ 05 */
  {
    id: "dados-nas-missoes",
    titulo: "O que registramos enquanto você usa uma missão",
    conteudo: (
      <>
        <p>
          Cada experiência da plataforma é uma missão pedagógica, e ela mede o
          que você faz dentro dela. Isso é o instrumento, não um efeito
          colateral: sem esse registro o professor não tem o que devolver para a
          turma.
        </p>
        <div className="legal-cards">
          <div className="legal-card">
            <p className="legal-card__titulo">O que você escreve</p>
            <p className="legal-card__texto">
              Publicações, comentários, reflexões, buscas, o apelido que você
              escolhe e as conversas com os personagens de inteligência
              artificial. É guardado como você escreveu.
            </p>
            <dl className="legal-card__campos">
              <div className="legal-card__campo">
                <dt>Quem lê</dt>
                <dd>Você e o seu professor</dd>
              </div>
              <div className="legal-card__campo">
                <dt>Sai daqui?</dt>
                <dd>Parte vai para a IA, como explica a seção 8</dd>
              </div>
            </dl>
          </div>
          <div className="legal-card">
            <p className="legal-card__titulo">
              O que você escolhe e quanto tempo leva
            </p>
            <p className="legal-card__texto">
              Cliques, curtidas, denúncias, quanto tempo cada conteúdo ficou na
              sua tela, quantas vezes você mudou de ideia, se voltou atrás. É
              com isso que a missão mostra à turma como um algoritmo forma
              bolha.
            </p>
            <dl className="legal-card__campos">
              <div className="legal-card__campo">
                <dt>Quem vê</dt>
                <dd>Seu professor, no relatório da turma</dd>
              </div>
            </dl>
          </div>
          <div className="legal-card">
            <p className="legal-card__titulo">Seu perfil de valores</p>
            <p className="legal-card__texto">
              Num dos jogos, o servidor deduz, das escolhas que você fez lá
              dentro, um retrato de quais valores pesaram mais. Ele decide por
              onde outra missão começa e aparece para o professor.
            </p>
            <dl className="legal-card__campos">
              <div className="legal-card__campo">
                <dt>Cuidado</dt>
                <dd>É hipótese pedagógica, não teste psicológico validado</dd>
              </div>
            </dl>
          </div>
          <div className="legal-card">
            <p className="legal-card__titulo">Sua pontuação e o dossiê</p>
            <p className="legal-card__texto">
              A correção do que vale nota é feita no servidor, nunca no seu
              aparelho — assim ninguém altera o próprio resultado. Ao fim de
              algumas missões montamos um retrato do seu percurso.
            </p>
            <dl className="legal-card__campos">
              <div className="legal-card__campo">
                <dt>Quem vê</dt>
                <dd>Você e o seu professor</dd>
              </div>
            </dl>
          </div>
        </div>
        <h3>Sim, o seu professor lê o que você escreve</h3>
        <p>
          Essa é a pergunta que mais importa, e a resposta é sim. Tudo o que
          você digita numa missão fica visível para o professor da sua turma.
          Não fica visível para outros estudantes, não é publicado em lugar
          nenhum fora da plataforma e não vira conteúdo público: as reações e os
          comentários que você vê nas missões que imitam redes sociais são de{" "}
          <strong>personagens fictícios</strong>, escritos por computador, não
          de colegas.
        </p>
        <div className="legal-nota legal-nota--atencao">
          <div className="legal-nota__corpo">
            <p>
              <strong>Escreva sobre a missão, não sobre a sua vida.</strong> As
              caixas de texto são abertas de propósito, para você pensar em voz
              alta — e por isso nada impede que alguém digite ali um endereço,
              um telefone, o nome de um colega ou um assunto muito pessoal. A
              plataforma não tem um filtro que detecte isso e apague sozinho. Se
              você escreveu algo que não queria, avise o seu professor: ele
              consegue apagar os registros da atividade.
            </p>
          </div>
        </div>
      </>
    ),
  },

  /* ------------------------------------------------------------------ 06 */
  {
    id: "bem-estar",
    titulo: "Bem-estar do professor: o único dado de saúde",
    conteudo: (
      <>
        <p>
          Há uma experiência, feita só para professores, em que a pessoa
          responde a algumas frases por dia sobre como tem se sentido, durante
          uma semana. Isso é <strong>dado de saúde</strong> — dado sensível, na
          LGPD (art. 5º, II). Ele merece regra própria, e tem.
        </p>
        <div className="legal-cards">
          <div className="legal-card">
            <p className="legal-card__titulo">É voluntário de verdade</p>
            <p className="legal-card__texto">
              A base legal aqui é <strong>consentimento</strong> (art. 11, I).
              Recusar não tem consequência nenhuma, e quem não participa não
              aparece em lista alguma para a gestão.
            </p>
          </div>
          <div className="legal-card">
            <p className="legal-card__titulo">
              Ninguém da escola vê o resultado
            </p>
            <p className="legal-card__texto">
              O retrato da semana é do professor, e só dele. Não existe painel
              de gestor, não existe relatório agregado e não existe alerta para
              a direção.
            </p>
          </div>
          <div className="legal-card">
            <p className="legal-card__titulo">Você apaga quando quiser</p>
            <p className="legal-card__texto">
              Dentro da própria experiência há um botão que apaga todos os seus
              check-ins e todas as suas pontuações, de uma vez. É imediato e é o
              único caminho de exclusão que o titular aciona sozinho na
              plataforma.
            </p>
          </div>
          <div className="legal-card">
            <p className="legal-card__titulo">
              O que a IA recebe, e o que não recebe
            </p>
            <p className="legal-card__texto">
              As <strong>pontuações nunca saem da plataforma</strong>. O que vai
              para a IA é apenas o texto que o professor escolher escrever na
              caixa livre, para gerar a mensagem de acolhimento — e ele fica
              guardado junto do check-in.
            </p>
          </div>
        </div>
        <p>
          Se a rede quiser tornar esse check-in obrigatório, o consentimento
          deixa de valer e não sobra base legal para o instrumento. É por isso
          que ele é, e continuará sendo, opcional.
        </p>
      </>
    ),
  },

  /* ------------------------------------------------------------------ 07 */
  {
    id: "telemetria",
    titulo: "Telemetria: como medimos o uso",
    conteudo: (
      <>
        <p>
          A plataforma envia, em lotes, pequenos registros do tipo{" "}
          <strong>verbo mais objeto</strong> — “abriu a missão”, “concluiu a
          etapa”, “publicou” — junto de data e hora, da escola, da experiência e
          da versão dela. Serve para saber se a missão está funcionando e onde
          as pessoas travam.
        </p>
        <p>
          Esse registro carrega um <strong>identificador pseudonimizado</strong>{" "}
          do estudante: um código que não diz o nome de ninguém, mas que a
          plataforma consegue ligar de volta à pessoa. Isso não é dado anônimo —
          anônimo, na LGPD, é o que ninguém mais consegue reconectar. Usamos a
          palavra certa de propósito, porque chamar isso de anônimo seria erro
          jurídico e enganaria você.
        </p>
        <p>
          <strong>O que não vai na telemetria:</strong> nome, e-mail, CPF e o
          texto que estudantes escrevem nas missões. Essa é uma regra de projeto
          que respeitamos em todas as experiências — e é honesto dizer que ela é
          disciplina de quem escreve o código, não uma trava técnica que torne o
          envio impossível.
        </p>
        <p>
          Também medimos desempenho técnico (velocidade de carregamento) por
          amostragem, sem identificar quem estava na tela, e registramos erros
          do navegador para conseguir consertá-los. Nos registros de erro,
          e-mails, CPFs e credenciais que porventura apareçam são substituídos
          antes de virarem linha de log.
        </p>
      </>
    ),
  },

  /* ------------------------------------------------------------------ 08 */
  {
    id: "inteligencia-artificial",
    titulo: "Inteligência artificial: o que ela vê e o que ela decide",
    conteudo: (
      <>
        <p>
          Parte das missões usa inteligência artificial generativa. Quando você
          conversa com um personagem dentro de uma experiência, você está
          conversando com um computador —{" "}
          <strong>não com uma pessoa real, e não com um colega</strong>. A
          interface diz isso, e a lei exige que diga (Decreto 12.880/2026, art.
          11, I).
        </p>
        <h3>O que é enviado para a IA</h3>
        <p>
          Para gerar as respostas dos personagens, as reações às suas
          publicações, a devolutiva formativa e os planos de aula do professor,
          enviamos ao provedor de IA <strong>o texto escrito</strong> na missão:
          a sua conversa, a sua publicação, o seu comentário, a sua
          justificativa. Enviamos também o material curricular da rede, quando o
          professor pede um plano de aula.
        </p>
        <p>
          <strong>O que não é enviado:</strong> nome, e-mail, CPF, login ou
          qualquer identificador seu. As pontuações do check-in de bem-estar
          também não. O que a IA recebe é o texto e o contexto da missão, não a
          sua identidade.
        </p>
        <h3>O que a IA decide, e o que ela não decide</h3>
        <p>
          A IA <strong>não dá nota</strong>. A correção do que vale nota é feita
          por regra fixa no servidor, e a devolutiva escrita pela IA é
          declaradamente formativa, não pontuação. O professor aprova o material
          antes da aula, pode desligar a IA no meio da aula e é sempre ele quem
          avalia. A IA erra, e você deve tratá-la como um texto de computador,
          não como uma verdade.
        </p>
        <p>
          Nenhuma decisão automatizada aqui reprova alguém, nega direito ou
          produz efeito jurídico. Mesmo assim, você tem direito a saber os
          critérios usados e a pedir revisão de qualquer resultado automatizado
          (LGPD, art. 20 e §1º) — o pedido segue o caminho da seção 13, e a
          revisão é feita pelo professor.
        </p>
        <p>
          <strong>Não treinamos modelos de IA com o que você escreve.</strong> O
          texto é usado para gerar a resposta daquela interação, e nada além
          disso.
        </p>
        <div className="legal-nota">
          <div className="legal-nota__corpo">
            <p>
              O perfil de valores deduzido do jogo é o único ponto em que a
              plataforma monta um retrato psicológico a partir do comportamento
              — e ele influencia por onde a missão seguinte começa. Ele é{" "}
              <strong>hipótese pedagógica, não instrumento validado</strong>: a
              tela avisa quando a amostra é pequena demais para concluir
              qualquer coisa, e o professor pode ignorar o resultado e escolher
              o ponto de partida na mão.
            </p>
          </div>
        </div>
      </>
    ),
  },

  /* ------------------------------------------------------------------ 09 */
  {
    id: "compartilhamento",
    titulo: "Com quem compartilhamos",
    conteudo: (
      <>
        <p>
          Não vendemos dados. Não trocamos dados por serviço. A lista abaixo é
          completa: fora dela, nenhuma página da plataforma e nenhuma
          experiência faz requisição a terceiro. Até as fontes tipográficas são
          servidas por nós, e não por um provedor externo.
        </p>
        <div className="legal-cards">
          <div className="legal-card">
            <p className="legal-card__titulo">Sua rede de ensino</p>
            <p className="legal-card__texto">
              É a controladora. Recebe o que a escola precisa para conduzir a
              política educacional: cadastro, progresso e relatórios
              pedagógicos.
            </p>
            <dl className="legal-card__campos">
              <div className="legal-card__campo">
                <dt>Papel</dt>
                <dd>Controladora</dd>
              </div>
            </dl>
          </div>
          <div className="legal-card">
            <p className="legal-card__titulo">Google Cloud</p>
            <p className="legal-card__texto">
              Hospeda a plataforma inteira: banco de dados, arquivos, fila de
              eventos e registros técnicos. Trata os dados apenas para nos
              prestar esse serviço.
            </p>
            <dl className="legal-card__campos">
              <div className="legal-card__campo">
                <dt>Papel</dt>
                <dd>Operador (subcontratado pela Unooria)</dd>
              </div>
              <div className="legal-card__campo">
                <dt>Onde</dt>
                <dd>Estados Unidos — ver a seção 10</dd>
              </div>
            </dl>
          </div>
          <div className="legal-card">
            <p className="legal-card__titulo">Google Vertex AI (Gemini)</p>
            <p className="legal-card__texto">
              É o provedor de inteligência artificial. Recebe os textos
              descritos na seção 8, sem os seus dados de identificação.
            </p>
            <dl className="legal-card__campos">
              <div className="legal-card__campo">
                <dt>Papel</dt>
                <dd>Operador (subcontratado pela Unooria)</dd>
              </div>
              <div className="legal-card__campo">
                <dt>Onde</dt>
                <dd>Endpoint multirregional, fora do Brasil</dd>
              </div>
            </dl>
          </div>
          <div className="legal-card">
            <p className="legal-card__titulo">Provedor de identidade da rede</p>
            <p className="legal-card__texto">
              Quando a rede usa login único próprio, a autenticação passa pelo
              servidor de identidade dela (WSO2). Recebe apenas o necessário
              para confirmar quem você é.
            </p>
            <dl className="legal-card__campos">
              <div className="legal-card__campo">
                <dt>Papel</dt>
                <dd>Operador</dd>
              </div>
            </dl>
          </div>
        </div>
        <h3>Sobre ferramentas de análise de navegação</h3>
        <p>
          A plataforma tem suporte técnico ao Microsoft Clarity, uma ferramenta
          de análise de uso que grava sessões de navegação.{" "}
          <strong>Ela vem desligada</strong> — sem uma configuração explícita, o
          script simplesmente não é carregado, nem no site nem dentro das
          experiências.
        </p>
        <p>
          A Unooria mantém essa ferramenta{" "}
          <strong>desligada em qualquer tela que um estudante alcance</strong>.
          O motivo é direto: a própria Microsoft desaconselha o uso do Clarity
          em produtos direcionados a menores de 18 anos, e ela se declara
          controladora independente dos dados que coleta — não subcontratada
          nossa. Ligá-la numa tela de estudante seria enviar dado de criança
          para uma empresa com finalidade própria, o que não tem base legal
          aqui.
        </p>
        <p>
          Quando essa ferramenta estiver em uso em alguma tela exclusiva de
          adulto, o identificador enviado é um código opaco: o seu nome nunca é
          repassado a ela. Ainda assim, gravador de sessão captura a tela por
          conta própria, e é por isso que a regra é mantê-lo fora do caminho do
          estudante.
        </p>
      </>
    ),
  },

  /* ------------------------------------------------------------------ 10 */
  {
    id: "fora-do-brasil",
    titulo: "Os dados saem do Brasil",
    conteudo: (
      <>
        <p>
          Sim, e é melhor que você saiba do que descubra.{" "}
          <strong>
            A infraestrutura da plataforma fica nos Estados Unidos
          </strong>{" "}
          (região <em>us-east1</em> do Google Cloud), e{" "}
          <strong>
            o processamento de inteligência artificial usa um endpoint
            multirregional
          </strong>
          , que também não é brasileiro.
        </p>
        <p>
          Isso é transferência internacional de dados, regida pelo art. 33 da
          LGPD. A ANPD não emitiu, até hoje, decisão reconhecendo nenhum país
          como adequado — então a salvaguarda usada são as cláusulas-padrão
          contratuais da Resolução CD/ANPD nº 19/2024, incorporadas aos
          contratos com os provedores, somadas à hipótese de transferência
          necessária à execução de política pública.
        </p>
        <p>
          A leitura honesta: mover o processamento de IA para uma região
          brasileira eliminaria a questão, e é uma mudança de configuração que
          está sob avaliação. Enquanto não for feita, a transferência existe e
          está declarada aqui.
        </p>
      </>
    ),
  },

  /* ------------------------------------------------------------------ 11 */
  {
    id: "por-quanto-tempo",
    titulo: "Por quanto tempo guardamos",
    conteudo: (
      <>
        <p>
          Esta é a seção em que a maioria das políticas escreve um prazo bonito
          que o sistema não cumpre. Vamos dizer o que é verdade.
        </p>
        <p>
          <strong>A plataforma não apaga nada sozinha.</strong> Não existe
          rotina automática de eliminação: nenhum dado descrito nesta política
          tem hoje uma data em que desaparece por conta própria. Os dados são
          mantidos enquanto durar o contrato entre a Unooria e a rede de ensino,
          e{" "}
          <strong>
            os prazos de guarda de cada categoria serão definidos pela rede
          </strong>
          , que é a controladora — a Unooria não pode fixá-los sozinha, e não
          vai inventar um número para preencher esta linha.
        </p>
        <h3>O que já é possível apagar hoje</h3>
        <div className="legal-cards">
          <div className="legal-card">
            <p className="legal-card__titulo">Os registros de uma atividade</p>
            <p className="legal-card__texto">
              O professor apaga a atividade ou zera os dados da turma numa
              experiência. Isso remove o que os estudantes daquela turma
              produziram ali, inclusive os textos.
            </p>
            <dl className="legal-card__campos">
              <div className="legal-card__campo">
                <dt>Quem faz</dt>
                <dd>O professor</dd>
              </div>
            </dl>
          </div>
          <div className="legal-card">
            <p className="legal-card__titulo">O check-in de bem-estar</p>
            <p className="legal-card__texto">
              O professor apaga tudo o que respondeu, na própria experiência, a
              qualquer momento.
            </p>
            <dl className="legal-card__campos">
              <div className="legal-card__campo">
                <dt>Quem faz</dt>
                <dd>O próprio titular</dd>
              </div>
            </dl>
          </div>
          <div className="legal-card">
            <p className="legal-card__titulo">Planos de aula</p>
            <p className="legal-card__texto">
              O professor autor apaga o plano; o arquivo sai junto do
              armazenamento.
            </p>
            <dl className="legal-card__campos">
              <div className="legal-card__campo">
                <dt>Quem faz</dt>
                <dd>O professor autor</dd>
              </div>
            </dl>
          </div>
          <div className="legal-card">
            <p className="legal-card__titulo">
              Escolas, turmas e documentos recebidos
            </p>
            <p className="legal-card__texto">
              A gestão apaga a entidade, e com ela o que dependia dela.
            </p>
            <dl className="legal-card__campos">
              <div className="legal-card__campo">
                <dt>Quem faz</dt>
                <dd>Gestão da escola ou do contrato</dd>
              </div>
            </dl>
          </div>
        </div>
        <h3>O que não é apagado</h3>
        <p>
          <strong>Não existe hoje uma função de apagar uma pessoa.</strong>{" "}
          Quando alguém sai da rede, o cadastro é <strong>desativado</strong>,
          não excluído, e o vínculo com a escola é encerrado com data de fim. O
          motivo é histórico escolar: a rede precisa conseguir reconhecer quem
          passou por ela. A consequência é que o cadastro permanece no banco até
          que a rede determine sua eliminação.
        </p>
        <p>
          Também permanecem, na ausência de prazo definido pela rede: os
          registros de telemetria, o perfil de valores e a partida bruta do jogo
          (guardados porque, se a leitura pedagógica mudar, é preciso poder
          recalcular o retrato), as transcrições das conversas com IA e o
          contador diário de uso de IA por pessoa.
        </p>
        <p>
          Por fim, há o que a lei obriga a guardar: os registros de acesso à
          aplicação, por seis meses, sob sigilo (Marco Civil, art. 15). Esses
          não podem ser apagados a pedido, nem por nós, nem pela rede.
        </p>
      </>
    ),
  },

  /* ------------------------------------------------------------------ 12 */
  {
    id: "seguranca",
    titulo: "Como protegemos — e o que ainda não temos",
    conteudo: (
      <>
        <p>
          A proteção aqui é de projeto, não de promessa. Estes são os mecanismos
          que existem de fato:
        </p>
        <ul>
          <li>
            <strong>Separação por escola no próprio banco de dados.</strong> As
            tabelas de dado de estudante têm segurança em nível de linha ativada
            de forma forçada: uma consulta que não declare a escola simplesmente
            não retorna linha. Não é um filtro que um erro de programação possa
            esquecer.
          </li>
          <li>
            <strong>Trânsito sempre cifrado</strong> (HTTPS) entre o seu
            aparelho, a plataforma e os provedores.
          </li>
          <li>
            <strong>O crachá que a missão usa dura 15 minutos</strong>, fica só
            na memória do navegador — nunca em cookie nem em armazenamento local
            — e não carrega nome, e-mail nem CPF, apenas códigos internos.
          </li>
          <li>
            <strong>Correção e pontuação acontecem no servidor.</strong> O seu
            aparelho envia a resposta; quem corrige é a plataforma. Gabarito
            nunca é enviado ao navegador.
          </li>
          <li>
            <strong>Redação automática nos registros técnicos.</strong> Nome,
            e-mail, CPF, senha, credenciais e textos são substituídos por uma
            marca antes de qualquer linha de log ser gravada, inclusive dentro
            de mensagens de erro. Os valores de uma consulta ao banco nunca são
            registrados.
          </li>
          <li>
            <strong>Limite de tentativas de login</strong> e mensagens iguais
            para usuário inexistente e senha errada, para não revelar quem tem
            conta.
          </li>
          <li>
            <strong>As experiências rodam isoladas</strong> numa moldura
            restrita, e cada permissão extra precisa estar declarada no catálogo
            da experiência.
          </li>
          <li>
            <strong>
              A plataforma não acessa câmera, microfone nem localização.
            </strong>{" "}
            Em nenhuma tela, em nenhuma experiência. Verificado no código-fonte
            inteiro.
          </li>
        </ul>
        <div className="legal-nota legal-nota--atencao">
          <div className="legal-nota__corpo">
            <p>
              <strong>Três limitações que preferimos declarar.</strong>
            </p>
            <p>
              <strong>1. O CPF é guardado em texto legível no banco</strong>,
              não cifrado por coluna. Foi decisão consciente: a gestão da escola
              precisa ver o número para reconhecer a pessoa. A proteção real é
              de acesso — só gestão e administração do contrato o enxergam — e a
              garantia de que ele nunca aparece em registro técnico, em
              telemetria, no crachá da missão nem em qualquer código enviado ao
              navegador. O disco é cifrado pelo provedor de nuvem, como padrão.
            </p>
            <p>
              <strong>
                2. Não há registro individual de acesso a dado pessoal.
              </strong>{" "}
              Hoje a plataforma não guarda quem abriu a ficha de quem. Isso está
              sendo implantado, e está listado na seção 16.
            </p>
            <p>
              <strong>
                3. O isolamento por escola tem exceções, e elas são nomeadas.
              </strong>{" "}
              As tabelas de identidade (pessoas, escolas, turmas e vínculos)
              ficam fora da separação automática, porque o login precisa
              encontrar a pessoa antes de saber a escola dela — ali o escopo é
              garantido pelo código. E o administrador do contrato enxerga a
              rede inteira, por desenho. Os documentos de portabilidade e o
              histórico do estudante também atravessam escolas de propósito,
              para reconhecer quem foi transferido.
            </p>
          </div>
        </div>
        <h3>O que fica guardado no seu navegador</h3>
        <p>
          Um cookie de sessão, cifrado, que dura 12 horas — o suficiente para um
          dia de aula — e que contém o seu nome e o seu login para as telas
          funcionarem. Além dele, apenas três registros técnicos: um
          identificador de sessão para diagnóstico de erro, um marcador de
          amostragem de desempenho e a sua preferência de tema claro ou escuro
          numa das experiências. Nenhum deles é usado para publicidade, e{" "}
          <strong>nenhum crachá de acesso fica guardado no navegador</strong>.
        </p>
      </>
    ),
  },

  /* ------------------------------------------------------------------ 13 */
  {
    id: "criancas-e-adolescentes",
    titulo: "Crianças e adolescentes",
    conteudo: (
      <>
        <p>
          Este produto é feito para menores de idade. Não fingimos que não é — e
          essa premissa muda o padrão do que fazemos, por força do art. 14 da
          LGPD, do ECA e do ECA Digital (Lei 15.211/2025 e Decreto 12.880/2026).
        </p>
        <p>Estes compromissos são absolutos e valem em toda a plataforma:</p>
        <ul>
          <li>
            <strong>Não existe publicidade.</strong> Nenhum anúncio, em nenhuma
            tela, de ninguém.
          </li>
          <li>
            <strong>Não montamos perfil para fins publicitários</strong>, nem
            vendemos, cedemos ou monetizamos o que estudantes produzem. O perfil
            pedagógico descrito na seção 5 existe só para conduzir a missão e
            informar o professor.
          </li>
          <li>
            <strong>Não há mecanismo de recompensa por tempo de uso</strong>,
            caixa de recompensa aleatória, notificação para trazer você de volta
            nem rolagem sem fim projetada para prender. Cada missão tem começo,
            meio e fim.
          </li>
          <li>
            <strong>
              As experiências que imitam redes sociais são simulações fechadas.
            </strong>{" "}
            Elas não têm conexão com as plataformas reais, não têm público
            externo e nada do que você escreve ali é publicado fora da sua
            escola.
          </li>
          <li>
            <strong>Nenhum acesso a câmera, microfone ou localização.</strong>
          </li>
        </ul>
        <p>
          A faixa etária de cada experiência é informada no catálogo, e as
          missões são atribuídas pelo professor conforme a série da turma.
        </p>
        <p>
          <strong>Canal de denúncia.</strong> Quem identificar conteúdo ou
          situação que viole direitos de criança ou adolescente dentro da
          plataforma pode escrever para{" "}
          <a href={`mailto:${IDENTIFICACAO.emailDenuncia}`}>
            {IDENTIFICACAO.emailDenuncia}
          </a>
          . O canal é gratuito, aceita denúncia de qualquer pessoa e não exige
          conta na plataforma. Avaliamos e removemos o conteúdo violador, sem
          esperar ordem judicial, e comunicamos a escola e a rede.
        </p>
        <p>
          Esta página é pública e fica acessível <strong>sem login</strong>, de
          propósito: pais, responsáveis e os próprios estudantes precisam poder
          ler o que fazemos com os dados sem depender de uma conta. É exigência
          do art. 16 do ECA Digital, e é o mínimo decente.
        </p>
      </>
    ),
  },

  /* ------------------------------------------------------------------ 14 */
  {
    id: "seus-direitos",
    titulo: "Seus direitos e como exercer",
    conteudo: (
      <>
        <p>
          O art. 18 da LGPD dá a você um conjunto de direitos sobre os seus
          dados. Como a <strong>controladora é a sua rede de ensino</strong>, o
          pedido começa nela — e a Unooria, como operadora, executa o que a rede
          determinar e ajuda no que for técnico.
        </p>
        <h3>O caminho, em três passos</h3>
        <ol>
          <li>
            Fale com a <strong>secretaria da sua escola</strong>. É o caminho
            mais rápido para corrigir cadastro e para pedir que registros de uma
            atividade sejam apagados.
          </li>
          <li>
            Procure o{" "}
            <strong>
              encarregado de proteção de dados da sua rede de ensino
            </strong>
            . Toda secretaria de educação é obrigada a indicar um e a divulgar o
            contato dele (LGPD, art. 23, III e art. 41).
          </li>
          <li>
            Se o pedido for técnico, ou se você não souber a quem recorrer,
            escreva para o {IDENTIFICACAO.encarregado} em{" "}
            <a href={`mailto:${IDENTIFICACAO.emailEncarregado}`}>
              {IDENTIFICACAO.emailEncarregado}
            </a>
            . Encaminhamos à rede, dizemos a você para quem encaminhamos, e
            apoiamos a resposta.
          </li>
        </ol>
        <p>
          <strong>Exercer qualquer desses direitos é gratuito.</strong> A
          confirmação de que existe tratamento é respondida de imediato, em
          formato simplificado; a resposta completa sai em até 15 dias (LGPD,
          art. 19).
        </p>
        <div className="legal-cards">
          <div className="legal-card">
            <p className="legal-card__titulo">
              Saber se tratamos e ver seus dados
            </p>
            <p className="legal-card__texto">
              Confirmação da existência do tratamento e acesso ao que guardamos
              sobre você.
            </p>
            <dl className="legal-card__campos">
              <div className="legal-card__campo">
                <dt>Hoje</dt>
                <dd>
                  Atendido pela escola, com apoio nosso; não há tela de
                  autoatendimento
                </dd>
              </div>
            </dl>
          </div>
          <div className="legal-card">
            <p className="legal-card__titulo">Corrigir dado errado</p>
            <p className="legal-card__texto">
              Nome trocado, turma errada, CPF incorreto.
            </p>
            <dl className="legal-card__campos">
              <div className="legal-card__campo">
                <dt>Onde</dt>
                <dd>
                  Na secretaria da escola — senão a próxima importação desfaz
                </dd>
              </div>
            </dl>
          </div>
          <div className="legal-card">
            <p className="legal-card__titulo">Apagar, bloquear ou anonimizar</p>
            <p className="legal-card__texto">
              Vale para dado desnecessário, excessivo ou tratado fora da lei, e
              para o que foi coletado com consentimento.
            </p>
            <dl className="legal-card__campos">
              <div className="legal-card__campo">
                <dt>Hoje</dt>
                <dd>
                  Imediato no check-in de bem-estar. Para o resto, quem decide é
                  a rede e o que existe são as exclusões da seção 11
                </dd>
              </div>
            </dl>
          </div>
          <div className="legal-card">
            <p className="legal-card__titulo">Levar seus dados embora</p>
            <p className="legal-card__texto">
              A plataforma emite um documento assinado com identificação,
              escolas, turmas, progresso e o retrato de valores, para ser lido
              por outra rede.
            </p>
            <dl className="legal-card__campos">
              <div className="legal-card__campo">
                <dt>Como</dt>
                <dd>Solicitado à gestão da escola, que emite o documento</dd>
              </div>
            </dl>
          </div>
          <div className="legal-card">
            <p className="legal-card__titulo">Saber com quem compartilhamos</p>
            <p className="legal-card__texto">
              A lista completa está na seção 9 desta página, e você pode pedir a
              confirmação por escrito.
            </p>
            <dl className="legal-card__campos">
              <div className="legal-card__campo">
                <dt>Onde</dt>
                <dd>Seção 9, ou pelo canal do encarregado</dd>
              </div>
            </dl>
          </div>
          <div className="legal-card">
            <p className="legal-card__titulo">Se opor e pedir revisão</p>
            <p className="legal-card__texto">
              Você pode se opor a um tratamento que considere irregular e pedir
              revisão de resultado produzido automaticamente, com explicação dos
              critérios.
            </p>
            <dl className="legal-card__campos">
              <div className="legal-card__campo">
                <dt>Quem revisa</dt>
                <dd>O professor responsável pela turma</dd>
              </div>
            </dl>
          </div>
          <div className="legal-card">
            <p className="legal-card__titulo">Revogar consentimento</p>
            <p className="legal-card__texto">
              Só se aplica ao check-in de bem-estar do professor, que é o único
              tratamento baseado em consentimento.
            </p>
            <dl className="legal-card__campos">
              <div className="legal-card__campo">
                <dt>Como</dt>
                <dd>Botão de apagar dentro da própria experiência</dd>
              </div>
            </dl>
          </div>
        </div>
        <p>
          Você também pode levar sua reclamação diretamente à{" "}
          <a href="https://www.gov.br/anpd" rel="noreferrer">
            Autoridade Nacional de Proteção de Dados
          </a>{" "}
          e, tratando-se de criança ou adolescente, ao Conselho Tutelar ou ao
          Ministério Público.
        </p>
      </>
    ),
  },

  /* ------------------------------------------------------------------ 15 */
  {
    id: "incidentes",
    titulo: "Se algo der errado",
    conteudo: (
      <>
        <p>
          Incidente de segurança é vazamento, acesso indevido, alteração ou
          perda de dados. Se acontecer, a Unooria comunica a rede de ensino
          assim que toma conhecimento, com o que já se sabe: o que aconteceu,
          quais dados e quantas pessoas podem ter sido afetadas, o que já foi
          feito e o que estamos fazendo.
        </p>
        <p>
          A comunicação à ANPD e às pessoas afetadas é feita pela rede, que é a
          controladora, nos prazos fixados pela regulamentação da Autoridade — e
          nós fornecemos tudo o que for necessário para ela cumprir esses
          prazos. Quando o risco for relevante para você, a comunicação diz em
          linguagem clara o que houve e o que você pode fazer.
        </p>
        <p>
          Se você suspeitar de um problema — uma conta que não deveria abrir, um
          dado de outra pessoa aparecendo na sua tela — avise a escola e escreva
          para{" "}
          <a href={`mailto:${IDENTIFICACAO.emailEncarregado}`}>
            {IDENTIFICACAO.emailEncarregado}
          </a>
          .
        </p>
      </>
    ),
  },

  /* ------------------------------------------------------------------ 16 */
  {
    id: "em-definicao",
    titulo: "O que ainda está sendo definido",
    conteudo: (
      <>
        <p>
          Esta seção existe porque a alternativa seria calar. Os pontos abaixo
          estão em aberto, e nenhum deles foi disfarçado de compromisso nas
          seções anteriores. Eles serão fechados com cada rede de ensino, e esta
          página será atualizada quando forem.
        </p>
        <ul>
          <li>
            <strong>
              Prazos de guarda e eliminação por categoria de dado.
            </strong>{" "}
            Quem os define é a rede, como controladora. Hoje não há rotina
            automática de eliminação, como diz a seção 11.
          </li>
          <li>
            <strong>Registro individual de acesso a dado pessoal.</strong> Saber
            qual gestor abriu qual ficha ainda não é registrado. Está no plano
            de trabalho, junto com a guarda dedicada dos registros de acesso
            exigidos pelo Marco Civil.
          </li>
          <li>
            <strong>Região do processamento de inteligência artificial.</strong>{" "}
            A mudança para uma região brasileira está em avaliação e encerraria
            a transferência internacional descrita na seção 10.
          </li>
          <li>
            <strong>Confirmação contratual com o provedor de IA</strong> de que
            os textos enviados não alimentam o treinamento dos modelos dele.
          </li>
          <li>
            <strong>
              Canal próprio para responsáveis e ferramentas de supervisão
              parental.
            </strong>{" "}
            Hoje o caminho da família é a escola. O ECA Digital trata do tema e
            a solução ainda está sendo desenhada com as redes.
          </li>
          <li>
            <strong>
              Relatório de impacto à proteção de dados e avaliação de risco
              algorítmico
            </strong>
            , com resumo público em linguagem simples, como pede o Decreto
            12.880/2026.
          </li>
          <li>
            <strong>Dados de registro da Unooria e do encarregado</strong> —
            razão social, CNPJ, nome do encarregado e endereços de contato —
            serão confirmados na versão publicada com cada rede.
          </li>
          <li>
            <strong>Identificação nominal da controladora</strong> — qual
            secretaria, com qual CNPJ e qual encarregado — depende do contrato
            de cada rede e entra aqui na versão dela.
          </li>
        </ul>
        <p>
          Esta política ainda passará por revisão jurídica antes de ser adotada
          por uma rede. O que ela já garante é que nenhuma frase aqui descreve
          funcionalidade que não exista.
        </p>
      </>
    ),
  },

  /* ------------------------------------------------------------------ 17 */
  {
    id: "alteracoes-e-contato",
    titulo: "Alterações e contato",
    conteudo: (
      <>
        <p>
          Quando esta política mudar, a versão e a data no topo da página mudam
          junto. Se a mudança for relevante — dado novo, finalidade nova,
          terceiro novo — avisamos a rede de ensino antes, com o teor da
          alteração, e destacamos o aviso nesta página. Não alteramos o texto em
          silêncio.
        </p>
        <p>
          Para qualquer assunto de privacidade, o contato é o{" "}
          {IDENTIFICACAO.encarregado}:{" "}
          <a href={`mailto:${IDENTIFICACAO.emailEncarregado}`}>
            {IDENTIFICACAO.emailEncarregado}
          </a>
          . Para denúncia de violação a direitos de criança e adolescente:{" "}
          <a href={`mailto:${IDENTIFICACAO.emailDenuncia}`}>
            {IDENTIFICACAO.emailDenuncia}
          </a>
          .
        </p>
        <p>
          O contato do encarregado da sua rede de ensino é divulgado pela
          própria secretaria, e é para ele que vão os pedidos sobre os quais a
          Unooria não pode decidir sozinha.
        </p>
      </>
    ),
  },
];

export default function Privacidade() {
  return (
    <CascaLegal
      titulo="Política de Privacidade"
      resumo={
        <p>
          O que a Plataforma Unooria sabe sobre você, por que sabe, com quem
          compartilha e por quanto tempo guarda. Está escrito para ser entendido
          por quem usa a plataforma — inclusive por estudantes — e descreve o
          que o sistema realmente faz hoje.
        </p>
      }
      meta={[
        { rotulo: "Versão", valor: IDENTIFICACAO.versao },
        { rotulo: "Em vigor desde", valor: IDENTIFICACAO.vigenciaDesde },
        { rotulo: "Controladora", valor: "Sua rede de ensino" },
        { rotulo: "Papel da Unooria", valor: "Operadora" },
      ]}
      secoes={SECOES}
      aviso={
        <div className="legal-nota legal-nota--atencao">
          <div className="legal-nota__corpo">
            <p>
              <strong>Leia isto primeiro:</strong> quem decide sobre os seus
              dados é a <strong>rede pública de ensino</strong> que contratou a
              plataforma. A Unooria trata os dados por instrução dela. Pedidos e
              reclamações começam na sua escola ou no encarregado de proteção de
              dados da sua rede — e a seção{" "}
              <a href="#seus-direitos">Seus direitos</a> mostra o caminho.
            </p>
          </div>
        </div>
      }
      atalhos={[
        {
          href: "/termos",
          titulo: "Termos de Uso",
          texto: "As regras de uso da plataforma.",
          icone: "gavel",
        },
      ]}
    />
  );
}
