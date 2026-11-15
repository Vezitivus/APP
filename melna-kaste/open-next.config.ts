import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// No R2 incremental cache: game state lives in Postgres, and the free deploy
// should not provision extra Cloudflare resources.
export default defineCloudflareConfig();
