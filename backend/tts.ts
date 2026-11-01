/**
 * Text-to-speech actions (shared by local dev server and Supabase Edge Function).
 *
 *   { action: "tts-voices" }                       → audition voices
 *   { action: "tts-audition", voice }              → fixed sample paragraph in that voice
 *   { action: "tts-voice-test", model, voice, sample } → a FIXED sample with one speech model, plus
 *                                                     what the listening check heard (for testers)
 *   { action: "tts-render", audioToken, chunk }    → one chunk of an APPROVED story
 *   { action: "library-voice", id, age }           → audio token for a built-in library story
 *   { action: "personal-plan", id, age }           → the parts of a personal story (which are shared)
 *   { action: "personal-render", id, age, part, name?, gender? } → one part of a personal story
 *
 * tts-render only accepts an audioToken that this backend issued when it approved a story,
 * so Aaji can never be made to say arbitrary text.
 *
 * This is GOSHTI's audio story service: app → backend → here → TTSProvider (Gemini on Vertex AI).
 * Aaji is always a prebuilt synthetic voice (see resolveAajiVoice) — no voice cloning.
 */
import { ProviderError } from '../story-engine/provider';
import { googleAccessFromEnv, hasGoogleAccess, type GoogleEnv } from '../story-engine/providers/googleAccess';
import { DEFAULT_TTS_MODEL, DEFAULT_TTS_VOICE, GeminiSpeechSynthesizer, VERTEX_TTS_FALLBACKS } from '../story-engine/providers/geminiTts';
import { GeminiSpeechListener } from '../story-engine/providers/geminiListen';
import { CheckedSpeechSynthesizer, judgeDuration, judgeTranscript, spokenText, wavSeconds } from '../story-engine/speechCheck';
import type { TtsChunk } from '../story-engine/tts';
import { AUDITION_CHUNK, AUDITION_VOICES, buildTtsChunks, DEFAULT_AAJI_STYLE } from '../story-engine/tts';
import { resolveAajiVoice, SynthesizerTTSProvider, type TTSProvider } from '../story-engine/ttsProvider';
import { findLibraryStory, libraryAudioScript } from '../story-engine/library';
import { ensureCatalog, type CatalogEnv } from './catalog';
import { cleanChildName, findPersonalStory, personalParts, type PersonalChild } from '../story-engine/personal';
import type { AudioScript } from '../story-engine/types';
import { openJson, sealJson } from './continuation';

export interface TtsEnv extends GoogleEnv, CatalogEnv {
  TTS_MODEL?: string;
  TTS_FALLBACK_MODEL?: string;
  /** Aaji's prebuilt voice (default Aoede). Must be a prebuilt voice name. */
  TTS_VOICE?: string;
  /** Override Aaji's base voice direction. */
  TTS_STYLE?: string;
  /**
   * Listening check on every rendered part (see story-engine/speechCheck.ts). On by default;
   * "off" keeps only the length check — for diagnosis, never for the children's app.
   */
  TTS_CHECK?: string;
  /** Model that listens to the audio (default gemini-3.5-flash-lite). */
  TTS_CHECK_MODEL?: string;
  STORY_STATE_SECRET?: string;
}

interface AudioTokenPayload {
  v: 1;
  title: string;
  script: AudioScript;
  /** Child's age — younger listeners get extra pauses between sentences. */
  age?: number;
}

const PURPOSE = 'audio';

/**
 * Secret for sealed tokens (story continuations, audio tokens). Set STORY_STATE_SECRET in
 * production; otherwise it's derived from whichever Google credential is configured.
 */
export function backendSecret(env: TtsEnv): string {
  return (
    env.STORY_STATE_SECRET ||
    env.GOOGLE_SERVICE_ACCOUNT_JSON ||
    env.VERTEX_API_KEY ||
    env.GEMINI_API_KEY ||
    'goshti-mock-provider'
  );
}
const secretOf = backendSecret;

export function chunksFor(script: AudioScript, env: TtsEnv, age?: number) {
  return buildTtsChunks(script, {
    baseStyle: env.TTS_STYLE || DEFAULT_AAJI_STYLE,
    sentencePauses: age !== undefined && age <= 5,
  });
}

/** Issued with every APPROVED story. */
export async function issueAudioToken(title: string, script: AudioScript, env: TtsEnv, age?: number) {
  const token = await sealJson({ v: 1, title, script, age } satisfies AudioTokenPayload, secretOf(env), PURPOSE);
  return { audioToken: token, audioChunks: chunksFor(script, env, age).length, ttsAvailable: hasGoogleAccess(env) };
}

/**
 * The TTS provider behind Aaji's voice. Swap providers here (the app is unaffected).
 * Every part is checked (length + listening) before it leaves the backend.
 */
