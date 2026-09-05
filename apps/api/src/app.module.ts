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
import { MotorModule } from "./motor/motor.module";
import { AssetsModule } from "./assets/assets.module";
import { AtividadesModule } from "./atividades/atividades.module";
import { GeracaoModule } from "./geracao/geracao.module";
import { AnaliseModule } from "./analise/analise.module";
import { PerfisModule } from "./perfis/perfis.module";
import { OEcoNoGrupoModule } from "./o-eco-no-grupo/o-eco-no-grupo.module";
import { SalasModule } from "./salas/salas.module";
import { UnootubeModule } from "./unootube/unootube.module";
import { UnoogptModule } from "./unoogpt/unoogpt.module";
import { VilaModule } from "./vila/vila.module";
import { StorageModule } from "./object-storage/storage.module";
import { PlanosModule } from "./planos/planos.module";
import { BemEstarModule } from "./bemestar/bemestar.module";
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
    SalasModule,
    MotorModule,
    AssetsModule,
    AtividadesModule,
    GeracaoModule,
    PerfisModule,
    AnaliseModule,
    UnootubeModule,
    UnoogptModule,
    VilaModule,
    StorageModule,
    PlanosModule,
    BemEstarModule,
    OEcoNoGrupoModule,
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
