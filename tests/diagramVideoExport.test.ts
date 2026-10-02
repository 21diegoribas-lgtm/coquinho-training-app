import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildNarrationTimeline,
  calculateExportDuration,
  calculateExportProgress,
  calculateFramePresentationTime,
  combineMediaStreamTracks,
  DEFAULT_VIDEO_BITS_PER_SECOND,
  evaluateMediaExportCapability,
  generateVideoFilename,
  getExportCoachingMoments,
  isBrowserVideoExportSupported,
  mapPresentationTimeToTimeline,
  PREFERRED_WEBM_CODECS,
  renderDiagramFrameToSvgString,
  safeStopMediaRecorder,
  scheduleBlobUrlCleanup,
  selectBestWebMCodec,
  slugifyTitle,
  validateExportPreconditions,
  VideoExportResult,
} from '../src/services/diagramVideoExport';
import {
  buildDefaultStructuredDiagram,
  buildSemanticAnimation,
  DEFAULT_POLISHED_MOTION_OPTIONS,
  interpolateAnimationState,
} from '../src/services/structuredDiagram';
import { DiagramAnimation, StructuredDrillDiagram } from '../src/types/session';

// =============================================================================
// TASK D8B1 & D8B2 TESTS: VIDEO EXPORT FOUNDATION & HARDENING
// =============================================================================

test('D8B1: filename sanitization and video filename generation', () => {
  // 1. Vietnamese diacritics removal and slugification
  assert.equal(slugifyTitle('Nhận bóng mở thân người'), 'nhan-bong-mo-than-nguoi');
  assert.equal(
    slugifyTitle('Nhận bóng với tư thế mở & Quan sát không gian'),
    'nhan-bong-voi-tu-the-mo-quan-sat-khong-gian'
  );
  assert.equal(slugifyTitle('Bài tập 3v3 + 2 Neutral (Kỹ năng)'), 'bai-tap-3v3-2-neutral-ky-nang');
  assert.equal(slugifyTitle(''), '');
  assert.equal(slugifyTitle(undefined as any), '');

  // 2. generateVideoFilename produces valid .webm filenames
  assert.equal(
    generateVideoFilename('Nhận bóng mở thân người'),
    'coquinho-nhan-bong-mo-than-nguoi.webm'
  );
  assert.equal(
    generateVideoFilename('Khởi động chuyền bóng'),
    'coquinho-khoi-dong-chuyen-bong.webm'
  );
  assert.equal(generateVideoFilename(''), 'coquinho-giao-an-tap-luyen.webm');
  assert.equal(generateVideoFilename(undefined), 'coquinho-giao-an-tap-luyen.webm');
});

test('D8B1: calculateExportDuration includes coaching presentation duration without mutating animation', () => {
  // 1. Drill animation duration 8s, two 2s coaching moments => total 12s
  const anim: DiagramAnimation = {
    duration: 8.0,
    steps: [
      {
        id: 's1',
        start: 0,
        duration: 4,
        actions: [{ type: 'playerMove', playerId: 'p1', to: { x: 40, y: 30 } }],
      },
      {
        id: 's2',
        start: 4,
        duration: 4,
        actions: [{ type: 'playerMove', playerId: 'p1', to: { x: 70, y: 30 } }],
      },
    ],
    coachingMoments: [
      { id: 'c1', time: 2.0, duration: 2.0, playerId: 'p1', title: 'C1', text: 'T1' },
      { id: 'c2', time: 5.0, duration: 2.0, playerId: 'p1', title: 'C2', text: 'T2' },
    ],
  };

  const total = calculateExportDuration(anim);
  assert.equal(total, 12.0);
  assert.equal(anim.duration, 8.0, 'Original animation.duration must NOT be mutated');

  // 2. Animation with sequence: honors sequence moments
  const animWithSeq: DiagramAnimation = {
    duration: 6.0,
    steps: [],
    coachingMoments: [
      { id: 'c1', time: 1.5, duration: 1.2, playerId: 'p1', title: 'C1', text: 'T1' },
      { id: 'c2', time: 3.0, duration: 1.5, playerId: 'p1', title: 'C2', text: 'T2' },
      { id: 'c_unused', time: 4.0, duration: 3.0, playerId: 'p1', title: 'Ignored', text: 'Ignored' },
    ],
    coachingSequence: {
      id: 'seq1',
      title: 'Seq',
      momentIds: ['c1', 'c2'],
    },
  };

  // Only c1 (1.2s) and c2 (1.5s) are in the sequence => 6.0 + 1.2 + 1.5 = 8.7s
  assert.equal(calculateExportDuration(animWithSeq), 8.7);

  // 3. Animation with no coaching moments => export duration = drill duration
  const animNoCoach: DiagramAnimation = {
    duration: 5.0,
    steps: [],
  };
  assert.equal(calculateExportDuration(animNoCoach), 5.0);

  // 4. Null / empty animation safety
  assert.equal(calculateExportDuration(null), 0);
  assert.equal(calculateExportDuration({ duration: 0, steps: [] }), 0);
});

