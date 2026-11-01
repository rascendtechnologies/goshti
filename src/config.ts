import { Platform } from 'react-native';

/**
 * Public app configuration (inlined by Expo from EXPO_PUBLIC_* variables in .env).
 * Only PUBLIC values live here — the Gemini key is never available to the app.
 */
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const explicitStoryApi = process.env.EXPO_PUBLIC_STORY_API_URL?.trim() || '';

export type StoryBackendConfig =
  | { kind: 'mock' }
  | { kind: 'http'; url: string; headers: Record<string, string> };

function resolveStoryBackend(): StoryBackendConfig {
  if (explicitStoryApi === 'mock') return { kind: 'mock' };
  if (explicitStoryApi) {
    const isSupabase = supabaseUrl && explicitStoryApi.startsWith(supabaseUrl);
    return {
      kind: 'http',
      url: explicitStoryApi,
      headers: isSupabase && supabaseAnonKey ? { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` } : {},
    };
  }
  if (supabaseUrl && supabaseAnonKey) {
    return {
      kind: 'http',
      url: `${supabaseUrl}/functions/v1/generate-story`,
      headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` },
    };
  }
  return { kind: 'mock' };
}

/** Public RevenueCat SDK keys (appl_… / goog_…). Safe to ship; never put a secret key here. */
const revenueCatKey =
  (Platform.OS === 'ios' ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY)?.trim() || '';

export const config = {
  /** Supabase project (public values) — the story catalogue is read from here. */
  supabaseUrl,
  supabaseAnonKey,
  /** Public RevenueCat key for this platform; empty = purchases off (Expo Go, test builds). */
  revenueCatKey,
  /** Where the parent reads the terms and privacy policy (shown beside the purchase buttons). */
  privacyUrl: process.env.EXPO_PUBLIC_PRIVACY_URL?.trim() || '',
  termsUrl: process.env.EXPO_PUBLIC_TERMS_URL?.trim() || '',
  /** Where parents write about a story or a problem. */
  supportEmail: process.env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim() || 'support.rascend@gmail.com',
  storyBackend: resolveStoryBackend(),
  /** Public Supabase Storage folder with the library stories' Aaji voice, made once (see the Pre-render workflow). */
  libraryVoiceBase: supabaseUrl ? `${supabaseUrl}/storage/v1/object/public/library-voice` : '',
  /** Whole story across all backend steps (real Gemini stories can take a few minutes). */
  storyRequestTimeoutMs: 400_000,
  /**
   * Prepare the next random story in the background so it plays instantly.
   * Costs extra AI calls (on Gemini's free tier the daily quota is small) —
   * set EXPO_PUBLIC_PREFETCH_STORIES=false to turn off.
   */
  prefetchRandomStories: process.env.EXPO_PUBLIC_PREFETCH_STORIES !== 'false',
  /**
   * Plan a fresh install starts on. Test builds use PLUS (30 a month) so testers don't hit the
   * FREE limit of 5; the store build uses FREE. Set by eas.json (EXPO_PUBLIC_DEFAULT_PLAN).
   */
  defaultPlan: (process.env.EXPO_PUBLIC_DEFAULT_PLAN === 'PLUS' ? 'PLUS' : 'FREE') as 'FREE' | 'PLUS',
  /**
   * Tester tools (reset this month's count, switch plan, technical error reasons): in development,
   * and in the test versions published to the phone (EXPO_PUBLIC_TEST_TOOLS=true). Never in a
   * store build.
   */
  testTools: __DEV__ || process.env.EXPO_PUBLIC_TEST_TOOLS === 'true',
  /**
   * Plans, prices and upgrade buttons in Parent mode. OFF in store builds until real purchases
   * (RevenueCat) exist — the stores reject buttons that cannot buy anything. On in test versions.
   */
  showPlans: process.env.EXPO_PUBLIC_SHOW_PLANS === 'true' || __DEV__ || process.env.EXPO_PUBLIC_TEST_TOOLS === 'true',
};
