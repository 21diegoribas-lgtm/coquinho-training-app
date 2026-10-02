/**
 * Browser Narration Audio Provider (TASK TTS-A3a).
 * 
 * Provides a concrete NarrationAudioProvider implementation that requests Vietnamese speech
 * audio from the server TTS endpoint (/api/tts), decodes the audio bytes into AudioBuffers
 * via Web Audio API, and maintains an in-memory cache for repeated coaching cues.
 * 
 * Strict constraints (TTS-A3a):
 * - Does not modify video export integration
 * - Does not touch MediaRecorder
 * - Does not change TTS-A1 narration scripts or TTS-A2 scheduling/mixing
 * - Does not expose API keys or secrets to the browser
 * - Graceful fallback (returns null) on server errors, missing config, or aborted requests
 */

import { CoachingNarrationItem, NarrationAudioProvider } from './coachingNarration';

export const DEFAULT_TTS_LANGUAGE = 'vi-VN';
export const DEFAULT_TTS_VOICE = 'vi-VN-Standard-A';
export const MAX_TTS_TEXT_LENGTH = 300;
export const DEFAULT_TTS_ENDPOINT = '/api/tts';

export interface BrowserNarrationAudioProviderOptions {
  /**
   * Endpoint URL for TTS requests. Defaults to '/api/tts'
   */
  endpoint?: string;
  /**
   * Spoken language code. Defaults to 'vi-VN'
   */
  language?: string;
  /**
   * Spoken voice identifier. Defaults to neutral Vietnamese 'vi-VN-Standard-A'
   */
  voice?: string;
  /**
   * AudioContext instance used to decode audio data.
   * If not provided, the provider will attempt to use/create one from window/globalThis.
   */
  audioContext?: AudioContext;
  /**
   * Maximum allowed text character length. Defaults to 300.
   */
  maxTextLength?: number;
  /**
   * Whether to enable in-memory audio caching. Defaults to true.
   */
  enableCache?: boolean;
  /**
   * Custom fetch function (useful for tests and dependency injection).
   */
  fetchFn?: typeof fetch;
}

// In-memory cache for decoded AudioBuffers
const audioCache = new Map<string, AudioBuffer>();
const inFlightRequests = new Map<string, Promise<AudioBuffer | null>>();

/**
 * Clears the in-memory narration audio cache.
 */
export function clearNarrationAudioCache(): void {
  audioCache.clear();
  inFlightRequests.clear();
}

/**
 * Returns the number of cached AudioBuffer items.
 */
export function getNarrationAudioCacheSize(): number {
  return audioCache.size;
}

/**
 * Normalizes text and options to produce a deterministic cache key.
 */
export function getNormalizedCacheKey(text: string, language: string, voice?: string): string {
  const normText = text.trim().toLowerCase().replace(/\s+/g, ' ');
  return `${language.toLowerCase()}:${(voice || 'default').toLowerCase()}:${normText}`;
}

/**
 * Decodes audio bytes into AudioBuffer using AudioContext.decodeAudioData safely.
 */
async function decodeAudioDataSafely(context: AudioContext, arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
  const bufferCopy = arrayBuffer.slice(0);
  return new Promise((resolve, reject) => {
    let settled = false;
    try {
      const maybePromise = context.decodeAudioData(
        bufferCopy,
        (decoded) => {
          if (!settled) {
            settled = true;
            resolve(decoded);
          }
        },
        (err) => {
          if (!settled) {
            settled = true;
            reject(err);
          }
        }
      );
      if (maybePromise && typeof (maybePromise as any).then === 'function') {
        (maybePromise as any).then(
          (decoded: AudioBuffer) => {
            if (!settled) {
              settled = true;
              resolve(decoded);
            }
          },
          (err: any) => {
            if (!settled) {
              settled = true;
              reject(err);
            }
          }
        );
      }
    } catch (err) {
      reject(err);
    }
  });
}

function resolveAudioContext(explicitContext?: AudioContext): AudioContext | null {
  if (explicitContext) return explicitContext;
  const globalObj: any = typeof window !== 'undefined'
    ? window
    : (typeof globalThis !== 'undefined' ? globalThis : undefined);
  if (!globalObj) return null;
  const AudioCtxClass = globalObj.AudioContext || globalObj.webkitAudioContext;
  if (typeof AudioCtxClass !== 'function') return null;
  try {
    return new AudioCtxClass();
  } catch {
    return null;
  }
}

/**
 * Factory function creating a concrete browser narration audio provider (TASK TTS-A3a).
 * 
 * Fetches speech audio bytes from the server-side /api/tts endpoint, decodes them
 * into AudioBuffers using the browser's AudioContext, and provides automatic caching
 * and error isolation for TTS-A2 timeline scheduling.
 */
export function createBrowserNarrationAudioProvider(
  options: BrowserNarrationAudioProviderOptions = {}
): NarrationAudioProvider {
  const endpoint = options.endpoint || DEFAULT_TTS_ENDPOINT;
  const language = options.language || DEFAULT_TTS_LANGUAGE;
  const voice = options.voice || DEFAULT_TTS_VOICE;
  const maxTextLength = options.maxTextLength || MAX_TTS_TEXT_LENGTH;
  const enableCache = options.enableCache !== false;
  const fetchImpl = options.fetchFn || (typeof fetch !== 'undefined' ? fetch : undefined);

  return async (
    item: CoachingNarrationItem,
    signal?: AbortSignal
  ): Promise<AudioBuffer | null> => {
    // 1. Check early abort
    if (signal?.aborted) {
      return null;
    }

    const rawText = item?.text || '';
    const trimmed = rawText.trim();
    if (!trimmed) {
      return null;
    }

    // 2. Length safety clamp (truncate if longer than maxTextLength)
    const safeText = trimmed.length > maxTextLength ? trimmed.slice(0, maxTextLength) : trimmed;

    const cacheKey = getNormalizedCacheKey(safeText, language, voice);

    // 3. Check in-memory cache
    if (enableCache && audioCache.has(cacheKey)) {
      return audioCache.get(cacheKey) || null;
    }

    // 4. In-flight request deduplication
    if (enableCache && inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey)!;
    }

    const loadPromise = (async (): Promise<AudioBuffer | null> => {
      try {
        if (!fetchImpl) {
          console.warn('[narrationAudioProvider] Fetch is not available in current environment');
          return null;
        }

        const response = await fetchImpl(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: safeText,
            language,
            voice,
          }),
          signal,
        });

        if (!response.ok) {
          // 4xx or 5xx handled cleanly without throwing
          return null;
        }

        const contentType = response.headers?.get?.('content-type') || '';
        // If server returned JSON error instead of audio stream
        if (contentType.includes('application/json')) {
          return null;
        }

        const arrayBuffer = await response.arrayBuffer();
        if (!arrayBuffer || arrayBuffer.byteLength === 0) {
          return null;
        }

        // Obtain audio context for decoding
        const context = resolveAudioContext(options.audioContext);
        if (!context) {
          console.warn('[narrationAudioProvider] AudioContext is not available for decoding');
          return null;
        }

        const audioBuffer = await decodeAudioDataSafely(context, arrayBuffer);
        if (audioBuffer && enableCache) {
          audioCache.set(cacheKey, audioBuffer);
        }
        return audioBuffer;
      } catch (err: any) {
        // Abort or network failure handled cleanly without app crash
        if (signal?.aborted || err?.name === 'AbortError') {
          return null;
        }
        return null;
      } finally {
        inFlightRequests.delete(cacheKey);
      }
    })();

    if (enableCache) {
      inFlightRequests.set(cacheKey, loadPromise);
    }

    return loadPromise;
  };
}
