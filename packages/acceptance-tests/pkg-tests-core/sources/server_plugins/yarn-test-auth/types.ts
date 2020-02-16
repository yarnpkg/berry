import {Config} from '@verdaccio/types';

export interface YarnAuthMemoryConfig extends Config {
  allowed: string[];
}
