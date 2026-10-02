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
  'mở thân người': 'Mở thân người để hướng về phía chơi tiếp theo.',
  'chạm bước một': 'Chạm bước một đưa bóng vào không gian thuận lợi.',
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
  'mở thân người để hướng về phía chơi tiếp theo.': 'Mở thân người hướng chơi tiếp.',
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
    return 'Mở thân người để hướng về phía chơi tiếp theo.';
  }
  if (/chạm bước một|first touch|bước một/i.test(titleLower)) {
    return 'Chạm bước một đưa bóng vào không gian thuận lợi.';
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
    return 'Mở thân người để hướng về phía chơi tiếp theo.';
  }
  if (moment.event === 'firstTouch') {
    return 'Chạm bước một đưa bóng vào không gian thuận lợi.';
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
