import { Module, Global } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER, Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { TransformInterceptor } from './interceptors/transform.interceptor';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { RoutineService } from './routines/services/routine.service';
import { ConfigModule } from './config/config.module';
import { CommonConfigService } from './config/config.service';

/**
 * Factory for RoutineService — uses CommonConfigService instead of relying on
 * the broken custom-token @Inject(ROUTINE_CONFIG) path.
 */
function createRoutineService(configService: CommonConfigService): any {
  return new RoutineService({
    enabled: (configService.get('ROUTINE_ENABLED') ?? 'false') === 'true',
    executionMode:
      (configService.get('ROUTINE_EXECUTION_MODE') ?? 'wait') as
        | 'wait'
        | 'skip'
        | 'overlap',
  });
}

/**
 * Factory for JwtAuthGuard — uses Reflector directly to avoid broken tsx/esbuild
 * `design:paramtypes` metadata under bun/tsx.
 */
function createJwtAuthGuard(reflector: Reflector): JwtAuthGuard {
  return JwtAuthGuard.create(reflector);
}

/**
 * Factory for RolesGuard — uses Reflector directly to avoid broken tsx/esbuild
 * `design:paramtypes` metadata under bun/tsx.
 */
function createRolesGuard(reflector: Reflector): RolesGuard {
  return RolesGuard.create(reflector);
}

/**
 * Global module that aggregates and exports shared cross-cutting concerns
 * such as authentication guards, role-based authorization, response transformers,
 * logging, and exception filters.
 *
 * By marking this module as `@Global()`, it only needs to be imported once
 * (typically in the root `AppModule`) and its providers will be available
 * throughout the entire application.
 *
 * It also registers the guards, interceptors, and filters as global providers
 * using the `APP_*` tokens, ensuring they are automatically applied to all routes.
 */
@Global()
@Module({
  imports: [
    ConfigModule,
  ],
  providers: [
    // Guards: Applied globally in order (JWT authentication first, then Roles authorization)
    JwtAuthGuard,
    RolesGuard,
    {
      provide: APP_GUARD,
      useFactory: createJwtAuthGuard,
      inject: [Reflector],
    },
    {
      provide: APP_GUARD,
      useFactory: createRolesGuard,
      inject: [Reflector],
    },
    // Interceptors: Applied globally to all routes
    TransformInterceptor,
    LoggingInterceptor,
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    // Filters: Applied globally to all routes
    HttpExceptionFilter,
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    // Routine Service: built via factory (avoids broken tsx emitDecoratorMetadata)
    {
      provide: RoutineService,
      useFactory: createRoutineService,
      inject: [CommonConfigService],
    },
    // Register the thread‑safe configuration service so it can be injected throughout the app
    CommonConfigService,
  ],
  exports: [
    // Export the classes so they can be injected or used explicitly if needed
    JwtAuthGuard,
    RolesGuard,
    TransformInterceptor,
    LoggingInterceptor,
    HttpExceptionFilter,
    RoutineService,
    // Export the configuration service for use in other modules.
    CommonConfigService,
  ],
})
export class CommonModule {}
