# Liga Digital | Questionário de validação para os times

**Unooria · Versão 1 · 30/10/2026**

**Objetivo.** Validar com os times responsáveis as capacidades atuais da Liga Digital e os compromissos de entrega da primeira versão, produzindo evidências suficientes para finalizar um Termo de Referência (TR) técnico e pedagógico. Este material foi escrito para pessoas que não participaram da entrevista de descoberta.

**Contexto mínimo do produto.** A solução combina coleção didática de letramento digital, livro do professor e experiências digitais chamadas “missões”. A previsão inicial é uma missão por bimestre e ano/série, do 1º ano do Ensino Fundamental ao 3º ano do Ensino Médio. O professor contextualiza conteúdos de certas missões com auxílio de IA, acompanha a execução em sala e consulta resultados ligados a habilidades curriculares. A plataforma também pode empregar IA diretamente em experiências específicas dos alunos.

**Como responder.** Para cada pergunta, informem: (1) o comportamento que existe hoje; (2) eventuais limitações; (3) o que está em desenvolvimento ou planejado; (4) a evidência disponível, como vídeo, captura de tela, especificação, teste ou fluxo. Se algo não existe, escrevam “não existe atualmente”. Não assumam que uma ideia do texto já está implementada.

**Distinção essencial.** As perguntas investigam funcionalidades existentes e lacunas. A seção final contém SEIS requisitos já definidos como obrigatórios para a V1, independentemente de sua implementação atual. Ideias de roadmap que não são compromissos da V1 devem continuar fora do escopo mínimo do TR até decisão explícita.

## Perguntas de validação

### A. Produto e Pedagogia

#### P01 · Quais informações pedagógicas são apresentadas ao professor antes de executar uma missão?

**Contexto:** Sabemos que o professor acessa, dentro da plataforma, uma tela com o detalhamento de cada missão. Ainda não sabemos quais informações compõem essa ficha. Precisamos descrever precisamente esse suporte no Termo de Referência.

**Precisamos que o time esclareça:**
1. Informar quais campos estão disponíveis hoje: objetivos de aprendizagem, série e bimestre, habilidades/competências da BNCC, duração, materiais necessários, sequência de aplicação, critérios de avaliação e correspondência com o livro.
2. Indicar em qual tela o professor encontra essas informações e quais são obrigatórias versus opcionais.
3. Anexar uma captura de tela ou exemplo real de ficha de missão.

#### P02 · Que informações o professor pode usar para contextualizar uma missão com o assunto trabalhado em sala?

**Contexto:** O professor escolhe um contexto ligado à disciplina ou ao conteúdo de aula. A IA então gera textos e imagens para a experiência simulada, sem alterar a estrutura pedagógica da missão nem suas rubricas de avaliação.

**Precisamos que o time esclareça:**
1. Descrever o passo a passo do formulário de personalização e todos os tipos de entrada aceitos hoje (texto livre, tema, série, objetivo, referências etc.).
2. Esclarecer se já é possível anexar documentos, como PDF, plano de aula, apostila ou link, para orientar a geração. Se não, registrar explicitamente.
3. Informar quais elementos são produzidos ou alterados pela IA e quais permanecem fixos.
4. Anexar um exemplo de entrada do professor e do conteúdo resultante.

#### P03 · Uma missão contextualizada por um professor pode ser salva, reaproveitada ou compartilhada?

**Contexto:** Exemplo: uma professora de Ciências prepara uma missão sobre desinformação usando o tema “vacinas”. Ela revisa os conteúdos gerados pela IA e aplica a missão ao 8º ano A. Queremos saber se é necessário refazer essa personalização para o 8º ano B ou no ano seguinte, e se outro professor pode aproveitá-la.

**Precisamos que o time esclareça:**
1. A configuração e o conteúdo aprovado ficam gravados como uma versão reutilizável, ou servem apenas para aquela aplicação?
2. É possível duplicar a missão contextualizada para outra turma, outro período letivo ou outro professor?
3. Caso exista compartilhamento, em qual abrangência: apenas o criador, professores da mesma escola, rede de ensino ou biblioteca comum?
4. Quem pode visualizar, editar, aprovar, republicar ou excluir essas versões? Como são tratadas alterações posteriores no conteúdo original?
5. Se nada disso existir hoje, deixar explícito e indicar se há previsão.

