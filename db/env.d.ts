declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    AUTH0_DOMAIN?: string;
    AUTH0_CLIENT_ID?: string;
    AUTH0_AUDIENCE?: string;
    INITIAL_OWNER_EMAIL?: string;
  }
}
