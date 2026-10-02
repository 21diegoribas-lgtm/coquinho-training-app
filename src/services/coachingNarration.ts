/**
 * Coaching Narration Service (TASK TTS-A1).
 * 
 * Provides deterministic data models and pure timing helpers for future coaching audio narration.
 * Converts semantic tactical coaching moments into concise Vietnamese spoken cues and maps
 * them into non-overlapping presentation-time slots during the coaching hold phase.
 * 
 * Strict constraints (TTS-A1):
 * - No real audio generation yet (no SpeechSynthesis, no AudioContext)
 * - Deterministic local rules only (no external AI calls)
 * - Preserves existing FIX-A coaching presentation durations
 * - Synchronizes with hold phase (starts after enter transition, completes before exit)
 */

import {
  COACHING_ENTER_DURATION,
  COACHING_EXIT_DURATION,
  getEffectiveCoachingDuration,
} from './structuredDiagram';
import {
  DiagramAnimation,
  DiagramCoachingMoment,
} from '../types/session';
import {
  buildNarrationTimeline,
  getExportCoachingMoments,
} from './diagramVideoExport';

/**
 * Standard narration item data model (TASK TTS-A1).
 */
export interface CoachingNarrationItem {
  id: string;
  coachingMomentId: string;
  startPresentationTime: number;
  maxDuration: number;
  text: string;
  estimatedSpeechDuration: number;
  title?: string;
  playerId?: string;
  event?: string;
}

export interface CoachingNarrationOptions {
  wordsPerMinute?: number;
  customScripts?: Record<string, string>;
}

/**
 * Vietnamese coaching speech rate calibration.
 * Vietnamese words in written form are individual monosyllables.
 * Energetic, clear sports coaching cues typically pace at ~220–240 monosyllables per minute (~3.8–4.0 words/sec).
 */
export const DEFAULT_VIETNAMESE_COACHING_WPM = 240;

/**
 * Canonical Vietnamese script mapping for standard tactical coaching moments.
 */
export const CANONICAL_COACHING_SCRIPTS: Record<string, string> = {
  'kiểm tra vai': 'Kiểm tra vai trước khi bóng đến.',
  'mở thân người': 'Mở thân người về hướng chơi tiếp theo.',
  'chạm bước một': 'Chạm bước một đưa bóng vào khoảng trống.',
  'chuẩn bị đón bóng': 'Chuẩn bị đón bóng chính xác từ đồng đội.',
  'tiếp bóng an toàn': 'Tiếp bóng an toàn bằng lòng bàn chân.',
  'chuyền trả bóng': 'Chuyền trả bóng chính xác cho đồng đội.',
  'quan sát': 'Quan sát không gian xung quanh trước khi hành động.',
  'áp sát': 'Chủ động áp sát gây áp lực nhanh chóng.',
  'chạy chỗ': 'Chạy chỗ đón bóng vào không gian mở.',
  'dứt điểm': 'Dứt điểm quyết đoán về phía khung thành.',
};

/**
 * Canonical shortened scripts when timing slot is constrained.
 */
export const CANONICAL_SHORT_SCRIPTS: Record<string, string> = {
  'kiểm tra vai trước khi bóng đến.': 'Kiểm tra vai trước bóng.',
  'mở thân người về hướng chơi tiếp theo.': 'Mở thân người hướng chơi tiếp.',
  'mở thân người để hướng về phía chơi tiếp theo.': 'Mở thân người hướng chơi tiếp.',
  'chạm bước một đưa bóng vào khoảng trống.': 'Chạm bước một vào khoảng trống.',
  'chạm bước một đưa bóng vào không gian thuận lợi.': 'Chạm bước một vào khoảng trống.',
  'chuẩn bị đón bóng chính xác từ đồng đội.': 'Chuẩn bị đón bóng.',
  'tiếp bóng an toàn bằng lòng bàn chân.': 'Tiếp bóng an toàn.',
  'chuyền trả bóng chính xác cho đồng đội.': 'Chuyền trả bóng.',
};

