import { env } from 'cloudflare:workers';

export function runtimeEnv() {
  return env;
}