#### P04 · Como ocorre a curadoria dos conteúdos gerados pela IA antes de disponibilizar a missão?

**Contexto:** A personalização pode produzir vários itens, como publicações fictícias, mensagens, imagens ou notícias. Sabemos que o professor revisa o material antes de utilizá-lo; precisamos entender os controles reais dessa revisão.

**Precisamos que o time esclareça:**
1. O professor consegue visualizar cada item, aprová-lo, rejeitá-lo, editá-lo ou solicitar nova geração?
2. O que acontece se um item for rejeitado? Há nova geração automática ou manual?
3. A aprovação é individual, por grupos, ou existe aprovação de todos os itens de uma só vez?
4. O sistema registra o conteúdo efetivamente aprovado e por quem? Há alguma verificação adicional antes da publicação?

#### P05 · Quais comandos o professor pode executar durante a aplicação de uma missão em sala?

**Contexto:** Algumas missões permitem ao professor acompanhar o progresso da turma em tempo real e controlar a liberação de etapas ou conteúdos. Não sabemos se essa capacidade existe em todo o catálogo nem todos os controles disponíveis.

**Precisamos que o time esclareça:**
1. Listar, missão por missão ou por tipo de experiência, os comandos efetivamente disponíveis (por exemplo: iniciar, liberar etapa, pausar, retomar, encerrar ou projetar resultados).
2. Explicar o que os alunos visualizam e o que ocorre quando cada comando é acionado.
3. Esclarecer como o painel identifica estudantes que ainda não iniciaram, estão em andamento ou concluíram.
4. Apontar limitações: atraso de atualização, necessidade de todos estarem conectados ou impossibilidade de voltar etapas.

#### P06 · Como a plataforma trata uma nova aplicação da mesma missão e novas tentativas de um aluno?

**Contexto:** Precisamos diferenciar três objetos: a missão-base do catálogo, a aplicação personalizada criada para determinada turma e a tentativa individual do estudante. Sabemos que há restrições de reexecução, mas sua regra exata não está clara.

**Precisamos que o time esclareça:**
1. Um professor pode criar uma nova aplicação da mesma missão-base para a mesma turma?
2. Um aluno que concluiu uma missão pode realizá-la novamente? Em quais situações: erro, ausência, reinício, nova personalização ou ano letivo seguinte?
3. Se houver nova tentativa, o histórico da anterior permanece preservado? Qual resultado passa a aparecer nos dashboards e na evolução da habilidade?
4. Como o sistema distingue uma reaplicação legítima de duplicidade acidental de evidências de aprendizagem?

#### P07 · Como são produzidas e avaliadas evidências pedagógicas quando o aluno conversa livremente com uma IA?

**Contexto:** Em uma das experiências, o aluno interage diretamente com um modelo de linguagem, sob guardrails. Nas missões estruturadas, as habilidades da BNCC são avaliadas por regras e rubricas definidas por pedagogos. Uma conversa aberta permite respostas muito variadas e requer esclarecimento específico.

**Precisamos que o time esclareça:**
1. A avaliação considera o conteúdo e a qualidade da conversa, apenas eventos estruturados (por exemplo, selecionar uma opção) ou ambos?
2. Quem define os critérios de avaliação e como uma evidência é vinculada a cada habilidade da BNCC?
3. Há uso de LLM para interpretar as respostas do aluno? Se sim, como é controlada ou validada a consistência da classificação?
4. O professor consegue consultar a evidência que fundamentou o resultado, respeitando as regras de proteção de dados?
5. Apresentar um exemplo anonimizado da interação, das evidências extraídas e do resultado pedagógico.

#### P08 · Como a qualidade das recomendações pedagógicas geradas por IA é validada?

**Contexto:** A plataforma usa IA, orientada por prompts definidos por pedagogos, para sugerir ao professor como trabalhar dificuldades identificadas na missão. Para a V1, essas recomendações também deverão considerar o assunto com que o docente personalizou a atividade.

**Precisamos que o time esclareça:**
1. Indicar quais entradas a IA recebe atualmente: resultados por habilidade, evidências comportamentais, perfil da turma, contexto definido pelo professor e outras.
2. Descrever quem elabora, revisa e versiona os prompts e como é avaliada a qualidade pedagógica das recomendações.
3. Esclarecer se a plataforma diferencia dados observados de sugestões geradas, e como evita inventar conclusões não suportadas pelas evidências.
4. Apresentar um exemplo real ou de homologação: contexto da missão, resultado da turma e recomendação produzida.