test('D8B1: calculateExportProgress returns accurate 0-100% progress', () => {
  assert.equal(calculateExportProgress(0, 10), 0);
  assert.equal(calculateExportProgress(5, 10), 50);
  assert.equal(calculateExportProgress(10, 10), 100);
  assert.equal(calculateExportProgress(4.2, 10), 42);

  // Clamping at boundaries
  assert.equal(calculateExportProgress(-1, 10), 0);
  assert.equal(calculateExportProgress(12, 10), 100);
  assert.equal(calculateExportProgress(0, 0), 100);
});

test('D8B1: mapPresentationTimeToTimeline maps drill-time and freeze intervals deterministically', () => {
  const diag: StructuredDrillDiagram = {
    pitch: { width: 100, height: 60 },
    players: [
      { id: 'p1', team: 'blue', x: 20, y: 30 },
      { id: 'p2', team: 'blue', x: 60, y: 30 },
    ],
    balls: [{ id: 'b1', x: 20, y: 30 }],
    cones: [],
    goals: [],
    zones: [],
    paths: [{ id: 'path1', type: 'pass', fromPlayerId: 'p1', toPlayerId: 'p2' }],
    animation: {
      duration: 8.0,
      steps: [
        {
          id: 's1',
          start: 0,
          duration: 4,
          actions: [{ type: 'ballPass', ballId: 'b1', fromPlayerId: 'p1', toPlayerId: 'p2' }],
        },
        {
          id: 's2',
          start: 4,
          duration: 4,
          actions: [{ type: 'playerMove', playerId: 'p2', to: { x: 80, y: 40 } }],
        },
      ],
      coachingMoments: [
        {
          id: 'cm1',
          time: 2.0,
          duration: 2.0,
          playerId: 'p2',
          title: 'Kiểm tra vai',
          text: 'Quan sát kiểm tra vai trước khi đón bóng',
          orientation: 45,
          focus: { zoom: 2.0 },
        },
      ],
    },
  };

  const anim = diag.animation!;
  const totalDuration = calculateExportDuration(anim);
  assert.equal(totalDuration, 10.0); // 8s drill + 2s coaching freeze

  // 1. Initial frame: t_pres = 0s
  const frame0 = mapPresentationTimeToTimeline(0, anim, diag);
  assert.equal(frame0.drillTime, 0);
  assert.equal(frame0.isFrozen, false);
  assert.equal(frame0.activeMoment, null);
  assert.equal(frame0.cameraViewBox, '0 0 1000 600');
  assert.equal(frame0.interpolatedState.balls[0].x, 20);

  // 2. During initial drill run: t_pres = 1.0s (midway to freeze)
  const frame1 = mapPresentationTimeToTimeline(1.0, anim, diag);
  assert.equal(frame1.drillTime, 1.0);
  assert.equal(frame1.isFrozen, false);
  assert.equal(frame1.activeMoment, null);
  // D8A action easing (easeBallPass at 25% duration is quadratic = 0.125 progress): 20 + 40 * 0.125 = 25
  assert.equal(frame1.interpolatedState.balls[0].x, 25);

  // 3. Exact trigger of coaching moment: t_pres = 2.0s
  const frame2 = mapPresentationTimeToTimeline(2.0, anim, diag);
  assert.equal(frame2.drillTime, 2.0);
  assert.equal(frame2.isFrozen, true);
  assert.equal(frame2.activeMoment?.id, 'cm1');
  assert.equal(frame2.coachingElapsed, 0);

  // 4. Midpoint of coaching freeze: t_pres = 3.0s (1.0s into freeze)
  const frame3 = mapPresentationTimeToTimeline(3.0, anim, diag);
  assert.equal(frame3.drillTime, 2.0, 'Drill time MUST remain frozen at 2.0s');
  assert.equal(frame3.isFrozen, true);
  assert.equal(frame3.activeMoment?.id, 'cm1');
  assert.equal(frame3.coachingElapsed, 1.0);
  assert.equal(frame3.phaseState?.phase, 'hold');
  assert.equal(frame3.phaseState?.cameraEase, 1.0);
  // Camera zoomed into player p2 at (600, 180) with zoom 2.0 => width=500, height=300 => minX=350, minY=30
  assert.equal(frame3.cameraViewBox, '350 30 500 300');
  // Ball position stays frozen mid-flight
  assert.equal(frame3.interpolatedState.balls[0].x, 40);

  // 5. End of coaching freeze / start of resumption: t_pres = 4.0s
  const frame4 = mapPresentationTimeToTimeline(4.0, anim, diag);
  assert.equal(frame4.drillTime, 2.0, 'Resumes from exact timestamp 2.0s');
  assert.equal(frame4.isFrozen, false);
  assert.equal(frame4.activeMoment, null);

  // 6. Resumed drill playback: t_pres = 6.0s (2.0s after freeze ended)
  // Drill has advanced by 2.0s from 2.0s => drillTime = 4.0s
  const frame5 = mapPresentationTimeToTimeline(6.0, anim, diag);
  assert.equal(frame5.drillTime, 4.0);
  assert.equal(frame5.isFrozen, false);
  assert.equal(frame5.activeMoment, null);
  assert.equal(frame5.cameraViewBox, '0 0 1000 600');

  // 7. Final frame: t_pres = 10.0s => drillTime = 8.0s (animation duration)
  const frameFinal = mapPresentationTimeToTimeline(10.0, anim, diag);
  assert.equal(frameFinal.drillTime, 8.0);
  assert.equal(frameFinal.isFrozen, false);
  assert.equal(frameFinal.interpolatedState.players[1].x, 80);
});