export interface NarrationMomentInput {
  title?: string;
  text?: string;
  event?: string;
}

/**
 * Pure helper for generating concise Vietnamese narration script from a coaching moment (TASK TTS-A1).
 * Uses deterministic dictionary and pattern matching. Does not call an AI model.
 */
export function generateNarrationScript(
  moment: NarrationMomentInput
): string {
  const title = (moment.title || '').trim();
  const titleLower = title.toLowerCase();

  // 1. Direct canonical dictionary match
  if (CANONICAL_COACHING_SCRIPTS[titleLower]) {
    return CANONICAL_COACHING_SCRIPTS[titleLower];
  }

  // 2. Pattern matching on title
  if (/kiểm tra vai|check shoulder|scan/i.test(titleLower)) {
    return 'Kiểm tra vai trước khi bóng đến.';
  }
  if (/mở thân|open body|tư thế mở/i.test(titleLower)) {
    return 'Mở thân người về hướng chơi tiếp theo.';
  }
  if (/chạm bước một|first touch|bước một/i.test(titleLower)) {
    return 'Chạm bước một đưa bóng vào khoảng trống.';
  }
  if (/chuẩn bị đón bóng|chuẩn bị/i.test(titleLower)) {
    return 'Chuẩn bị đón bóng chính xác từ đồng đội.';
  }
  if (/tiếp bóng|khống chế/i.test(titleLower)) {
    return 'Tiếp bóng an toàn bằng lòng bàn chân.';
  }
  if (/chuyền trả|trả bóng/i.test(titleLower)) {
    return 'Chuyền trả bóng chính xác cho đồng đội.';
  }
  if (/dứt điểm|sút bóng/i.test(titleLower)) {
    return 'Dứt điểm quyết đoán về phía khung thành.';
  }
  if (/áp sát|cướp bóng|đoạt bóng/i.test(titleLower)) {
    return 'Chủ động áp sát gây áp lực nhanh chóng.';
  }
  if (/chạy chỗ|thoát kèm/i.test(titleLower)) {
    return 'Chạy chỗ đón bóng vào không gian mở.';
  }

  // 3. Fallback based on event name
  if (moment.event === 'preReceive') {
    return 'Kiểm tra vai trước khi bóng đến.';
  }
  if (moment.event === 'receive') {
    return 'Mở thân người về hướng chơi tiếp theo.';
  }
  if (moment.event === 'firstTouch') {
    return 'Chạm bước một đưa bóng vào khoảng trống.';
  }

  // 4. Derive concise first sentence from moment.text if present
  if (moment.text && typeof moment.text === 'string') {
    const cleanText = moment.text.trim();
    const firstClause = cleanText.split(/[.?!]/)[0]?.trim();
    if (firstClause && firstClause.length > 5 && firstClause.length <= 60) {
      return firstClause.endsWith('.') ? firstClause : `${firstClause}.`;
    }
  }

  // 5. Fallback from title
  if (title) {
    return title.endsWith('.') ? title : `${title}.`;
  }

  return 'Thực hiện kỹ thuật chính xác.';
}

/**
 * Pure helper for estimating spoken audio duration for a text string (TASK TTS-A1).
 * Calculates based on words (monosyllables) and slight punctuation pauses.
 */
export function estimateSpeechDuration(
  text: string,
  wordsPerMinute: number = DEFAULT_VIETNAMESE_COACHING_WPM
): number {
  if (!text || typeof text !== 'string') return 0;
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;

  const wpm = wordsPerMinute > 0 ? wordsPerMinute : DEFAULT_VIETNAMESE_COACHING_WPM;
  const baseSeconds = (words.length / wpm) * 60;

  const punctuationMatches = text.match(/[,;:.!?]/g);
  const pauseSeconds = punctuationMatches ? punctuationMatches.length * 0.05 : 0;

  const total = baseSeconds + pauseSeconds;
  return Math.round(total * 100) / 100;
}

/**
 * Pure helper to shorten narration text if too long to fit into a time slot (TASK TTS-A1).
 */
