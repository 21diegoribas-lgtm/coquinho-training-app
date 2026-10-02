/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  DiagramAnimation,
  DiagramCoachingMoment,
  DiagramPlayer,
  StructuredDrillDiagram,
} from '../types/session';
import {
  buildSemanticAnimation,
  buildWavyPath,
  calculateCameraViewBox,
  COACHING_ENTER_DURATION,
  COACHING_EXIT_DURATION,
  CoachingPhaseState,
  CoachingSequenceProgress,
  DEFAULT_POLISHED_MOTION_OPTIONS,
  formatCoachingOverlayText,
  getCoachingPhaseState,
  getCoachingSequenceProgress,
  getEffectiveCoachingDuration,
  getGoalGeometry,
  getRepresentationDisplayLabel,
  getTeamStyle,
  interpolateAnimationState,
  interpolateViewBox,
  reconstructPlayerOrientation,
  RepresentationDisplayLabel,
  resolvePathCoordinates,
} from './structuredDiagram';

/**
 * Sensible default video bitrate for 1200x720 @ 30fps (TASK D8B2: 4–6 Mbps).
 */
export const DEFAULT_VIDEO_BITS_PER_SECOND = 5_000_000; // 5 Mbps

/**
 * Preferred WebM codec order (TASK D8B2).
 */
export const PREFERRED_WEBM_CODECS = [
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
] as const;

/**
 * Candidate native MP4 mime types for capability detection (TASK D8B2).
 */
export const MP4_CANDIDATE_MIMES = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4;codecs=avc1',
  'video/mp4;codecs=h264',
  'video/mp4',
] as const;

export interface VideoExportOptions {
  fps?: number; // Default 30 FPS
  width?: number; // Default 1200
  height?: number; // Default 720 (5:3 aspect ratio matching 1000x600 pitch)
  videoBitsPerSecond?: number; // Default 5 Mbps
  audioTrack?: MediaStreamTrack | null; // Foundation for future audio track (TASK D8B2)
  filename?: string;
  topic?: string;
  exerciseName?: string;
  onProgress?: (progress: VideoExportProgress) => void;
}

export interface VideoExportProgress {
  presentationTime: number;
  totalDuration: number;
  percent: number; // 0 to 100
  frame: number;
  totalFrames: number;
  stage: 'rendering' | 'encoding' | 'completed' | 'cancelled' | 'error';
}

export interface VideoExportResult {
  blob: Blob;
  mimeType: string;
  filename: string;
  duration: number;
  fps: number;
  width: number;
  height: number;
  frameCount: number;
  hasAudio: boolean;
}

export interface PresentationTimelineMapping {
  presentationTime: number;
  drillTime: number;
  activeMoment: DiagramCoachingMoment | null;
  coachingElapsed: number;
  isFrozen: boolean;
  phaseState: CoachingPhaseState | null;
  cameraViewBox: string;
  sequenceProgress: CoachingSequenceProgress | null;
  interpolatedState: {
    players: DiagramPlayer[];
    balls: Array<{ id: string; x: number; y: number }>;
  };
}

export interface CodecSelectionResult {
  supported: boolean;
  mimeType?: string;
  reason?: string;
}

export interface MediaExportCapability {
  webm: boolean;
  webmCodec?: string;
  mp4Native: boolean;
  mp4NativeCodec?: string;
  mp4RequiresTranscode: boolean;
}

export interface NarrationSlot {
  id: string;
  momentId: string;
  startPresentationTime: number;
  duration: number;
  text: string;
  title: string;
  playerId: string;
  event?: string;
}

export interface ExportPreconditionsValidation {
  valid: boolean;
  error?: string;
  mimeType?: string;
  totalDuration?: number;
}

/**
 * Converts any Vietnamese or Unicode title to a safe, clean URL/filename slug.
 * Example: "Nhận bóng với tư thế mở & Quan sát" -> "nhan-bong-voi-tu-the-mo-quan-sat"
 */