test('D8B1: renderDiagramFrameToSvgString generates valid, self-contained SVG with overlays', () => {
  const diag: StructuredDrillDiagram = {
    pitch: { width: 100, height: 60 },
    players: [
      { id: 'p1', team: 'blue', role: 'passer', x: 20, y: 30 },
      { id: 'p2', team: 'red', role: 'receiver', x: 60, y: 30 },
    ],
    balls: [{ id: 'b1', x: 20, y: 30 }],
    cones: [{ id: 'c1', x: 10, y: 10 }],
    goals: [{ id: 'g1', type: 'mini', x: 92, y: 50, orientation: 'right' }],
    zones: [{ id: 'z1', x: 10, y: 10, width: 80, height: 40, label: 'Khu vực hoạt động' }],
    paths: [{ id: 'path1', type: 'pass', fromPlayerId: 'p1', toPlayerId: 'p2' }],
    animation: {
      duration: 6.0,
      steps: [
        {
          id: 's1',
          start: 0,
          duration: 3,
          actions: [{ type: 'ballPass', ballId: 'b1', fromPlayerId: 'p1', toPlayerId: 'p2' }],
        },
      ],
      coachingMoments: [
        {
          id: 'coach1',
          time: 2.0,
          duration: 2.0,
          playerId: 'p2',
          title: 'Kiểm tra vai',
          text: 'Quan sát phía sau trước khi nhận bóng',
          orientation: 45,
        },
        {
          id: 'coach2',
          time: 4.5,
          duration: 1.5,
          playerId: 'p2',
          title: 'Mở thân người',
          text: 'Mở thân người đón bóng',
          orientation: 45,
        },
      ],
      coachingSequence: {
        id: 'seq1',
        title: 'Trình tự HLV',
        momentIds: ['coach1', 'coach2'],
      },
    },
  };

  const anim = diag.animation!;

  // 1. Normal running frame without active coaching overlay
  const normalMapping = mapPresentationTimeToTimeline(0.5, anim, diag);
  const normalSvg = renderDiagramFrameToSvgString(diag, normalMapping, 1200, 720);

  assert.ok(normalSvg.startsWith('<?xml version="1.0"'));
  assert.ok(normalSvg.includes('width="1200" height="720"'));
  assert.ok(normalSvg.includes('viewBox="0 0 1000 600"'));
  assert.ok(normalSvg.includes('Khu vực hoạt động'));
  assert.ok(!normalSvg.includes('class="coaching-card-overlay"'));

  // 2. Frozen coaching moment frame with coaching overlay card and sequence badge
  const frozenMapping = mapPresentationTimeToTimeline(3.0, anim, diag); // midpoint of coach1 moment
  const frozenSvg = renderDiagramFrameToSvgString(diag, frozenMapping, 1200, 720);

  assert.ok(frozenSvg.includes('class="coaching-card-overlay"'));
  assert.ok(frozenSvg.includes('ĐIỂM HUẤN LUYỆN: Kiểm tra vai'));
  assert.ok(frozenSvg.includes('Quan sát phía sau trước khi nhận bóng'));
  assert.ok(frozenSvg.includes('Điểm HLV 1/2'));
  // Camera is focused around p2
  assert.notEqual(frozenMapping.cameraViewBox, '0 0 1000 600');
  assert.ok(frozenSvg.includes(`viewBox="${frozenMapping.cameraViewBox}"`));
});