export function shortenNarrationText(
  text: string,
  maxDuration: number,
  wordsPerMinute: number = DEFAULT_VIETNAMESE_COACHING_WPM
): string {
  if (!text || typeof text !== 'string') return '';
  const currentDuration = estimateSpeechDuration(text, wordsPerMinute);
  if (currentDuration <= maxDuration) {
    return text;
  }

  const clean = text.trim();

  // 1. Check canonical shortened scripts
  const canonicalShort = CANONICAL_SHORT_SCRIPTS[clean.toLowerCase()];
  if (canonicalShort && estimateSpeechDuration(canonicalShort, wordsPerMinute) <= maxDuration) {
    return canonicalShort;
  }

  // 2. Try splitting on subordinate conjunctions (để, trước khi, giúp, nhằm)
  const conjunctionSplit = clean.split(/\s+(?:để|trước khi|giúp|nhằm)\s+/i);
  if (conjunctionSplit.length > 1) {
    const mainClause = conjunctionSplit[0].trim();
    const candidate = mainClause.endsWith('.') ? mainClause : `${mainClause}.`;
    if (estimateSpeechDuration(candidate, wordsPerMinute) <= maxDuration) {
      return candidate;
    }
  }

  // 3. Progressive word truncation to fit maxDuration
  const words = clean.replace(/[.?!]+$/, '').split(/\s+/).filter(Boolean);
  while (words.length > 2) {
    words.pop();
    const candidate = `${words.join(' ')}.`;
    if (estimateSpeechDuration(candidate, wordsPerMinute) <= maxDuration) {
      return candidate;
    }
  }

  return `${words.join(' ')}.`;
}

/**
 * Pure helper that fits narration text into a timing slot (TASK TTS-A1).
 * Returns original text if it fits, otherwise applies deterministic shortening.
 */
export function fitNarrationToSlot(
  text: string,
  maxDuration: number,
  wordsPerMinute: number = DEFAULT_VIETNAMESE_COACHING_WPM
): string {
  if (!text) return '';
  const est = estimateSpeechDuration(text, wordsPerMinute);
  if (est <= maxDuration) {
    return text;
  }
  return shortenNarrationText(text, maxDuration, wordsPerMinute);
}

/**
 * Pure helper to sort narration items strictly by presentation time (TASK TTS-A1).
 */
export function sortNarrationChronologically(
  items: CoachingNarrationItem[]
): CoachingNarrationItem[] {
  return [...items].sort((a, b) => {
    if (a.startPresentationTime !== b.startPresentationTime) {
      return a.startPresentationTime - b.startPresentationTime;
    }
    return a.id.localeCompare(b.id);
  });
}

/**
 * Pure helper to prevent overlaps between adjacent narration slots (TASK TTS-A1).
 * Clamps maxDuration if necessary and re-fits text so that each item completes before the next begins.
 */
export function preventNarrationOverlap(
  items: CoachingNarrationItem[],
  wordsPerMinute: number = DEFAULT_VIETNAMESE_COACHING_WPM
): CoachingNarrationItem[] {
  if (items.length <= 1) return items;

  const sorted = sortNarrationChronologically(items);
  const result: CoachingNarrationItem[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const current = { ...sorted[i] };
    const next = sorted[i + 1];

    if (next) {
      const availableWindow = Math.round((next.startPresentationTime - current.startPresentationTime) * 100) / 100;
      if (current.maxDuration > availableWindow) {
        current.maxDuration = Math.max(0.5, availableWindow);
      }
    }

    // Ensure text fits inside current.maxDuration
    current.text = fitNarrationToSlot(current.text, current.maxDuration, wordsPerMinute);
    current.estimatedSpeechDuration = estimateSpeechDuration(current.text, wordsPerMinute);

    result.push(current);
  }

  return result;
}

/**
 * Builds deterministic coaching narration timeline from diagram animation (TASK TTS-A1).
 * - Extracts moments following sequence or chronological order
 * - Positions each cue during the coaching hold phase (currentPresCursor + COACHING_ENTER_DURATION)
 * - Restricts maxDuration to the hold window (effectiveDuration - enterDelay - exitDelay)
 * - Generates concise Vietnamese coaching cue
 * - Guarantees non-overlapping and chronologically ordered narration items
 */