export function createTtsProvider(env: TtsEnv, log: (line: string) => void = console.log): TTSProvider {
  const access = googleAccessFromEnv(env);
  if (!access) throw new ProviderError('NOT_CONFIGURED', 'text-to-speech is not configured (set up Vertex AI)');
  const listener = env.TTS_CHECK === 'off' ? null : new GeminiSpeechListener({ access, model: env.TTS_CHECK_MODEL });
  return new SynthesizerTTSProvider(
    new CheckedSpeechSynthesizer(
      new GeminiSpeechSynthesizer({ access, model: env.TTS_MODEL, fallbackModels: env.TTS_FALLBACK_MODEL }),
      listener,
      { log },
    ),
    env.TTS_STYLE || DEFAULT_AAJI_STYLE,
  );
}

/** Speech models a voice test may try (nothing else is accepted). */
export const VOICE_TEST_MODELS = [...new Set([DEFAULT_TTS_MODEL, ...VERTEX_TTS_FALLBACKS, 'gemini-2.5-pro-tts', 'gemini-3.1-flash-tts-preview'])];

/** The two fixed samples a voice test renders — never text from a request. */
export function voiceTestSample(name: unknown, env: TtsEnv): { name: 'audition' | 'story'; chunk: TtsChunk } {
  if (name === 'story') {
    const story = findLibraryStory('manu-red-ball');
    if (story) return { name: 'story', chunk: chunksFor(libraryAudioScript(story, 6), env, 6)[0] };
  }
  return { name: 'audition', chunk: AUDITION_CHUNK };
}

/**
 * One speech model on a fixed sample, WITHOUT the retry/fail of the listening check — so a
 * tester hears exactly what that model makes and sees what the check would decide.
 */
async function voiceTest(b: { model?: unknown; sample?: unknown }, voice: string, env: TtsEnv) {
  const model = typeof b.model === 'string' && VOICE_TEST_MODELS.includes(b.model) ? b.model : null;
  if (!model) return { status: 400, body: { status: 'INVALID_REQUEST', errors: [`model must be one of: ${VOICE_TEST_MODELS.join(', ')}`] } };
  const access = googleAccessFromEnv(env);
  if (!access) return { status: 503, body: { status: 'FAILED', reason: 'text-to-speech is not configured (set up Vertex AI)' } };
  const { name, chunk } = voiceTestSample(b.sample, env);
  const t0 = Date.now();
  const audio = await new GeminiSpeechSynthesizer({ access, model, fallbackModels: 'none' }).synthesize(chunk, voice);
  const renderMs = Date.now() - t0;
  const seconds = wavSeconds(audio.base64);
  const problems = judgeDuration(chunk, seconds);
  let transcript: string | null = null;
  let heard: { ratio: number; englishWords: number } | null = null;
  try {
    transcript = await new GeminiSpeechListener({ access, model: env.TTS_CHECK_MODEL }).transcribe(audio);
    const v = judgeTranscript(spokenText(chunk), transcript);
    problems.push(...v.problems);
    heard = { ratio: v.ratio, englishWords: v.englishWords };
  } catch (e) {
    problems.push(`could not listen: ${(e as Error).message}`);
  }
  return {
    status: 200,
    body: { voice, sample: name, ...audio, seconds, renderMs, transcript, heard, problems, wouldReachChild: problems.length === 0 },
  };
}

export function isTtsAction(body: unknown): boolean {
  const a = (body as { action?: unknown } | null)?.action;
  return (
    a === 'tts-voices' ||
    a === 'tts-audition' ||
    a === 'tts-voice-test' ||
    a === 'tts-render' ||
    a === 'library-voice' ||
    a === 'personal-plan' ||
    a === 'personal-render'
  );
}

