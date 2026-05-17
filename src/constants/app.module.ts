import { Module, Global } from '@nestjs/common';
import { APP_CONSTANTS, appConstants } from './app.constants';

/**
 * Global module that provides application-wide constants
 * such as memory stores and configuration objects.
 *
 * Marked as @Global() so it only needs to be imported once
 * (typically in AppModule) and will be available throughout the app.
 */
@Global()
@Module({
  providers: [
    {
      provide: APP_CONSTANTS,
      useValue: appConstants,
    },
  ],
  exports: [APP_CONSTANTS],
})
export class AppConstantsModule {}