export function buildCoachingNarrationTimeline(
  animation: DiagramAnimation | null | undefined,
  options: CoachingNarrationOptions = {}
): CoachingNarrationItem[] {
  if (!animation) return [];
  const exportMoments = getExportCoachingMoments(animation);
  if (exportMoments.length === 0) return [];

  const wpm = options.wordsPerMinute || DEFAULT_VIETNAMESE_COACHING_WPM;
  const items: CoachingNarrationItem[] = [];
  let currentPresCursor = 0;
  let prevDrillTime = 0;

  for (let i = 0; i < exportMoments.length; i++) {
    const m = exportMoments[i];
    const drillRun = Math.max(0, m.time - prevDrillTime);
    currentPresCursor += drillRun;
    prevDrillTime = m.time;

    const effectiveDuration = getEffectiveCoachingDuration(m);
    const enterDelay = COACHING_ENTER_DURATION;
    const exitDelay = COACHING_EXIT_DURATION;

    // Hold phase starts right after camera enter transition completes (~0.7s)
    const startPresentationTime = Math.round((currentPresCursor + enterDelay) * 100) / 100;

    // Maximum narration duration is bounded by the hold phase window
    const maxDuration = Math.max(0.5, Math.round((effectiveDuration - enterDelay - exitDelay) * 100) / 100);

    // Generate script (custom or canonical Vietnamese pattern)
    const rawScript = options.customScripts?.[m.id] || generateNarrationScript(m);
    const fittedText = fitNarrationToSlot(rawScript, maxDuration, wpm);
    const estimatedSpeechDuration = estimateSpeechDuration(fittedText, wpm);

    items.push({
      id: `narr-${m.id || i + 1}`,
      coachingMomentId: m.id,
      startPresentationTime,
      maxDuration,
      text: fittedText,
      estimatedSpeechDuration,
      title: m.title,
      playerId: m.playerId,
      event: m.event,
    });

    currentPresCursor += effectiveDuration;
  }

  const sorted = sortNarrationChronologically(items);
  return preventNarrationOverlap(sorted, wpm);
}

// =============================================================================
// TASK TTS-A2: Browser Audio Track Generation for Coaching Narration Items
// =============================================================================

/**
 * Default normalized volume for coaching voice narration.
 */
export const DEFAULT_NARRATION_VOLUME = 0.9;

/**
 * Injectable asynchronous audio clip provider interface (TASK TTS-A2).
 * Allows TTS-A3 to inject real speech synthesis or decoded audio buffers later.
 */
export type NarrationAudioProvider = (
  item: CoachingNarrationItem,
  signal?: AbortSignal
) => Promise<AudioBuffer | null>;

/**
 * Configuration options for preparing narration audio track.
 */
export interface PrepareNarrationAudioTrackOptions {
  items: CoachingNarrationItem[];
  audioProvider: NarrationAudioProvider;
  totalPresentationDuration?: number;
  signal?: AbortSignal;
  audioContext?: AudioContext;
  volume?: number;
  presentationStartOffset?: number;
  closeContextOnCleanup?: boolean;
}

/**
 * Safe controller exposing one audio MediaStreamTrack and lifecycle hooks (TASK TTS-A2).
 */
export interface NarrationAudioController {
  audioTrack: MediaStreamTrack | null;
  stream: MediaStream | null;
  context: AudioContext | null;
  cancel: () => void;
  cleanup: () => void;
  scheduledClipsCount: number;
}

/**
 * Safely inspects browser capabilities for Web Audio MediaStream destination (TASK TTS-A2).
 */