#### P09 · Quais recursos de acessibilidade e inclusão estão disponíveis em cada tipo de missão?

**Contexto:** As missões atendem estudantes do 1º ano do Ensino Fundamental ao Ensino Médio. Nas séries iniciais predominam experiências visuais mediadas pelo professor. O uso simultâneo de áudio sem fones já se mostrou problemático em teste, mas isso não elimina necessidades de acessibilidade.

**Precisamos que o time esclareça:**
1. Listar recursos que existem hoje: navegação por teclado, leitor de tela, textos alternativos, legendas/transcrições, contraste, ampliação de texto, suporte a estudantes não alfabetizados e outros.
2. Indicar quais missões têm limitações conhecidas e que alternativas pedagógicas estão disponíveis.
3. Esclarecer se áudio e outros recursos podem ser ativados conforme equipamentos e necessidades da escola.
4. Informar testes de acessibilidade realizados, resultados e plano para corrigir barreiras identificadas.

#### P10 · Quais foram os resultados documentados da prova de conceito realizada com o Instituto Paula Souza?

**Contexto:** Sabemos que uma PoC foi realizada, mas não dispomos do relatório. Não queremos declarar ganho de aprendizagem, engajamento ou aceitação sem evidências verificáveis.

**Precisamos que o time esclareça:**
1. Informar período, objetivos, hipóteses, missões testadas, perfil e número de estudantes e professores participantes.
2. Descrever metodologia, instrumentos de coleta e o que foi efetivamente medido: usabilidade, conclusão, engajamento, compreensão, aprendizagem, satisfação etc.
3. Consolidar resultados, limitações, dificuldades operacionais e mudanças de produto derivadas do teste.
4. Compartilhar relatório, apresentações, instrumentos de pesquisa e dados agregados/anônimos que possam embasar o TR.

### B. Tecnologia, IA, Segurança e Operação

#### T01 · Quais combinações de navegador, dispositivo e conectividade estão efetivamente suportadas?

**Contexto:** Sabemos que a plataforma é 100% web, não exige instalador e possui frontend responsivo. Precisamos transformar essa afirmação em uma especificação verificável para redes com computadores antigos, tablets e smartphones diversos.

**Precisamos que o time esclareça:**
1. Informar navegadores e versões mínimas testadas, sistemas operacionais e tamanhos de tela recomendados.
2. Apontar experiências que tenham limitação funcional ou de usabilidade em smartphones ou telas menores.
3. Informar requisitos mínimos conhecidos de conexão e comportamento sob baixa largura de banda.
4. Anexar matriz de compatibilidade e evidência de testes, se disponíveis.

#### T02 · Como funciona a autenticação dos usuários, inclusive quando a rede já possui seu próprio sistema de identidade?

**Contexto:** A solução admite autenticação própria ou integrada à identidade da Secretaria. Foi mencionada integração OAuth; queremos identificar exatamente os protocolos e o fluxo de provisionamento e acesso.

**Precisamos que o time esclareça:**
1. Quais métodos de login estão implementados hoje? Há autenticação federada com OpenID Connect (OIDC), SAML ou outro padrão?
2. Como são associados alunos, professores e gestores às escolas, turmas e perfis autorizados após autenticação?
3. Como ocorre revogação de acesso quando alguém sai da rede, muda de escola ou de função?
4. Existe documentação técnica ou diagrama do fluxo de login/SSO?

#### T03 · Como são criados e mantidos os cadastros de escolas, turmas, alunos e professores?

**Contexto:** Foi informado suporte ao padrão OneRoster por arquivos e APIs. Também sabemos que alterações precisam ser enviadas pela rede à plataforma; não devemos prometer sincronização automática por consulta periódica se ela não existir.

**Precisamos que o time esclareça:**
1. Confirmar versão do OneRoster suportada e entidades/campos aceitos.
2. Informar modos de integração em produção: CSV/arquivos, API REST e eventuais mecanismos alternativos.
3. Explicar como são tratados inclusão, alteração, transferência de escola/turma, desligamento, duplicidade, erros e importação parcial.
4. Informar se a plataforma consulta mudanças automaticamente ou se o sistema da Secretaria deve enviar as atualizações.
5. Compartilhar especificação de API, leiautes e um exemplo de carga de teste.

