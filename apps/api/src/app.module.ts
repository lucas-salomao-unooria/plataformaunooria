import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_INTERCEPTOR, DiscoveryModule } from "@nestjs/core";
import { validarEnv } from "./config/env";
import { ObservabilidadeModule } from "./observabilidade/observabilidade.module";
import { AuthModule } from "./auth/auth.module";
import { PrismaModule } from "./prisma/prisma.module";
import { HealthModule } from "./health/health.module";
import { TelemetryModule } from "./telemetry/telemetry.module";
import { ProgressoModule } from "./progress/progresso.module";
import { AiModule } from "./ai/ai.module";
import { UsuariosModule } from "./usuarios/usuarios.module";
import { PortabilidadeModule } from "./portabilidade/portabilidade.module";
import { RosteringModule } from "./rostering/rostering.module";
import { ExperienciasModule } from "./experiencias/experiencias.module";
import { RecursosModule } from "./recursos/recursos.module";
import { ProspeccaoModule } from "./prospeccao/prospeccao.module";
import { MotorModule } from "./motor/motor.module";
import { AssetsModule } from "./assets/assets.module";
import { AtividadesModule } from "./atividades/atividades.module";
import { GeracaoModule } from "./geracao/geracao.module";
import { AnaliseModule } from "./analise/analise.module";
import { PerfisModule } from "./perfis/perfis.module";
import { FotoContaModule } from "./foto-conta/foto-conta.module";
import { RastroBoatoModule } from "./rastro-boato/rastro-boato.module";
import { ManifestoIaModule } from "./manifesto-ia/manifesto-ia.module";
import { QuemMandouIssoModule } from "./quem-mandou-isso/quem-mandou-isso.module";
import { ASelecaoModule } from "./a-selecao/a-selecao.module";
import { JornalEscolaModule } from "./jornal-escola/jornal-escola.module";
import { PodcastModule } from "./podcast/podcast.module";
import { JuriEstadualModule } from "./juri-estadual/juri-estadual.module";
import { EfeitoAmplificadorModule } from "./efeito-amplificador/efeito-amplificador.module";
import { EnigmaCapaModule } from "./enigma-capa/enigma-capa.module";
import { AssistenteInvisivelModule } from "./assistente-invisivel/assistente-invisivel.module";
import { SalasModule } from "./salas/salas.module";
import { EquipesModule } from "./equipes/equipes.module";
import { EvidenciasModule } from "./evidencias/evidencias.module";
import { UnoogptModule } from "./unoogpt/unoogpt.module";
import { VilaModule } from "./vila/vila.module";
import { StorageModule } from "./object-storage/storage.module";
import { PlanosModule } from "./planos/planos.module";
import { PlanejamentoModule } from "./planejamento/planejamento.module";
import { BemEstarModule } from "./bemestar/bemestar.module";
import { AgenteProfessorModule } from "./agente-professor/agente-professor.module";
import { AjudaModule } from "./ajuda/ajuda.module";
import { TenancyInterceptor } from "./tenancy/tenancy.interceptor";
import { ContratoInterceptor } from "./openapi/contrato.interceptor";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validarEnv }),
    // Primeiro: o logger do Nest e o filtro global de exceção. Ver
    // `observabilidade/observabilidade.module.ts`.
    ObservabilidadeModule,
    // `DiscoveryService` percorre os controllers para montar o documento
    // OpenAPI e para a trava de cobertura — é a API pública do Nest para isso,
    // em vez de cutucar o `_router` do express.
    DiscoveryModule,
    AuthModule,
    PrismaModule,
    HealthModule,
    TelemetryModule,
    ProgressoModule,
    AiModule,
    UsuariosModule,
    RosteringModule,
    PortabilidadeModule,
    ExperienciasModule,
    RecursosModule,
    ProspeccaoModule,
    SalasModule,
    EquipesModule,
    EvidenciasModule,
    MotorModule,
    AssetsModule,
    AtividadesModule,
    GeracaoModule,
    PerfisModule,
    AnaliseModule,
    UnoogptModule,
    VilaModule,
    StorageModule,
    PlanosModule,
    PlanejamentoModule,
    BemEstarModule,
    AgenteProfessorModule,
    AjudaModule,
    RastroBoatoModule,
    ManifestoIaModule,
    QuemMandouIssoModule,
    ASelecaoModule,
    JornalEscolaModule,
    JuriEstadualModule,
    EfeitoAmplificadorModule,
    EnigmaCapaModule,
    AssistenteInvisivelModule,
    FotoContaModule,
    // O ÚLTIMO, de propósito: é global (`podcast/podcast.module.ts`).
    PodcastModule,
  ],
  providers: [
    // Depois dos guards em toda rota: preenche a escola do token no
    // AsyncLocalStorage da requisição (aberto pelo `contextoMiddleware` em
    // `main.ts`) para o PrismaService.comTenancy armar a RLS.
    { provide: APP_INTERCEPTOR, useClass: TenancyInterceptor },
    // DEPOIS do de tenancy: este só olha a resposta na volta, e fora de
    // produção. Ver `openapi/contrato.interceptor.ts`.
    { provide: APP_INTERCEPTOR, useClass: ContratoInterceptor },
  ],
})
export class AppModule {}
