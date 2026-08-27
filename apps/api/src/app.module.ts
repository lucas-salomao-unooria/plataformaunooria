import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { validarEnv } from "./config/env";
import { AuthModule } from "./auth/auth.module";
import { PrismaModule } from "./prisma/prisma.module";
import { HealthModule } from "./health/health.module";
import { TelemetryModule } from "./telemetry/telemetry.module";
import { ProgressoModule } from "./progress/progresso.module";
import { AiModule } from "./ai/ai.module";
import { UsuariosModule } from "./usuarios/usuarios.module";
import { ExperienciasModule } from "./experiencias/experiencias.module";
import { MotorModule } from "./motor/motor.module";
import { AssetsModule } from "./assets/assets.module";
import { AtividadesModule } from "./atividades/atividades.module";
import { GeracaoModule } from "./geracao/geracao.module";
import { AnaliseModule } from "./analise/analise.module";
import { PerfisModule } from "./perfis/perfis.module";
import { UnootubeModule } from "./unootube/unootube.module";
import { UnoogptModule } from "./unoogpt/unoogpt.module";
import { VilaModule } from "./vila/vila.module";
import { StorageModule } from "./object-storage/storage.module";
import { PlanosModule } from "./planos/planos.module";
import { BemEstarModule } from "./bemestar/bemestar.module";
import { TenancyInterceptor } from "./tenancy/tenancy.interceptor";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validarEnv }),
    AuthModule,
    PrismaModule,
    HealthModule,
    TelemetryModule,
    ProgressoModule,
    AiModule,
    UsuariosModule,
    ExperienciasModule,
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
  ],
  providers: [
    // Depois dos guards em toda rota: abre o AsyncLocalStorage com a escola do
    // token para o PrismaService.comTenancy armar a RLS.
    { provide: APP_INTERCEPTOR, useClass: TenancyInterceptor },
  ],
})
export class AppModule {}