export function isNarrationAudioSupported(): boolean {
  try {
    const globalObj: any = typeof window !== 'undefined'
      ? window
      : (typeof globalThis !== 'undefined' ? globalThis : undefined);
    if (!globalObj) return false;

    const AudioContextClass = globalObj.AudioContext || globalObj.webkitAudioContext;
    if (typeof AudioContextClass !== 'function') return false;

    const hasMediaStreamDest =
      typeof AudioContextClass.prototype?.createMediaStreamDestination === 'function' ||
      typeof globalObj.MediaStreamAudioDestinationNode !== 'undefined';

    return Boolean(hasMediaStreamDest);
  } catch {
    return false;
  }
}

/**
 * Schedules narration AudioBuffers on the presentation timeline and exposes
 * ONE MediaStreamTrack for downstream video export (TASK TTS-A2).
 */
export async function prepareNarrationAudioTrack(
  options: PrepareNarrationAudioTrackOptions
): Promise<NarrationAudioController> {
  const {
    items = [],
    audioProvider,
    signal,
    audioContext: externalContext,
    volume = DEFAULT_NARRATION_VOLUME,
    presentationStartOffset = 0,
  } = options;

  let isCancelled = false;
  let isCleanedUp = false;
  let context: AudioContext | null = null;
  let ownsContext = false;
  let destNode: MediaStreamAudioDestinationNode | null = null;
  let gainNode: GainNode | null = null;
  let stream: MediaStream | null = null;
  let audioTrack: MediaStreamTrack | null = null;
  const activeSources = new Set<AudioBufferSourceNode>();
  let scheduledClipsCount = 0;

  const internalAbortController = new AbortController();

  const cancel = () => {
    if (isCancelled) return;
    isCancelled = true;
    internalAbortController.abort();
    if (signal) {
      signal.removeEventListener('abort', onParentAbort);
    }

    // Stop all active sources
    for (const source of Array.from(activeSources)) {
      try {
        source.stop(0);
      } catch {}
      try {
        source.disconnect();
      } catch {}
    }
    activeSources.clear();

    // Disconnect gain node
    if (gainNode) {
      try {
        gainNode.disconnect();
      } catch {}
    }

    // Stop output tracks
    if (audioTrack && typeof audioTrack.stop === 'function') {
      try {
        audioTrack.stop();
      } catch {}
    }
    if (stream && typeof stream.getTracks === 'function') {
      try {
        stream.getTracks().forEach((track) => {
          if (typeof track.stop === 'function') {
            try { track.stop(); } catch {}
          }
        });
      } catch {}
    }
  };

  const cleanup = () => {
    if (isCleanedUp) return;
    isCleanedUp = true;
    cancel();

    const shouldClose = options.closeContextOnCleanup !== undefined
      ? options.closeContextOnCleanup
      : ownsContext;

    if (shouldClose && context && context.state !== 'closed' && typeof context.close === 'function') {
      try {
        context.close().catch(() => {});
      } catch {}
    }
  };

  const onParentAbort = () => {
    cancel();
  };
  if (signal) {
    signal.addEventListener('abort', onParentAbort, { once: true });
  }

  const noOpController: NarrationAudioController = {
    audioTrack: null,
    stream: null,
    context: null,
    cancel,
    cleanup,
    scheduledClipsCount: 0,
  };

  // 1. Guard against pre-aborted signal or empty items
  if (signal?.aborted || !items || items.length === 0) {
    return noOpController;
  }

  // 2. Browser capability check (unless caller provides an existing AudioContext)
  if (!externalContext && !isNarrationAudioSupported()) {
    return noOpController;
  }

  // 3. Sort items strictly chronologically
  const sortedItems = sortNarrationChronologically(items);

  // 4. Fetch audio buffers via injectable provider
  type LoadedClip = { item: CoachingNarrationItem; buffer: AudioBuffer };
  const clipPromises = sortedItems.map(async (item): Promise<LoadedClip | null> => {
    if (internalAbortController.signal.aborted || isCancelled) return null;
    try {
      const buffer = await audioProvider(item, internalAbortController.signal);
      if (!buffer || typeof buffer.duration !== 'number' || buffer.duration <= 0) {
        return null;
      }
      return { item, buffer };
    } catch {
      // Partial failure tolerance: if one item fails, other valid clips may still be used
      return null;
    }
  });

  const loadedResults = await Promise.all(clipPromises);

  // If cancelled while fetching
  if (isCancelled || signal?.aborted || internalAbortController.signal.aborted) {
    return noOpController;
  }

  const validClips: LoadedClip[] = [];
  for (const res of loadedResults) {
    if (res && res.buffer) {
      validClips.push(res);
    }
  }

  // 5. If all clips failed or returned null, return clean no-audio controller
  if (validClips.length === 0) {
    return noOpController;
  }

  // 6. Obtain or instantiate AudioContext
  try {
    if (externalContext) {
      context = externalContext;
    } else {
      const globalObj: any = typeof window !== 'undefined'
        ? window
        : (typeof globalThis !== 'undefined' ? globalThis : undefined);
      const AudioCtxClass = globalObj.AudioContext || globalObj.webkitAudioContext;
      context = new AudioCtxClass();
      ownsContext = true;
    }

    if (context && context.state === 'suspended' && typeof context.resume === 'function') {
      context.resume().catch(() => {});
    }
  } catch {
    return noOpController;
  }

  if (!context) {
    return noOpController;
  }

  // 7. Create destination node and gain node for normalized volume
  try {
    destNode = context.createMediaStreamDestination();
    gainNode = context.createGain();

    const normalizedGain = Math.max(0, Math.min(1.0, volume));
    if (gainNode.gain.setValueAtTime) {
      gainNode.gain.setValueAtTime(normalizedGain, context.currentTime);
    } else {
      gainNode.gain.value = normalizedGain;
    }

    gainNode.connect(destNode);
  } catch {
    if (ownsContext && context && typeof context.close === 'function') {
      context.close().catch(() => {});
    }
    return noOpController;
  }

  stream = destNode.stream || null;
  const audioTracks = stream && typeof stream.getAudioTracks === 'function' ? stream.getAudioTracks() : [];
  audioTrack = audioTracks.length > 0 ? audioTracks[0] : null;

  const baseTime = typeof presentationStartOffset === 'number'
    ? presentationStartOffset
    : (context.currentTime || 0);

  // 8. Schedule each valid clip precisely on the AudioContext timeline
  for (let i = 0; i < validClips.length; i++) {
    if (isCancelled || isCleanedUp) break;

    const { item, buffer } = validClips[i];
    const nextItem = i < validClips.length - 1 ? validClips[i + 1].item : undefined;

    // Respect item.maxDuration and guard against overlap with adjacent slot
    let allowedDuration = item.maxDuration;
    if (nextItem && nextItem.startPresentationTime > item.startPresentationTime) {
      const windowToNext = nextItem.startPresentationTime - item.startPresentationTime;
      allowedDuration = Math.min(allowedDuration, windowToNext);
    }

    // Clamp duration to min(buffer.duration, allowedDuration)
    const playDuration = Math.max(0.1, Math.min(buffer.duration, allowedDuration));

    const startTime = Math.max(0, baseTime + item.startPresentationTime);
    const stopTime = startTime + playDuration;

    try {
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = false;
      source.connect(gainNode);

      try {
        source.start(startTime, 0, playDuration);
      } catch {
        source.start(startTime);
      }
      source.stop(stopTime);

      activeSources.add(source);
      source.onended = () => {
        activeSources.delete(source);
      };
      scheduledClipsCount++;
    } catch {
      // Individual source failure should not abort remaining clips
    }
  }

  return {
    audioTrack,
    stream,
    context,
    cancel,
    cleanup,
    scheduledClipsCount,
  };
}

// Re-export concrete browser narration audio provider (TASK TTS-A3a)
export {
  createBrowserNarrationAudioProvider,
  clearNarrationAudioCache,
  getNarrationAudioCacheSize,
  DEFAULT_TTS_LANGUAGE,
  DEFAULT_TTS_VOICE,
  MAX_TTS_TEXT_LENGTH,
  DEFAULT_TTS_ENDPOINT,
} from './narrationAudioProvider';
export type { BrowserNarrationAudioProviderOptions } from './narrationAudioProvider';