test('D8B1: isBrowserVideoExportSupported safely handles non-browser environment without throwing', () => {
  const result = isBrowserVideoExportSupported();
  // In Node.js testing environment: window/document is undefined, safely returns supported: false
  assert.equal(typeof result, 'object');
  assert.equal(typeof result.supported, 'boolean');
  if (!result.supported) {
    assert.ok(result.reason && result.reason.length > 0);
  }
});

// =============================================================================
// TASK D8B2 TESTS: HARDENING, CODECS, BITRATE, TIMELINES, AUDIO & MP4 FOUNDATION
// =============================================================================

test('D8B2: selectBestWebMCodec evaluates preferred codecs in strict priority order', () => {
  // 1. When VP9 is supported: selects VP9
  const withVp9 = selectBestWebMCodec((mime) => mime.includes('vp9'));
  assert.equal(withVp9.supported, true);
  assert.equal(withVp9.mimeType, 'video/webm;codecs=vp9');

  // 2. When VP9 is absent but VP8 is supported: selects VP8
  const withVp8Only = selectBestWebMCodec((mime) => mime === 'video/webm;codecs=vp8' || mime === 'video/webm');
  assert.equal(withVp8Only.supported, true);
  assert.equal(withVp8Only.mimeType, 'video/webm;codecs=vp8');

  // 3. When only basic video/webm is supported: selects basic video/webm
  const withBasicWebm = selectBestWebMCodec((mime) => mime === 'video/webm');
  assert.equal(withBasicWebm.supported, true);
  assert.equal(withBasicWebm.mimeType, 'video/webm');

  // 4. When no WebM codec is supported: returns supported: false
  const noWebm = selectBestWebMCodec((mime) => mime.includes('mp4'));
  assert.equal(noWebm.supported, false);
  assert.ok(noWebm.reason && noWebm.reason.length > 0);

  // 5. Default preferred codecs constant check
  assert.deepEqual(PREFERRED_WEBM_CODECS, [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ]);
});

test('D8B2: video bitrate constant is configured sensibly', () => {
  // 4–6 Mbps recommended for 1200x720 30fps tactical board
  assert.ok(DEFAULT_VIDEO_BITS_PER_SECOND >= 4_000_000 && DEFAULT_VIDEO_BITS_PER_SECOND <= 6_000_000);
  assert.equal(DEFAULT_VIDEO_BITS_PER_SECOND, 5_000_000);
});

