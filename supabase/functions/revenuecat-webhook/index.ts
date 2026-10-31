// RevenueCat → GOSHTI: keeps "who has Plus, and until when" (see backend/entitlements.ts).
// Bundled by `npm run build:function`. Switched on by setting the secret:
//   npx supabase secrets set REVENUECAT_WEBHOOK_SECRET=<a long random string>
// then in RevenueCat → Integrations → Webhooks: URL = this function's URL,
// Authorization header = the same string. SUPABASE_* are provided by Supabase; STORY_STATE_SECRET
// is the one already set for the story backend.
import { handleRevenueCatWebhook, SupabaseEntitlementStore } from './_bundle/entitlements.mjs';

Deno.serve(async (req: Request) => {
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  if (req.method !== 'POST') return json(405, { ok: false });

  const env = {
    SUPABASE_URL: Deno.env.get('SUPABASE_URL') ?? undefined,
    SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? undefined,
    STORY_STATE_SECRET: Deno.env.get('STORY_STATE_SECRET') ?? undefined,
    REVENUECAT_WEBHOOK_SECRET: Deno.env.get('REVENUECAT_WEBHOOK_SECRET') ?? undefined,
  };
  const store =
    env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
      ? new SupabaseEntitlementStore(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
      : null;
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    // an unreadable body is refused below
  }
  const result = await handleRevenueCatWebhook(body, req.headers.get('authorization'), env, store);
  return json(result.status, result.body);
});