#### T04 · Quais controles garantem que cada usuário veja somente dados de sua competência?

**Contexto:** Os painéis têm níveis de Secretaria, escola e professor, e a autorização é aplicada também no backend/API. Precisamos documentar o isolamento entre redes contratantes, escolas e turmas para fins de segurança e aceite.

**Precisamos que o time esclareça:**
1. Listar perfis de acesso e quais dados e ações cada um pode executar.
2. Explicar como a autorização é aplicada às chamadas de API, exportações e dashboards, inclusive quando um identificador de escola/turma é manipulado.
3. Informar como o sistema trata profissionais vinculados a mais de uma escola/turma e transferências de alunos.
4. Indicar testes existentes de segregação de dados e permissões.

#### T05 · Que mecanismos impedem conteúdo inadequado nas duas modalidades de IA da plataforma?

**Contexto:** A IA é usada tanto para gerar material contextualizado que o professor revisa quanto em missões nas quais o aluno conversa diretamente com uma LLM. Existem guardrails, mas a proteção e os riscos dessas modalidades são diferentes.

**Precisamos que o time esclareça:**
1. Descrever controles aplicados antes, durante e após a geração de conteúdo em cada modalidade: instruções de sistema, filtros, moderação, bloqueio de pedidos, limites de assunto e monitoramento.
2. Explicar como esses controles consideram idade, etapa escolar e temas sensíveis que podem precisar ser abordados criticamente, como cyberbullying ou golpes.
3. O que acontece quando há uma tentativa de obter resposta imprópria, contornar instruções ou enviar informações pessoais?
4. Como os guardrails são testados, atualizados e monitorados? Há registros de incidentes e medidas de correção?
5. Indicar o que depende do provedor do modelo e o que é controlado diretamente pela Unooria.

#### T06 · Quais dados pessoais e pedagógicos são tratados e para onde eles circulam, especialmente no uso de IA?

**Contexto:** A solução atende crianças e adolescentes e registra atividades individuais, evidências de aprendizagem e, em certos casos, conversas com LLM. O jurídico definirá as bases e responsabilidades legais; o time técnico deve fornecer um mapa fiel dos fluxos e controles.

**Precisamos que o time esclareça:**
1. Listar categorias de dados coletados, finalidades operacionais, serviços envolvidos, locais de armazenamento e destinatários/suboperadores.
2. Esclarecer se textos, imagens, prompts, respostas e identificadores de alunos ou professores são enviados a provedores externos de IA; quais dados são minimizados/pseudonimizados.
3. Informar políticas técnicas de retenção, exclusão, anonimização, backup, acesso e resposta a incidentes.
4. Confirmar se provedores de IA utilizam dados para treinar modelos e qual é a configuração contratual/técnica aplicável.
5. Fornecer diagramas de fluxo de dados e documentos de segurança para revisão por Jurídico/DPO.

#### T07 · Como funciona a trilha de auditoria dos principais eventos da plataforma?

**Contexto:** Já sabemos que há registros de usuário, horário e ação. Para o TR, precisamos saber quais operações são auditáveis e se as evidências são preservadas, sobretudo quando o professor altera uma classificação de habilidade.

**Precisamos que o time esclareça:**
1. Quais eventos são registrados hoje: acesso, criação/edição/publicação de missão, aprovação de conteúdo, ações administrativas, revisão de avaliação e consulta a dados sensíveis?
2. Que campos cada registro contém: ator, data/hora, objeto afetado, valor anterior, valor novo, justificativa e identificador de correlação?
3. Qual é a política de retenção, controle de acesso, consulta, exportação e proteção contra alteração/exclusão indevida?
4. Para revisões de avaliação, confirmar como o resultado original continua recuperável depois da alteração docente.
5. Apresentar exemplo anonimizado de trilha completa.

#### T08 · O que acontece quando a conexão ou o dispositivo falha durante uma missão?

**Contexto:** A execução ocorre no navegador e é usada em escolas com qualidade de conexão variável. Precisamos saber se o aluno perde o progresso quando a internet cai, o navegador fecha ou o dispositivo reinicia.