test('D8B2: calculateFramePresentationTime derives deterministic time from frame index', () => {
  // At 30 FPS:
  // frame 0 => 0s
  assert.equal(calculateFramePresentationTime(0, 30), 0);
  // frame 15 => 0.5s
  assert.equal(calculateFramePresentationTime(15, 30), 0.5);
  // frame 30 => 1.0s
  assert.equal(calculateFramePresentationTime(30, 30), 1.0);
  // frame 90 => 3.0s
  assert.equal(calculateFramePresentationTime(90, 30), 3.0);
  // frame 360 => 12.0s
  assert.equal(calculateFramePresentationTime(360, 30), 12.0);

  // Negative safety & fallback fps
  assert.equal(calculateFramePresentationTime(-5, 30), 0);
  assert.equal(calculateFramePresentationTime(30, 0), 1.0); // Fallbacks safely to 30 FPS
});

test('D8B2: safeStopMediaRecorder handles inactive recorder, error, and track cleanup safely', async () => {
  let tracksStopped = false;
  const mockTrack = {
    stop: () => { tracksStopped = true; },
  } as unknown as MediaStreamTrack;

  const mockStream = {
    getTracks: () => [mockTrack],
  } as unknown as MediaStream;

  // 1. Inactive recorder resolves immediately and cleans tracks
  const inactiveRecorder = { state: 'inactive' };
  await safeStopMediaRecorder(inactiveRecorder, mockStream);
  assert.equal(tracksStopped, true);

  // 2. Active recording recorder calls stop and invokes cleanup
  let recorderStopped = false;
  tracksStopped = false;
  const activeRecorder: any = {
    state: 'recording',
    requestData: () => {},
    stop: function () {
      recorderStopped = true;
      if (typeof this.onstop === 'function') {
        this.onstop({ type: 'stop' });
      }
    },
  };

  await safeStopMediaRecorder(activeRecorder, mockStream);
  assert.equal(recorderStopped, true);
  assert.equal(tracksStopped, true);
});

test('D8B2: scheduleBlobUrlCleanup accepts delay and cleans without throwing', () => {
  assert.doesNotThrow(() => {
    scheduleBlobUrlCleanup('blob:http://localhost:3000/mock-uuid', 50);
  });
});

test('D8B2: buildNarrationTimeline generates presentation-time slots during coaching hold phase', () => {
  const anim: DiagramAnimation = {
    duration: 8.0,
    steps: [],
    coachingMoments: [
      {
        id: 'c1',
        time: 2.0,
        duration: 2.0,
        playerId: 'p2',
        title: 'Kiểm tra vai',
        text: 'Kiểm tra vai trước khi đón bóng',
      },
      {
        id: 'c2',
        time: 5.0,
        duration: 2.0,
        playerId: 'p2',
        title: 'Mở thân người',
        text: 'Mở thân người đón bóng',
      },
    ],
  };

  const slots = buildNarrationTimeline(anim);
  assert.equal(slots.length, 2);

  // Slot 1: Moment 1 triggers at presentation time 2.0s
  // Enter delay is ~0.5s (25% of 2.0s) => narration starts at 2.0 + 0.5 = 2.5s (during hold phase)
  assert.equal(slots[0].id, 'narr-c1');
  assert.equal(slots[0].momentId, 'c1');
  assert.equal(slots[0].startPresentationTime, 2.5);
  assert.ok(slots[0].duration > 1.0);
  assert.equal(slots[0].text, 'Kiểm tra vai trước khi đón bóng');

  // Slot 2: Moment 2 drill time is 5.0s.
  // Moment 1 presentation added 2.0s => Moment 2 starts at pres time 2.0 + 2.0 + (5.0 - 2.0) = 7.0s!
  // Enter delay is 0.5s => narration starts at 7.0 + 0.5 = 7.5s
  assert.equal(slots[1].id, 'narr-c2');
  assert.equal(slots[1].momentId, 'c2');
  assert.equal(slots[1].startPresentationTime, 7.5);
  assert.ok(slots[1].duration > 1.0);
  assert.equal(slots[1].text, 'Mở thân người đón bóng');

  // Slots do not overlap in presentation timeline
  assert.ok(slots[0].startPresentationTime + slots[0].duration < slots[1].startPresentationTime);
});