export async function handleTts(
  body: unknown,
  env: TtsEnv,
  log?: (line: string) => void,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const b = (body ?? {}) as {
    action?: string;
    voice?: unknown;
    audioToken?: unknown;
    chunk?: unknown;
    id?: unknown;
    age?: unknown;
    model?: unknown;
    sample?: unknown;
    part?: unknown;
    name?: unknown;
    gender?: unknown;
    hash?: unknown;
  };
  const voice = resolveAajiVoice(b.voice, env.TTS_VOICE || DEFAULT_TTS_VOICE);

  if (b.action === 'library-voice') {
    // Library stories are known to the server, so only an id is accepted — never text.
    const story = typeof b.id === 'string' ? findLibraryStory(b.id) : undefined;
    if (!story) return { status: 404, body: { status: 'INVALID_REQUEST', errors: ['unknown library story'] } };
    const age = Number(b.age);
    return { status: 200, body: await issueAudioToken(story.title, libraryAudioScript(story, Number.isFinite(age) ? age : undefined), env, Number.isFinite(age) ? age : undefined) };
  }

  if (b.action === 'personal-plan' || b.action === 'personal-render') {
    // Personal stories are known to the server too: the words always come from the stored story,
    // and the only thing a request adds is a plain Devanagari name and boy/girl.
    await ensureCatalog(env, (line) => log?.(line));
    const story = typeof b.id === 'string' ? findPersonalStory(b.id) : undefined;
    if (!story) return { status: 404, body: { status: 'INVALID_REQUEST', errors: ['unknown personal story'] } };
    const age = Number.isFinite(Number(b.age)) ? Number(b.age) : undefined;
    const name = cleanChildName(b.name);
    const gender = b.gender === 'GIRL' || b.gender === 'BOY' ? b.gender : null;
    const child: PersonalChild = name && gender ? { name, gender } : { name: 'सई', gender: 'GIRL' };
    const parts = personalParts(story, child, age, env.TTS_STYLE || DEFAULT_AAJI_STYLE);
    if (b.action === 'personal-plan') {
      return { status: 200, body: { id: story.id, parts: parts.map((p) => ({ index: p.index, personal: p.personal, hash: p.hash })) } };
    }
    const index = Number(b.part);
    if (!Number.isInteger(index) || index < 0 || index >= parts.length) {
      return { status: 400, body: { status: 'INVALID_REQUEST', errors: [`part must be 0–${parts.length - 1}`] } };
    }
    const part = parts[index];
    // The app and the server must agree on the words of this part (they may be on different versions).
    if (typeof b.hash === 'string' && b.hash !== part.hash) {
      return { status: 409, body: { status: 'INVALID_REQUEST', errors: ['this story has changed; update the app'] } };
    }
    if (part.personal && !(name && gender)) {
      return { status: 400, body: { status: 'INVALID_REQUEST', errors: ['this part needs a name (in Devanagari) and gender BOY or GIRL'] } };
    }
    if (!hasGoogleAccess(env)) {
      return { status: 503, body: { status: 'FAILED', reason: 'text-to-speech is not configured (set up Vertex AI)' } };
    }
    try {
      const t0 = Date.now();
      const audio = await createTtsProvider(env, log).synthesizeScene(part.chunk, voice);
      return {
        status: 200,
        body: {
          part: index,
          totalParts: parts.length,
          personal: part.personal,
          hash: part.hash,
          voice,
          ...audio,
          pauseAfterMs: part.chunk.pauseAfterMs,
          cues: part.chunk.cues,
          cueAt: part.chunk.cueAt,
          ms: Date.now() - t0,
        },
      };
    } catch (e) {
      const reason = e instanceof ProviderError ? `${e.code}: ${e.message}` : (e as Error).message;
      return { status: 503, body: { status: 'FAILED', reason } };
    }
  }

  if (b.action === 'tts-voices') {
    return { status: 200, body: { voices: AUDITION_VOICES, current: env.TTS_VOICE || DEFAULT_TTS_VOICE } };
  }
  if (!hasGoogleAccess(env)) {
    return { status: 503, body: { status: 'FAILED', reason: 'text-to-speech is not configured (set up Vertex AI)' } };
  }

  try {
    const tts = createTtsProvider(env, log);
    if (b.action === 'tts-voice-test') return await voiceTest(b, voice, env);
    if (b.action === 'tts-audition') {
      const t0 = Date.now();
      const audio = await tts.synthesizeScene(AUDITION_CHUNK, voice);
      return { status: 200, body: { voice, ...audio, ms: Date.now() - t0 } };
    }

    // tts-render
    const payload = await openJson<AudioTokenPayload>(b.audioToken, secretOf(env), PURPOSE);
    if (!payload || payload.v !== 1) return { status: 400, body: { status: 'INVALID_REQUEST', errors: ['invalid audioToken'] } };
    const chunks = chunksFor(payload.script, env, payload.age);
    const index = Number(b.chunk);
    if (!Number.isInteger(index) || index < 0 || index >= chunks.length) {
      return { status: 400, body: { status: 'INVALID_REQUEST', errors: [`chunk must be 0–${chunks.length - 1}`] } };
    }
    const chunk = chunks[index];
    const t0 = Date.now();
    const audio = await tts.synthesizeScene(chunk, voice);
    return {
      status: 200,
      body: {
        chunk: index,
        totalChunks: chunks.length,
        voice,
        ...audio,
        pauseAfterMs: chunk.pauseAfterMs,
        cues: chunk.cues,
        cueAt: chunk.cueAt,
        ms: Date.now() - t0,
      },
    };
  } catch (e) {
    const reason = e instanceof ProviderError ? `${e.code}: ${e.message}` : (e as Error).message;
    return { status: 503, body: { status: 'FAILED', reason } };
  }
}