**Precisamos que o time esclareça:**
1. Em que momento o progresso é salvo e quais eventos são persistidos?
2. É possível retomar do ponto anterior após reconectar? Em quais missões ou etapas não é possível?
3. O que ocorre com respostas e evidências registradas pouco antes da interrupção? Há risco de perda ou duplicidade?
4. A plataforma exige conectividade contínua? Existe algum comportamento offline, ainda que limitado?

#### T09 · Que condições de escala, disponibilidade, monitoramento e suporte podem ser comprovadas?

**Contexto:** Uma Secretaria pode ter milhares de alunos iniciando missões em janelas semelhantes. O TR deve exigir níveis de serviço proporcionais e mensuráveis, sem determinar arquitetura ou tecnologias específicas do fornecedor.

**Precisamos que o time esclareça:**
1. Informar testes de carga já realizados: usuários simultâneos, duração, perfis de uso, limites encontrados e resultados.
2. Indicar métricas monitoradas (erros, latência, disponibilidade, filas, falhas em IA), alertas e procedimentos de tratamento.
3. Apresentar compromissos de suporte, canais, horários, severidades, tempos de resposta/restabelecimento e janelas de manutenção que podem ser assumidos.
4. Explicar estratégia operacional de contingência e recuperação de desastres em termos de resultados mensuráveis.

#### T10 · Quais eventos e indicadores operacionais permitem acompanhar a adoção pelas escolas?

**Contexto:** A plataforma já possui dashboards pedagógicos, mas exigimos na V1 uma visão administrativa distinta: saber se as escolas e turmas estão efetivamente usando a solução, não apenas como os alunos se saíram nas missões.

**Precisamos que o time esclareça:**
1. Confirmar quais eventos já são coletados: ativação de escolas/turmas, acesso de professores e estudantes, missões configuradas, iniciadas e concluídas, participação por período e pendências.
2. Listar indicadores e filtros hoje existentes para Secretaria, escola, turma, ano/série e bimestre; esclarecer periodicidade de atualização.
3. Indicar quais indicadores ainda precisam ser criados para a V1 e suas dependências.
4. Explicar como os indicadores tratam duplicidades, ausências, transferência de turma e diferenças entre usuários cadastrados e usuários ativos.

#### T11 · Como será implementado o modo de pré-visualização integral da missão pelo professor?

**Contexto:** O professor precisa experimentar a missão já contextualizada com os conteúdos que aprovou, antes de disponibilizá-la à turma. Esse recurso é um must-have da V1 e ainda não estava implementado na entrevista.

**Precisamos que o time esclareça:**
1. O preview percorre todas as etapas e interações da experiência, inclusive ramificações e conteúdos gerados por IA?
2. Como o professor retorna ao setup para corrigir uma publicação, imagem ou contexto antes da aplicação?
3. Como o sistema garante que interações feitas no preview não gerem participação, conclusão ou evidências avaliativas de alunos reais?
4. Há limitações por missão, plano de implementação, responsável e data prevista para homologação?

### C. Editorial, Formação e Implantação

#### E01 · Como a coleção didática e as missões digitais se articulam em cada ano e bimestre?

**Contexto:** A proposta integra materiais seriados para alunos e professores, com sete aulas apoiadas no material didático e uma vivência digital prevista para a oitava aula. Precisamos demonstrar o caráter pedagógico integrado da solução, sem transformar o TR em exigência de uma editora específica.

**Precisamos que o time esclareça:**
1. Fornecer matriz por ano/série e bimestre com tema, objetivos, habilidades BNCC, capítulos/aulas do livro e missão digital correspondente.
2. Especificar componentes entregues: livro do aluno, livro do professor, recursos digitais e eventuais materiais complementares.
3. Explicar como são mantidas coerência curricular, atualização de conteúdos e inclusão de novas missões durante o contrato.
4. Compartilhar amostras e documentos editoriais que possam embasar critérios objetivos de avaliação.

#### E02 · Quais orientações e materiais de apoio o professor recebe para preparar, conduzir e discutir as missões?

**Contexto:** Além da ficha digital de missão, pode haver orientações no livro do professor e em materiais de apoio. Precisamos evitar exigir na plataforma conteúdos que estejam apenas no material impresso, e vice-versa.

**Precisamos que o time esclareça:**
1. Listar guias, roteiros, exemplos de personalização, instruções de condução, propostas de discussão pós-missão e orientações de interpretação dos resultados.
2. Indicar o que está no livro, o que está na plataforma e o que é entregue separadamente.
3. Explicar se esses materiais estão disponíveis para todas as séries/missões ou apenas parte do catálogo.