test('D8B2: evaluateMediaExportCapability reports WebM and MP4 transcoding strategy correctly', () => {
  // Case A: WebM supported, MP4 NOT supported natively => requires transcode
  const mockSupportA = (mime: string) => mime.includes('webm');
  const capA = evaluateMediaExportCapability(mockSupportA);
  assert.equal(capA.webm, true);
  assert.equal(capA.mp4Native, false);
  assert.equal(capA.mp4RequiresTranscode, true);

  // Case B: Both WebM and native MP4 supported => no transcode required
  const mockSupportB = (mime: string) => mime.includes('webm') || mime.includes('mp4');
  const capB = evaluateMediaExportCapability(mockSupportB);
  assert.equal(capB.webm, true);
  assert.equal(capB.mp4Native, true);
  assert.equal(capB.mp4RequiresTranscode, false);

  // Case C: Neither supported
  const mockSupportC = () => false;
  const capC = evaluateMediaExportCapability(mockSupportC);
  assert.equal(capC.webm, false);
  assert.equal(capC.mp4Native, false);
  assert.equal(capC.mp4RequiresTranscode, true);
});

test('D8B2: validateExportPreconditions validates preconditions and fails early with readable errors', () => {
  const validDiag: StructuredDrillDiagram = {
    pitch: { width: 100, height: 60 },
    players: [{ id: 'p1', team: 'blue', x: 20, y: 30 }],
    balls: [{ id: 'b1', x: 20, y: 30 }],
    cones: [],
    goals: [],
    zones: [],
    paths: [],
    animation: {
      duration: 6.0,
      steps: [{ id: 's1', start: 0, duration: 2, actions: [] }],
    },
  };

  const isTypeSupported = (mime: string) => mime.includes('webm');

  // 1. Valid diagram passes validation
  const okVal = validateExportPreconditions(validDiag, { fps: 30, width: 1200, height: 720 }, isTypeSupported);
  assert.equal(okVal.valid, true);
  assert.equal(okVal.mimeType, 'video/webm;codecs=vp9');
  assert.equal(okVal.totalDuration, 6.0);

  // 2. Zero duration animation fails
  const zeroAnimDiag: StructuredDrillDiagram = {
    ...validDiag,
    animation: { duration: 0, steps: [] },
  };
  const zeroVal = validateExportPreconditions(zeroAnimDiag, {}, isTypeSupported);
  assert.equal(zeroVal.valid, false);
  assert.ok(zeroVal.error?.includes('hoạt ảnh'));

  // 3. Out of bounds FPS fails
  const badFpsVal = validateExportPreconditions(validDiag, { fps: 120 }, isTypeSupported);
  assert.equal(badFpsVal.valid, false);
  assert.ok(badFpsVal.error?.includes('FPS'));

  // 4. Unsupported codec fails early
  const badCodecVal = validateExportPreconditions(validDiag, {}, () => false);
  assert.equal(badCodecVal.valid, false);
  assert.ok(badCodecVal.error?.includes('codec'));
});

test('D8B2: combineMediaStreamTracks foundation combines video and audio tracks cleanly', () => {
  const videoTrack = { kind: 'video' } as unknown as MediaStreamTrack;
  const audioTrack = { kind: 'audio' } as unknown as MediaStreamTrack;

  let addedTracks: MediaStreamTrack[] = [];
  class MockMediaStream {
    tracks: MediaStreamTrack[] = [];
    constructor(tracks?: MediaStreamTrack[]) {
      if (tracks) this.tracks = [...tracks];
    }
    getVideoTracks() { return this.tracks.filter(t => t.kind === 'video'); }
    getAudioTracks() { return this.tracks.filter(t => t.kind === 'audio'); }
    addTrack(t: MediaStreamTrack) {
      this.tracks.push(t);
      addedTracks.push(t);
    }
  }

  // Without audio track: returns original video stream
  const rawVideoStream = new MockMediaStream([videoTrack]) as unknown as MediaStream;
  const silentStream = combineMediaStreamTracks(rawVideoStream, null);
  assert.equal(silentStream, rawVideoStream);

  // With audio track: combines into a single stream
  // Mock global MediaStream for test
  const originalMediaStream = (globalThis as any).MediaStream;
  (globalThis as any).MediaStream = MockMediaStream;
  try {
    const combined = combineMediaStreamTracks(rawVideoStream, audioTrack);
    assert.ok(combined.getVideoTracks().length >= 1);
    assert.ok(combined.getAudioTracks().length >= 1);
  } finally {
    (globalThis as any).MediaStream = originalMediaStream;
  }
});

