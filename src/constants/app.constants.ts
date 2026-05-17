import { MemoryKeyStore } from '../common/utils/memory-key-store.util';

export const APP_CONSTANTS = 'APP_CONSTANTS';

export interface AppConstants {
  appName: string;
  scrapedContentStore: MemoryKeyStore;
}

export const appConstants: AppConstants = {
  // app
  appName: 'apollo',

  // memory key store
  scrapedContentStore: new MemoryKeyStore(),
};