#### E03 · Qual é o escopo real de implantação, formação docente e apoio pedagógico oferecido às redes?

**Contexto:** Para uma contratação pública, a oferta não se encerra com licença e livros. A Secretaria precisa saber quem cadastra a rede, forma as equipes, acompanha a adesão e responde às dúvidas sobre aplicação em sala.

**Precisamos que o time esclareça:**
1. Descrever etapas de implantação, responsáveis por cada atividade, pré-requisitos da Secretaria e marcos de aceite.
2. Informar modelo de formação inicial e continuada: público, carga horária, modalidade, materiais, frequência e comprovação de participação.
3. Explicar canais de suporte técnico e pedagógico e como são escalados problemas de conteúdo, uso ou integração.
4. Indicar entregáveis e evidências documentais disponíveis para fiscalização contratual.

## Compromissos obrigatórios para a primeira versão (V1)

Cada responsável deve informar **status atual** (implementado / parcial / não implementado), **lacuna para o comportamento esperado**, **responsável**, **previsão de homologação** e **evidência de aceite**. Abaixo são requisitos decididos, não novas sugestões.

### V1-01 · Indicadores de adoção e uso
**Comportamento esperado:** O gestor acompanha, por rede/escola/turma/bimestre, quem acessou, iniciou ou concluiu atividades e onde há baixa participação.
**Áreas sugeridas:** Produto + Dados/Engenharia

**Resposta esperada:** status atual; diferenças para o comportamento esperado; plano e marco de entrega; evidência disponível ou plano de teste.

### V1-02 · Pré-visualização completa do professor
**Comportamento esperado:** Após personalizar uma missão, o docente executa uma simulação sem criar participação ou notas falsas para os estudantes.
**Áreas sugeridas:** Produto + Engenharia

**Resposta esperada:** status atual; diferenças para o comportamento esperado; plano e marco de entrega; evidência disponível ou plano de teste.

### V1-03 · Recomendações pedagógicas por IA
**Comportamento esperado:** Resultados de avaliação geram sugestões de intervenção formuladas com prompts e diretrizes definidos por pedagogos.
**Áreas sugeridas:** Pedagogia + IA

**Resposta esperada:** status atual; diferenças para o comportamento esperado; plano e marco de entrega; evidência disponível ou plano de teste.

### V1-04 · Recomendações considerando a contextualização
**Comportamento esperado:** A recomendação combina habilidades BNCC, evidências da turma e o tema escolhido no setup, por exemplo, “vacinas” em uma atividade sobre desinformação.
**Áreas sugeridas:** Pedagogia + IA

**Resposta esperada:** status atual; diferenças para o comportamento esperado; plano e marco de entrega; evidência disponível ou plano de teste.

### V1-05 · Revisão docente da avaliação
**Comportamento esperado:** O professor pode substituir a classificação automática de uma habilidade, mantendo a decisão pedagógica final.
**Áreas sugeridas:** Produto + Pedagogia

**Resposta esperada:** status atual; diferenças para o comportamento esperado; plano e marco de entrega; evidência disponível ou plano de teste.

### V1-06 · Justificativa e auditoria obrigatórias
**Comportamento esperado:** Ao revisar uma classificação, o docente precisa justificar; ficam preservados resultado original, novo resultado, autor, data/hora e histórico de alterações.
**Áreas sugeridas:** Produto + Engenharia/Security

**Resposta esperada:** status atual; diferenças para o comportamento esperado; plano e marco de entrega; evidência disponível ou plano de teste.

## Observações para consolidação do Termo de Referência

- Não tratar “existe em desenvolvimento” como “implementado”.
- Sempre que possível, demonstrar funções em ambiente de homologação com dados sintéticos.
- Informar restrições operacionais relevantes mesmo quando a funcionalidade existe.
- Dados sobre resultados de PoC devem trazer metodologia e limitações, não apenas alegações de sucesso.
- Requisitos de acessibilidade e proteção de dados exigíveis legalmente não dependem de inscrição no roadmap.
- O TR deverá descrever resultados observáveis e critérios de aceite, sem exigir arquitetura, marca ou fornecedor específico sem justificativa.