// =============================================================================
// TASK D8B2 REQUIREMENT 14 TEST CASE:
// 16 players, Nhận bóng mở thân người, 90 minutes, 7v7 technical drill
// Full export verification with D8B2 hardening
// =============================================================================

test('D8B2 TEST CASE: 16 players, Nhận bóng mở thân người, 90 min, 7v7 technical drill video export hardening verification', () => {
  const diag = buildDefaultStructuredDiagram({
    gameFormat: '7v7',
    playerCount: 16,
    blockType: 'technical',
    topic: 'Nhận bóng mở thân người',
    execution: 'p1 chuyền cho p2, p2 kiểm tra vai mở thân người nhận bóng và chạm bước một chuyền sang p3',
  });

  assert.ok(diag.animation);
  const anim = diag.animation!;
  assert.ok(anim.duration >= 4);
  assert.ok(anim.coachingSequence);
  assert.deepEqual(anim.coachingSequence!.momentIds, ['coach1', 'coach2', 'coach3']);

  const moments = anim.coachingMoments!;
  assert.equal(moments.length, 3);
  const [c1, c2, c3] = moments;

  // 1. Best supported WebM codec selected correctly
  const codec = selectBestWebMCodec((mime) => mime.includes('webm'));
  assert.equal(codec.supported, true);
  assert.equal(codec.mimeType, 'video/webm;codecs=vp9');

  // 2. Deterministic frame count approximately totalDuration * 30 + final frame
  const totalDuration = calculateExportDuration(anim);
  const fps = 30;
  const totalFrames = Math.max(1, Math.round(totalDuration * fps));
  assert.ok(totalFrames >= 150); // >= 5s * 30fps

  // 3. Final frame safety: presentation time at totalFrames exactly matches totalDuration
  const finalFramePresTime = calculateFramePresentationTime(totalFrames, fps);
  assert.equal(finalFramePresTime, totalDuration);

  const finalMapping = mapPresentationTimeToTimeline(finalFramePresTime, anim, diag);
  assert.equal(finalMapping.drillTime, anim.duration, 'Final frame reaches animation.duration');
  assert.equal(finalMapping.isFrozen, false);

  // 4. Coaching freeze intervals remain strictly preserved
  const freeze1PresTime = c1.time + c1.duration * 0.5;
  const frameFreeze1 = mapPresentationTimeToTimeline(freeze1PresTime, anim, diag);
  assert.equal(frameFreeze1.drillTime, c1.time);
  assert.equal(frameFreeze1.isFrozen, true);
  assert.equal(frameFreeze1.activeMoment?.id, 'coach1');

  // 5. Narration timeline foundation produces 3 non-overlapping slots during hold phase
  const narrationSlots = buildNarrationTimeline(anim);
  assert.equal(narrationSlots.length, 3);
  assert.equal(narrationSlots[0].momentId, 'coach1');
  assert.equal(narrationSlots[1].momentId, 'coach2');
  assert.equal(narrationSlots[2].momentId, 'coach3');
  for (const slot of narrationSlots) {
    assert.ok(slot.startPresentationTime > 0);
    assert.ok(slot.duration >= 0.5);
    assert.ok(slot.text.length > 5);
  }

  // 6. MP4 capability strategy evaluation
  const mp4Cap = evaluateMediaExportCapability((m) => m.includes('webm'));
  assert.equal(mp4Cap.webm, true);
  assert.equal(mp4Cap.mp4Native, false);
  assert.equal(mp4Cap.mp4RequiresTranscode, true);

  // 7. Download filename is valid according to specification
  const filename = generateVideoFilename('Nhận bóng mở thân người');
  assert.equal(filename, 'coquinho-nhan-bong-mo-than-nguoi.webm');

  // 8. Pre-flight validation passes cleanly for this drill
  const preflight = validateExportPreconditions(diag, { fps: 30 }, (m) => m.includes('webm'));
  assert.equal(preflight.valid, true);
  assert.equal(preflight.totalDuration, totalDuration);
});