export function slugifyTitle(title: string): string {
  if (typeof title !== 'string') return '';
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

/**
 * Generates a clean download filename for the exported drill video.
 * Example: "coquinho-nhan-bong-mo-than-nguoi.webm"
 */
export function generateVideoFilename(topicOrExerciseName?: string): string {
  const base = slugifyTitle(topicOrExerciseName || '');
  const prefix = 'coquinho';
  if (!base) {
    return `${prefix}-giao-an-tap-luyen.webm`;
  }
  return `${prefix}-${base}.webm`;
}

/**
 * Pure helper for selecting the best supported WebM codec in preferred order (TASK D8B2).
 * Order: 1. video/webm;codecs=vp9, 2. video/webm;codecs=vp8, 3. video/webm.
 */
export function selectBestWebMCodec(
  isTypeSupportedFn?: (mime: string) => boolean
): CodecSelectionResult {
  let checkFn = isTypeSupportedFn;

  if (!checkFn && typeof window !== 'undefined' && (window as any).MediaRecorder && typeof (window as any).MediaRecorder.isTypeSupported === 'function') {
    checkFn = (mime: string) => (window as any).MediaRecorder.isTypeSupported(mime);
  }

  if (!checkFn) {
    return {
      supported: false,
      reason: 'MediaRecorder.isTypeSupported không khả dụng trong môi trường này',
    };
  }

  for (const candidate of PREFERRED_WEBM_CODECS) {
    try {
      if (checkFn(candidate)) {
        return { supported: true, mimeType: candidate };
      }
    } catch {}
  }

  return {
    supported: false,
    reason: 'Không tìm thấy định dạng codec WebM phù hợp (yêu cầu VP9, VP8 hoặc WebM tiêu chuẩn)',
  };
}

/**
 * Pure helper for evaluating MP4 capability and transcoding strategy (TASK D8B2).
 */
export function evaluateMediaExportCapability(
  isTypeSupportedFn?: (mime: string) => boolean
): MediaExportCapability {
  let checkFn = isTypeSupportedFn;
  if (!checkFn && typeof window !== 'undefined' && (window as any).MediaRecorder && typeof (window as any).MediaRecorder.isTypeSupported === 'function') {
    checkFn = (mime: string) => (window as any).MediaRecorder.isTypeSupported(mime);
  }

  if (!checkFn) {
    return {
      webm: false,
      mp4Native: false,
      mp4RequiresTranscode: true,
    };
  }

  const webmSelection = selectBestWebMCodec(checkFn);
  let mp4Native = false;
  let mp4NativeCodec: string | undefined;

  for (const candidate of MP4_CANDIDATE_MIMES) {
    try {
      if (checkFn(candidate)) {
        mp4Native = true;
        mp4NativeCodec = candidate;
        break;
      }
    } catch {}
  }

  return {
    webm: webmSelection.supported,
    webmCodec: webmSelection.mimeType,
    mp4Native,
    mp4NativeCodec,
    mp4RequiresTranscode: !mp4Native,
  };
}

/**
 * Extracts and sorts the unique coaching moments that will participate in playback/export.
 * Honors coachingSequence if present, or valid chronological coaching moments.
 */
export function getExportCoachingMoments(
  animation: DiagramAnimation | null | undefined
): DiagramCoachingMoment[] {
  if (!animation || !Array.isArray(animation.coachingMoments) || animation.coachingMoments.length === 0) {
    return [];
  }

  const moments = animation.coachingMoments.filter(
    (m) => m && typeof m.time === 'number' && typeof m.duration === 'number' && m.duration > 0
  );

  if (animation.coachingSequence && Array.isArray(animation.coachingSequence.momentIds)) {
    const momentMap = new Map<string, DiagramCoachingMoment>();
    moments.forEach((m) => {
      if (m.id) momentMap.set(m.id.trim(), m);
    });

    const sequenceMoments: DiagramCoachingMoment[] = [];
    const seenIds = new Set<string>();

    for (const rawId of animation.coachingSequence.momentIds) {
      if (typeof rawId !== 'string') continue;
      const cleanId = rawId.trim();
      if (!cleanId || seenIds.has(cleanId)) continue;
      const found = momentMap.get(cleanId);
      if (found) {
        seenIds.add(cleanId);
        sequenceMoments.push(found);
      }
    }

    if (sequenceMoments.length > 0) {
      return sequenceMoments.sort((a, b) => a.time - b.time);
    }
  }

  // Non-sequence: sort chronologically and avoid overlapping triggers
  const sorted = [...moments].sort((a, b) => a.time - b.time);
  const result: DiagramCoachingMoment[] = [];
  let lastEndTime = -Infinity;

  for (const m of sorted) {
    if (m.time >= lastEndTime) {
      result.push(m);
      lastEndTime = m.time;
    }
  }

  return result;
}

/**
 * Pure helper to calculate total presentation/export video duration (TASK D8B1/D8B2).
 * Total duration = animation.duration + sum of presentation durations for all active coaching moments.
 * Does not mutate animation.duration.
 */
export function calculateExportDuration(
  animation: DiagramAnimation | null | undefined
): number {
  if (!animation || typeof animation.duration !== 'number' || animation.duration <= 0) {
    return 0;
  }

  const exportMoments = getExportCoachingMoments(animation);
  const coachingDuration = exportMoments.reduce(
    (sum, m) => sum + getEffectiveCoachingDuration(m),
    0
  );
  return Math.round((animation.duration + coachingDuration) * 100) / 100;
}

/**
 * Pure helper for calculating presentation time derived from frame index (TASK D8B2).
 * Prevents drift if frame rendering itself is slow.
 */
export function calculateFramePresentationTime(frameIndex: number, fps = 30): number {
  const safeFps = fps > 0 ? fps : 30;
  return Math.max(0, Math.round((frameIndex / safeFps) * 1000) / 1000);
}

/**
 * Calculates export progress percentage (0 to 100).
 */
export function calculateExportProgress(
  presentationTime: number,
  totalDuration: number
): number {
  if (totalDuration <= 0) return 100;
  const raw = (presentationTime / totalDuration) * 100;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

/**
 * Pure helper that deterministically maps any presentation time [0, totalExportDuration]
 * to the exact drill time, active coaching moment, camera viewBox, and visual phase state.
 */
export function mapPresentationTimeToTimeline(
  presentationTime: number,
  animation: DiagramAnimation,
  diagram: StructuredDrillDiagram
): PresentationTimelineMapping {
  const safePresTime = Math.max(0, presentationTime);
  const animDuration = animation.duration > 0 ? animation.duration : 8;
  const moments = getExportCoachingMoments(animation);

  let currentPresCursor = 0;
  let prevDrillTime = 0;

  let drillTime = animDuration;
  let activeMoment: DiagramCoachingMoment | null = null;
  let coachingElapsed = 0;
  let isFrozen = false;

  for (const m of moments) {
    // 1. Drill running segment before this coaching moment
    const drillRunDuration = Math.max(0, m.time - prevDrillTime);
    if (safePresTime < currentPresCursor + drillRunDuration) {
      drillTime = prevDrillTime + (safePresTime - currentPresCursor);
      activeMoment = null;
      coachingElapsed = 0;
      isFrozen = false;
      break;
    }

    currentPresCursor += drillRunDuration;
    prevDrillTime = m.time;

    // 2. Coaching freeze segment during this coaching moment
    const momentFreezeDuration = getEffectiveCoachingDuration(m);
    if (safePresTime < currentPresCursor + momentFreezeDuration) {
      drillTime = m.time;
      activeMoment = m;
      coachingElapsed = safePresTime - currentPresCursor;
      isFrozen = true;
      break;
    }

    currentPresCursor += momentFreezeDuration;
  }

  // 3. Final drill running segment after all coaching moments
  if (!activeMoment && safePresTime >= currentPresCursor) {
    const finalRun = safePresTime - currentPresCursor;
    drillTime = Math.min(animDuration, prevDrillTime + finalRun);
    isFrozen = false;
  }

  // Calculate phase state if in a coaching moment
  const phaseState = activeMoment
    ? getCoachingPhaseState(coachingElapsed, getEffectiveCoachingDuration(activeMoment))
    : null;

  // Calculate camera viewBox (reuses existing D6 calculateCameraViewBox and interpolateViewBox)
  const fullBox = { minX: 0, minY: 0, width: 1000, height: 600 };
  let cameraViewBox = '0 0 1000 600';

  // Compute interpolated player and ball positions at drillTime
  const interpolatedState = interpolateAnimationState(
    { ...diagram, animation },
    drillTime,
    DEFAULT_POLISHED_MOTION_OPTIONS
  );

  if (activeMoment && phaseState) {
    const targetPlayer = interpolatedState.players.find((p) => p.id === activeMoment!.playerId);
    if (targetPlayer) {
      const toX = (pct: number) => (Math.max(0, Math.min(100, pct)) / 100) * 1000;
      const toY = (pct: number) => (Math.max(0, Math.min(100, pct)) / 100) * 600;
      const tx = toX(targetPlayer.x);
      const ty = toY(targetPlayer.y);
      const zoom = activeMoment.focus?.zoom ?? 1.8;
      const targetBox = calculateCameraViewBox(tx, ty, zoom, 1000, 600);
      cameraViewBox = interpolateViewBox(fullBox, targetBox, phaseState.cameraEase).viewBox;
    }
  }

  // Calculate sequence progress if applicable
  const sequenceProgress = activeMoment
    ? getCoachingSequenceProgress(activeMoment.id, animation.coachingSequence, animation.coachingMoments)
    : null;

  return {
    presentationTime: safePresTime,
    drillTime,
    activeMoment,
    coachingElapsed,
    isFrozen,
    phaseState,
    cameraViewBox,
    sequenceProgress,
    interpolatedState,
  };
}

/**
 * Pure helper that maps coaching moments to presentation-time narration slots (TASK D8B2).
 * Begins during the hold phase of the coaching moment presentation (after camera enter transition completes).
 * Does not overlap and follows presentation time.
 */
export function buildNarrationTimeline(
  animation: DiagramAnimation | null | undefined,
  totalExportDuration?: number
): NarrationSlot[] {
  if (!animation) return [];
  const exportMoments = getExportCoachingMoments(animation);
  if (exportMoments.length === 0) return [];

  const slots: NarrationSlot[] = [];
  let currentPresCursor = 0;
  let prevDrillTime = 0;

  for (let i = 0; i < exportMoments.length; i++) {
    const m = exportMoments[i];
    const drillRun = Math.max(0, m.time - prevDrillTime);
    currentPresCursor += drillRun;
    prevDrillTime = m.time;

    const effectiveDuration = getEffectiveCoachingDuration(m);
    // Coaching moment presentation begins at currentPresCursor
    // Hold phase starts after enter transition (~0.7s)
    const enterDelay = COACHING_ENTER_DURATION;
    const startPresentationTime = Math.round((currentPresCursor + enterDelay) * 100) / 100;

    // Duration covers the hold window (effectiveDuration - enterDelay - exitDelay)
    const slotDuration = Math.max(0.5, Math.round((effectiveDuration - enterDelay - COACHING_EXIT_DURATION) * 100) / 100);

    slots.push({
      id: `narr-${m.id || i + 1}`,
      momentId: m.id,
      startPresentationTime,
      duration: slotDuration,
      text: m.text,
      title: m.title,
      playerId: m.playerId,
      event: m.event,
    });

    currentPresCursor += effectiveDuration;
  }

  return slots;
}

/**
 * Lightweight pre-flight validation before starting export (TASK D8B2).
 */
export function validateExportPreconditions(
  diagram: StructuredDrillDiagram | null | undefined,
  options: VideoExportOptions = {},
  isTypeSupportedFn?: (mime: string) => boolean
): ExportPreconditionsValidation {
  if (!diagram || typeof diagram !== 'object') {
    return { valid: false, error: 'Sơ đồ bài tập không hợp lệ' };
  }

  if (diagram.animation && typeof diagram.animation.duration === 'number' && diagram.animation.duration <= 0) {
    return { valid: false, error: 'Thời lượng hoạt ảnh bài tập phải lớn hơn 0 giây' };
  }

  const anim = diagram.animation && Array.isArray(diagram.animation.steps) && diagram.animation.steps.length > 0
    ? diagram.animation
    : buildSemanticAnimation(diagram);

  if (!anim || typeof anim.duration !== 'number' || anim.duration <= 0) {
    return { valid: false, error: 'Thời lượng hoạt ảnh bài tập phải lớn hơn 0 giây' };
  }

  const totalDuration = calculateExportDuration(anim);
  if (totalDuration <= 0) {
    return { valid: false, error: 'Tổng thời lượng video xuất ra phải lớn hơn 0 giây' };
  }

  const width = options.width ?? 1200;
  const height = options.height ?? 720;
  if (width < 320 || height < 200 || width > 3840 || height > 2160) {
    return { valid: false, error: `Kích thước khung hình không hợp lệ (${width}x${height})` };
  }

  const fps = options.fps ?? 30;
  if (fps < 10 || fps > 60) {
    return { valid: false, error: `Tốc độ khung hình (FPS: ${fps}) phải từ 10 đến 60 FPS` };
  }

  const codecResult = selectBestWebMCodec(isTypeSupportedFn);
  if (!codecResult.supported || !codecResult.mimeType) {
    return {
      valid: false,
      error: codecResult.reason || 'Trình duyệt không hỗ trợ các codec WebM cần thiết (VP9/VP8)',
    };
  }

  return {
    valid: true,
    mimeType: codecResult.mimeType,
    totalDuration,
  };
}

/**
 * Escapes XML strings for safe insertion into SVG documents.
 */
function escapeXml(str: string): string {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Pure helper to render a single frame of the tactical board and coaching presentation as a standalone SVG string.
 */
export function renderDiagramFrameToSvgString(
  diagram: StructuredDrillDiagram,
  mapping: PresentationTimelineMapping,
  width = 1200,
  height = 720
): string {
  const toX = (pct: number) => (Math.max(0, Math.min(100, pct)) / 100) * 1000;
  const toY = (pct: number) => (Math.max(0, Math.min(100, pct)) / 100) * 600;

  const players = mapping.interpolatedState.players;
  const balls = mapping.interpolatedState.balls;
  const cones = Array.isArray(diagram.cones) ? diagram.cones : [];
  const goals = Array.isArray(diagram.goals) ? diagram.goals : [];
  const zones = Array.isArray(diagram.zones) ? diagram.zones : [];
  const paths = Array.isArray(diagram.paths) ? diagram.paths : [];

  const playerMap = new Map<string, DiagramPlayer>();
  players.forEach((p) => {
    if (p && p.id) playerMap.set(p.id, p);
  });

  const resolvedPaths = paths
    .map((p) => resolvePathCoordinates(p, playerMap, toX, toY, 18))
    .filter((p): p is NonNullable<typeof p> => p !== null);

  const formatPlayerNumber = (player: DiagramPlayer): string => {
    if (player.team === 'goalkeeper' || player.role === 'goalkeeper' || player.role === 'gk') {
      return 'GK';
    }
    const id = player.id || '';
    if (id.startsWith('p') && id.length > 1 && !isNaN(Number(id.slice(1)))) {
      return id.slice(1);
    }
    if (id.length <= 3) return id.toUpperCase();
    return id.slice(0, 2).toUpperCase();
  };

  // 1. Tactical Board Layer SVG content
  let boardContent = `
    <!-- Turf stripes -->
    <rect width="1000" height="600" fill="#143d31" />
    <rect y="60" width="1000" height="60" fill="#18483a" />
    <rect y="180" width="1000" height="60" fill="#18483a" />
    <rect y="300" width="1000" height="60" fill="#18483a" />
    <rect y="420" width="1000" height="60" fill="#18483a" />
    <rect y="540" width="1000" height="60" fill="#18483a" />

    <!-- Pitch boundary & markings -->
    <rect x="40" y="25" width="920" height="550" fill="none" stroke="#ffffff" stroke-width="3.5" stroke-opacity="0.6" rx="3" />
    <line x1="500" y1="25" x2="500" y2="575" stroke="#ffffff" stroke-width="3" stroke-opacity="0.5" />
    <circle cx="500" cy="300" r="70" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-opacity="0.5" />
    <circle cx="500" cy="300" r="4" fill="#ffffff" fill-opacity="0.7" />
  `;

  // Tactical Zones
  if (zones.length > 0) {
    boardContent += `<g class="zones-layer">`;
    zones.forEach((z) => {
      const zx = toX(z.x ?? 0);
      const zy = toY(z.y ?? 0);
      const zw = toX(z.width ?? 0);
      const zh = toY(z.height ?? 0);
      boardContent += `
        <rect x="${zx}" y="${zy}" width="${zw}" height="${zh}" fill="rgba(255,255,255,0.06)" stroke="#ffffff" stroke-width="1.8" stroke-dasharray="6,4" stroke-opacity="0.4" />
      `;
      if (z.label) {
        boardContent += `
          <text x="${zx + zw / 2}" y="${zy + zh / 2}" fill="rgba(255,255,255,0.4)" font-size="12" font-family="sans-serif" font-weight="bold" text-anchor="middle" dominant-baseline="central">${escapeXml(z.label)}</text>
        `;
      }
    });
    boardContent += `</g>`;
  }

  // Paths
  if (resolvedPaths.length > 0) {
    boardContent += `<g class="paths-layer">`;
    resolvedPaths.forEach((p) => {
      if (p.type === 'pass') {
        boardContent += `
          <line x1="${p.startX}" y1="${p.startY}" x2="${p.endX}" y2="${p.endY}" stroke="#fde047" stroke-width="3" stroke-dasharray="8,5" marker-end="url(#sd-arrow-pass)" stroke-linecap="round" opacity="0.95" />
        `;
      } else if (p.type === 'movement') {
        boardContent += `
          <line x1="${p.startX}" y1="${p.startY}" x2="${p.endX}" y2="${p.endY}" stroke="#38bdf8" stroke-width="2.8" stroke-dasharray="7,5" marker-end="url(#sd-arrow-movement)" stroke-linecap="round" opacity="0.95" />
        `;
      } else {
        const wavyD = buildWavyPath(p.startX, p.startY, p.endX, p.endY, 4, 5);
        boardContent += `
          <path d="${wavyD}" fill="none" stroke="#fb923c" stroke-width="3.2" stroke-dasharray="4,3" marker-end="url(#sd-arrow-dribble)" stroke-linecap="round" opacity="0.95" />
        `;
      }
    });
    boardContent += `</g>`;
  }

  // Equipment: Goals & Cones
  boardContent += `<g class="equipment-layer">`;
  goals.forEach((goal) => {
    const geom = getGoalGeometry(goal, toX, toY);
    boardContent += `
      <path d="${geom.pathD}" fill="${geom.isMini ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.22)'}" stroke="#ffffff" stroke-width="${geom.isMini ? '2.5' : '3.8'}" />
      <path d="${geom.netD}" fill="none" stroke="#ffffff" stroke-width="1.2" stroke-opacity="0.4" />
    `;
  });
  cones.forEach((c) => {
    const cx = toX(c.x);
    const cy = toY(c.y);
    boardContent += `
      <ellipse cx="${cx}" cy="${cy + 6}" rx="7" ry="2.5" fill="#c2410c" />
      <polygon points="${cx},${cy - 9} ${cx - 6},${cy + 6} ${cx + 6},${cy + 6}" fill="#f97316" stroke="#ea580c" stroke-width="1.2" />
    `;
  });
  boardContent += `</g>`;

  // Players Layer
  boardContent += `<g class="players-layer">`;
  players.forEach((p) => {
    const px = toX(p.x);
    const py = toY(p.y);
    const teamStyle = getTeamStyle(p.team);
    const label = formatPlayerNumber(p);
    const isCoachingFocus = mapping.activeMoment?.playerId === p.id;
    const highlightOpacity = isCoachingFocus && mapping.phaseState ? mapping.phaseState.highlightOpacity : 0;

    const playerOrientation = reconstructPlayerOrientation(
      p.id,
      mapping.drillTime,
      p.orientation,
      diagram.animation?.coachingMoments,
      isCoachingFocus ? mapping.activeMoment : null,
      mapping.phaseState ? mapping.phaseState.orientationProgress : 1
    );

    boardContent += `<g transform="translate(${px}, ${py})">`;

    // Coaching Focus Highlight Rings
    if (isCoachingFocus && highlightOpacity > 0) {
      boardContent += `
        <circle r="30" fill="rgba(253, 224, 71, 0.20)" stroke="#fde047" stroke-width="2.5" opacity="${highlightOpacity.toFixed(2)}" />
        <circle r="36" fill="none" stroke="#fde047" stroke-width="1.5" stroke-dasharray="5,4" opacity="${highlightOpacity.toFixed(2)}" />
      `;
    }

    // Directional Orientation Arrow (rotates around player center)
    if (playerOrientation !== undefined) {
      boardContent += `
        <g transform="rotate(${playerOrientation})">
          <polygon points="19,-5 28,0 19,5" fill="#fde047" stroke="#0f172a" stroke-width="1.2" />
        </g>
      `;
    }

    // Player marker circle
    boardContent += `
      <circle r="18" fill="${teamStyle.fill}" stroke="${teamStyle.stroke}" stroke-width="2.5" />
      <text text-anchor="middle" dominant-baseline="central" fill="${teamStyle.text}" font-size="${label.length > 2 ? '10.5' : '12'}" font-weight="800" font-family="sans-serif">${escapeXml(label)}</text>
    </g>`;
  });
  boardContent += `</g>`;

  // Balls Layer
  boardContent += `<g class="balls-layer">`;
  balls.forEach((b) => {
    const bx = toX(b.x);
    const by = toY(b.y);
    boardContent += `
      <g transform="translate(${bx}, ${by})">
        <circle r="7.5" fill="#ffffff" stroke="#0f172a" stroke-width="1.8" />
        <circle r="3" fill="#0f172a" />
      </g>
    `;
  });
  boardContent += `</g>`;

  // 2. Fixed Overlay Layer: Representative Group Badge & Coaching Card
  const repLabel = getRepresentationDisplayLabel(diagram.representation);
  let repBadgeContent = '';
  if (repLabel) {
    const badgeWidth = 190;
    const badgeHeight = repLabel.secondary ? 40 : 24;
    const badgeX = width - badgeWidth - 20;
    const badgeY = 20;

    repBadgeContent = `
      <g class="representation-badge-overlay" data-testid="representation-badge-export">
        <rect x="${badgeX}" y="${badgeY}" width="${badgeWidth}" height="${badgeHeight}" rx="6" fill="rgba(18, 19, 22, 0.88)" stroke="rgba(255, 255, 255, 0.2)" stroke-width="1" />
        <circle cx="${badgeX + 14}" cy="${badgeY + 14}" r="3.5" fill="#34d399" />
        <text x="${badgeX + 24}" y="${badgeY + 18}" fill="#6ee7b7" font-size="11.5" font-weight="bold" font-family="sans-serif">${escapeXml(repLabel.primary)}</text>
        ${repLabel.secondary ? `<text x="${badgeX + 24}" y="${badgeY + 31}" fill="rgba(255, 255, 255, 0.75)" font-size="9.5" font-family="sans-serif">${escapeXml(repLabel.secondary)}</text>` : ''}
      </g>
    `;
  }

  let overlayContent = '';
  if (mapping.activeMoment && mapping.phaseState && mapping.phaseState.textOpacity > 0) {
    const cardWidth = Math.min(800, width * 0.7);
    const cardHeight = 84;
    const cardX = (width - cardWidth) / 2;
    const cardY = 22;
    const opacity = mapping.phaseState.textOpacity.toFixed(3);

    const titleText = formatCoachingOverlayText(mapping.activeMoment.title, 40);
    const bodyText = formatCoachingOverlayText(mapping.activeMoment.text, 140);

    let sequenceBadgeSvg = '';
    if (mapping.sequenceProgress && mapping.sequenceProgress.isSequence) {
      const badgeText = `Điểm HLV ${mapping.sequenceProgress.current}/${mapping.sequenceProgress.total}`;
      sequenceBadgeSvg = `
        <rect x="${cardX + cardWidth - 110}" y="${cardY + 10}" width="98" height="20" rx="4" fill="rgba(251, 191, 36, 0.2)" stroke="rgba(251, 191, 36, 0.5)" stroke-width="1" />
        <text x="${cardX + cardWidth - 61}" y="${cardY + 24}" fill="#fde047" font-size="11" font-weight="bold" font-family="sans-serif" text-anchor="middle">${escapeXml(badgeText)}</text>
      `;
    }

    overlayContent = `
      <g class="coaching-card-overlay" opacity="${opacity}">
        <rect x="${cardX}" y="${cardY}" width="${cardWidth}" height="${cardHeight}" rx="8" fill="rgba(18, 19, 22, 0.94)" stroke="#f59e0b" stroke-width="1.8" />
        <circle cx="${cardX + 18}" cy="${cardY + 20}" r="4" fill="#f59e0b" />
        <text x="${cardX + 30}" y="${cardY + 24}" fill="#f59e0b" font-size="12" font-weight="bold" font-family="sans-serif">ĐIỂM HUẤN LUYỆN: ${escapeXml(titleText)}</text>
        ${sequenceBadgeSvg}
        <text x="${cardX + 18}" y="${cardY + 54}" fill="#f3f4f6" font-size="13" font-family="sans-serif" font-weight="normal">${escapeXml(bodyText)}</text>
      </g>
    `;
  }

  // 3. Assemble complete SVG document
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <marker id="sd-arrow-pass" viewBox="0 0 12 12" refX="9" refY="6" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 1 2 L 10 6 L 1 10 z" fill="#fde047" />
    </marker>
    <marker id="sd-arrow-movement" viewBox="0 0 12 12" refX="9" refY="6" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 1 2 L 10 6 L 1 10 z" fill="#38bdf8" />
    </marker>
    <marker id="sd-arrow-dribble" viewBox="0 0 12 12" refX="9" refY="6" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 1 2 L 10 6 L 1 10 z" fill="#fb923c" />
    </marker>
  </defs>

  <!-- Tactical Board Layer: rendered with cameraViewBox for zoom/focus -->
  <svg viewBox="${mapping.cameraViewBox}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet">
    ${boardContent}
  </svg>

  <!-- Overlay Layer: fixed screen coordinates -->
  ${repBadgeContent}
  ${overlayContent}
</svg>`;
}

/**
 * Detects whether the current browser supports client-side MediaRecorder video export.
 */
export function isBrowserVideoExportSupported(): {
  supported: boolean;
  mimeType?: string;
  reason?: string;
} {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { supported: false, reason: 'Môi trường không có window/document DOM' };
  }

  if (typeof HTMLCanvasElement === 'undefined' || typeof HTMLCanvasElement.prototype.captureStream !== 'function') {
    return {
      supported: false,
      reason: 'Trình duyệt không hỗ trợ HTMLCanvasElement.captureStream()',
    };
  }

  if (typeof (window as any).MediaRecorder === 'undefined') {
    return {
      supported: false,
      reason: 'Trình duyệt không hỗ trợ MediaRecorder API',
    };
  }

  return selectBestWebMCodec();
}

/**
 * Schedules the cleanup/revocation of a Blob URL after a safe delay (TASK D8B2).
 * Prevents premature revocation while native browser download is still initializing.
 */
export function scheduleBlobUrlCleanup(url: string, delayMs = 60_000): void {
  setTimeout(() => {
    try {
      URL.revokeObjectURL(url);
    } catch {}
  }, delayMs);
}

/**
 * Triggers a native browser file download from a Blob with safe lifecycle management (TASK D8B2).
 */
export function triggerVideoDownload(blob: Blob, filename: string, cleanupDelayMs = 60_000): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  scheduleBlobUrlCleanup(url, cleanupDelayMs);
}

/**
 * Pure helper for combining video stream with an optional audio track (TASK D8B2).
 */
export function combineMediaStreamTracks(
  videoStream: MediaStream,
  audioTrack?: MediaStreamTrack | null
): MediaStream {
  if (!audioTrack) {
    return videoStream;
  }
  try {
    const combined = new MediaStream();
    videoStream.getVideoTracks().forEach((vt) => combined.addTrack(vt));
    combined.addTrack(audioTrack);
    return combined;
  } catch {
    return videoStream;
  }
}

/**
 * Safely stops MediaRecorder and releases stream tracks avoiding race conditions (TASK D8B2).
 */
export function safeStopMediaRecorder(
  recorder: any,
  stream: MediaStream | null,
  timeoutMs = 5000
): Promise<void> {
  return new Promise<void>((resolve) => {
    if (!recorder || recorder.state === 'inactive') {
      if (stream) {
        stream.getTracks().forEach((t) => {
          try { t.stop(); } catch {}
        });
      }
      return resolve();
    }

    let isDone = false;
    const finish = () => {
      if (isDone) return;
      isDone = true;
      if (stream) {
        stream.getTracks().forEach((t) => {
          try { t.stop(); } catch {}
        });
      }
      resolve();
    };

    const timer = setTimeout(finish, timeoutMs);

    const prevOnStop = recorder.onstop;
    recorder.onstop = (e: any) => {
      clearTimeout(timer);
      if (typeof prevOnStop === 'function') {
        try { prevOnStop(e); } catch {}
      }
      finish();
    };

    try {
      if (typeof recorder.requestData === 'function' && recorder.state === 'recording') {
        recorder.requestData();
      }
      recorder.stop();
    } catch {
      finish();
    }
  });
}

export interface VideoExportController {
  cancel: () => void;
  promise: Promise<VideoExportResult | null>;
}

/**
 * Deterministically records a structured drill diagram animation into a WebM video Blob.
 * Hardened with D8B2 reliability, bitrate selection, final-frame capture, and audio foundation.
 */
export function exportDiagramToVideoBlob(
  diagram: StructuredDrillDiagram,
  options: VideoExportOptions = {}
): VideoExportController {
  let isCancelled = false;
  let recorder: any = null;
  let finalStream: MediaStream | null = null;
  let triggerCancelCallback: (() => void) | null = null;

  const promise = new Promise<VideoExportResult | null>(async (resolve, reject) => {
    // 1. Pre-flight quality validation (TASK D8B2)
    const validation = validateExportPreconditions(diagram, options);
    if (!validation.valid) {
      return reject(new Error(validation.error || 'Kiểm tra điều kiện xuất video không thành công'));
    }

    const animation =
      diagram.animation && Array.isArray(diagram.animation.steps) && diagram.animation.steps.length > 0
        ? diagram.animation
        : buildSemanticAnimation(diagram);

    const fps = options.fps ?? 30;
    const width = options.width ?? 1200;
    const height = options.height ?? 720;
    const totalDuration = validation.totalDuration || calculateExportDuration(animation);
    const totalFrames = Math.max(1, Math.round(totalDuration * fps));
    const mimeType = validation.mimeType || 'video/webm';
    const videoBitsPerSecond = options.videoBitsPerSecond ?? DEFAULT_VIDEO_BITS_PER_SECOND;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return reject(new Error('Không thể khởi tạo Canvas 2D context'));
    }

    // 2. Set up MediaStream with optional audio track (TASK D8B2)
    try {
      const rawVideoStream = canvas.captureStream(fps);
      finalStream = combineMediaStreamTracks(rawVideoStream, options.audioTrack);
      const MR = (window as any).MediaRecorder;

      try {
        recorder = new MR(finalStream, {
          mimeType,
          videoBitsPerSecond,
        });
      } catch {
        // Fallback without videoBitsPerSecond if browser rejects bitrate
        recorder = new MR(finalStream, { mimeType });
      }
    } catch (err: any) {
      return reject(new Error(`Không thể khởi tạo MediaRecorder: ${err.message || String(err)}`));
    }

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e: any) => {
      if (e.data && e.data.size > 0) {
        chunks.push(e.data);
      }
    };

    const filename = options.filename || generateVideoFilename(options.exerciseName || options.topic);

    const recorderStoppedPromise = new Promise<Blob | null>((res) => {
      recorder.onstop = () => {
        if (isCancelled || chunks.length === 0) {
          res(null);
        } else {
          const finalBlob = new Blob(chunks, { type: recorder.mimeType || mimeType });
          res(finalBlob);
        }
      };
      recorder.onerror = (err: any) => {
        console.error('MediaRecorder error:', err);
        res(null);
      };
    });

    recorder.start(100);

    triggerCancelCallback = () => {
      isCancelled = true;
      safeStopMediaRecorder(recorder, finalStream);
      options.onProgress?.({
        presentationTime: 0,
        totalDuration,
        percent: 0,
        frame: 0,
        totalFrames,
        stage: 'cancelled',
      });
      resolve(null);
    };

    // 3. Deterministic frame pacing loop (TASK D8B2: presentationTime derived from frame index)
    const frameIntervalMs = 1000 / fps;
    const img = new Image();

    try {
      for (let frame = 0; frame <= totalFrames; frame++) {
        if (isCancelled) break;

        // Presentation time derived from frame index (prevents drift if rendering is slow)
        const presentationTime = Math.min(totalDuration, calculateFramePresentationTime(frame, fps));
        const mapping = mapPresentationTimeToTimeline(presentationTime, animation, diagram);
        const svgString = renderDiagramFrameToSvgString(diagram, mapping, width, height);

        await new Promise<void>((frameResolve) => {
          const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
          const url = URL.createObjectURL(svgBlob);

          img.onload = () => {
            ctx.clearRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            URL.revokeObjectURL(url);
            frameResolve();
          };
          img.onerror = () => {
            URL.revokeObjectURL(url);
            frameResolve();
          };
          img.src = url;
        });

        const percent = calculateExportProgress(presentationTime, totalDuration);
        options.onProgress?.({
          presentationTime,
          totalDuration,
          percent,
          frame,
          totalFrames,
          stage: 'rendering',
        });

        // Pace frames for MediaRecorder clock synchronization
        await new Promise((r) => setTimeout(r, frameIntervalMs));
      }

      if (isCancelled) {
        return;
      }

      // 4. Final Frame Safety: Hold final frame slightly so recorder captures final frame (TASK D8B2)
      await new Promise((r) => setTimeout(r, frameIntervalMs * 1.5));

      options.onProgress?.({
        presentationTime: totalDuration,
        totalDuration,
        percent: 100,
        frame: totalFrames,
        totalFrames,
        stage: 'encoding',
      });

      // 5. Harden shutdown (TASK D8B2)
      await safeStopMediaRecorder(recorder, finalStream);

      const resultBlob = await recorderStoppedPromise;
      if (isCancelled || !resultBlob) {
        resolve(null);
      } else {
        options.onProgress?.({
          presentationTime: totalDuration,
          totalDuration,
          percent: 100,
          frame: totalFrames,
          totalFrames,
          stage: 'completed',
        });

        // 6. Return rich export result metadata (TASK D8B2)
        const exportResult: VideoExportResult = {
          blob: resultBlob,
          mimeType: recorder.mimeType || mimeType,
          filename,
          duration: totalDuration,
          fps,
          width,
          height,
          frameCount: totalFrames + 1,
          hasAudio: Boolean(options.audioTrack),
        };

        resolve(exportResult);
      }
    } catch (err: any) {
      await safeStopMediaRecorder(recorder, finalStream);
      options.onProgress?.({
        presentationTime: 0,
        totalDuration,
        percent: 0,
        frame: 0,
        totalFrames,
        stage: 'error',
      });
      reject(err);
    }
  });

  return {
    cancel: () => {
      if (triggerCancelCallback) triggerCancelCallback();
      else isCancelled = true;
    },
    promise,
  };
}

/**
 * High-level function that runs video export and immediately triggers browser file download.
 * Returns export controller with promise resolving boolean success.
 */
export function exportAndDownloadDiagramVideo(
  diagram: StructuredDrillDiagram,
  options: VideoExportOptions = {}
): { cancel: () => void; promise: Promise<boolean> } {
  const filename = options.filename || generateVideoFilename(options.exerciseName || options.topic);
  const controller = exportDiagramToVideoBlob(diagram, { ...options, filename });

  const promise = controller.promise
    .then((result) => {
      if (!result) return false;
      triggerVideoDownload(result.blob, result.filename);
      return true;
    })
    .catch((err) => {
      console.error('Video export failed:', err);
      return false;
    });

  return {
    cancel: controller.cancel,
    promise,
  };
}

export { getRepresentationDisplayLabel, type RepresentationDisplayLabel } from './structuredDiagram';
