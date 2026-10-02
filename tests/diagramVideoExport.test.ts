import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildNarrationTimeline,
  calculateExportDuration,
  calculateExportProgress,
  calculateFramePresentationTime,
  combineMediaStreamTracks,
  DEFAULT_VIDEO_BITS_PER_SECOND,
  detectPreferredNativeMp4Mime,
  evaluateMediaExportCapability,
  exportAndDownloadDiagramVideo,
  exportDiagramToVideoBlob,
  ExportVideoFormat,
  generateVideoFilename,
  getExportCoachingMoments,
  getRepresentationDisplayLabel,
  isBrowserVideoExportSupported,
  mapPresentationTimeToTimeline,
  PREFERRED_NATIVE_MP4_MIMES,
  PREFERRED_WEBM_CODECS,
  renderDiagramFrameToSvgString,
  safeStopMediaRecorder,
  scheduleBlobUrlCleanup,
  selectBestWebMCodec,
  selectExportFormat,
  slugifyTitle,
  validateExportPreconditions,
  VideoExportResult,
} from '../src/services/diagramVideoExport';
import {
  buildCoachingNarrationTimeline,
  createBrowserNarrationAudioProvider,
  CoachingNarrationItem,
  NarrationAudioProvider,
} from '../src/services/coachingNarration';
import {
  buildDefaultStructuredDiagram,
  buildSemanticAnimation,
  COACHING_ENTER_DURATION,
  COACHING_EXIT_DURATION,
  DEFAULT_POLISHED_MOTION_OPTIONS,
  getEffectiveCoachingDuration,
  interpolateAnimationState,
} from '../src/services/structuredDiagram';
import { DiagramAnimation, DiagramCoachingMoment, StructuredDrillDiagram } from '../src/types/session';

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
  // 1. Drill animation duration 8s, two coaching moments (short text -> 3.5s effective each) => total 15s
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
  assert.equal(total, 15.0);
  assert.equal(anim.duration, 8.0, 'Original animation.duration must NOT be mutated');
  assert.equal(anim.coachingMoments![0].duration, 2.0, 'Original coachingMoment.duration must NOT be mutated');
  assert.equal(anim.coachingMoments![1].duration, 2.0, 'Original coachingMoment.duration must NOT be mutated');

  // 2. Animation with sequence: honors sequence moments with effective durations (short text -> 3.5s each)
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

  // Only c1 (3.5s) and c2 (3.5s) are in the sequence => 6.0 + 3.5 + 3.5 = 13.0s
  assert.equal(calculateExportDuration(animWithSeq), 13.0);

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
  assert.equal(totalDuration, 12.0); // 8s drill + 4.0s effective coaching freeze (53 chars text)

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

  // 4. Hold phase of coaching freeze: t_pres = 4.0s (2.0s into freeze)
  const frame3 = mapPresentationTimeToTimeline(4.0, anim, diag);
  assert.equal(frame3.drillTime, 2.0, 'Drill time MUST remain frozen at 2.0s');
  assert.equal(frame3.isFrozen, true);
  assert.equal(frame3.activeMoment?.id, 'cm1');
  assert.equal(frame3.coachingElapsed, 2.0);
  assert.equal(frame3.phaseState?.phase, 'hold');
  assert.equal(frame3.phaseState?.cameraEase, 1.0);
  // Camera zoomed into player p2 at (600, 180) with zoom 2.0 => width=500, height=300 => minX=350, minY=30
  assert.equal(frame3.cameraViewBox, '350 30 500 300');
  // Ball position stays frozen mid-flight
  assert.equal(frame3.interpolatedState.balls[0].x, 40);

  // 5. End of coaching freeze / start of resumption: t_pres = 6.0s (2.0 + 4.0s)
  const frame4 = mapPresentationTimeToTimeline(6.0, anim, diag);
  assert.equal(frame4.drillTime, 2.0, 'Resumes from exact timestamp 2.0s');
  assert.equal(frame4.isFrozen, false);
  assert.equal(frame4.activeMoment, null);

  // 6. Resumed drill playback: t_pres = 8.0s (2.0s after freeze ended)
  // Drill has advanced by 2.0s from 2.0s => drillTime = 4.0s
  const frame5 = mapPresentationTimeToTimeline(8.0, anim, diag);
  assert.equal(frame5.drillTime, 4.0);
  assert.equal(frame5.isFrozen, false);
  assert.equal(frame5.activeMoment, null);
  assert.equal(frame5.cameraViewBox, '0 0 1000 600');

  // 7. Final frame: t_pres = 12.0s => drillTime = 8.0s (animation duration)
  const frameFinal = mapPresentationTimeToTimeline(12.0, anim, diag);
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
  // Enter delay is 0.7s (COACHING_ENTER_DURATION) => narration starts at 2.0 + 0.7 = 2.7s (during hold phase)
  assert.equal(slots[0].id, 'narr-c1');
  assert.equal(slots[0].momentId, 'c1');
  assert.equal(slots[0].startPresentationTime, 2.7);
  assert.equal(slots[0].duration, 2.1); // 3.5s total - 0.7s enter - 0.7s exit = 2.1s hold
  assert.equal(slots[0].text, 'Kiểm tra vai trước khi đón bóng');

  // Slot 2: Moment 2 drill time is 5.0s.
  // Moment 1 effective presentation is 3.5s => Moment 2 starts at pres time 2.0 + 3.5 + (5.0 - 2.0) = 8.5s!
  // Enter delay is 0.7s => narration starts at 8.5 + 0.7 = 9.2s
  assert.equal(slots[1].id, 'narr-c2');
  assert.equal(slots[1].momentId, 'c2');
  assert.equal(slots[1].startPresentationTime, 9.2);
  assert.equal(slots[1].duration, 2.1);
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

test('FIX-A: interactive playback and exported video use identical effective duration', () => {
  const cm: DiagramCoachingMoment = {
    id: 'coach-consistency',
    time: 3.0,
    duration: 1.5, // stored duration
    playerId: 'p1',
    title: 'Kiểm tra vai',
    text: 'Quan sát và kiểm tra vai trước khi đón bóng từ đồng đội',
  };

  const anim: DiagramAnimation = {
    duration: 10.0,
    steps: [{ id: 's1', start: 0, duration: 5, actions: [] }],
    coachingMoments: [cm],
  };

  const diag: StructuredDrillDiagram = {
    pitch: { width: 100, height: 60 },
    players: [{ id: 'p1', team: 'blue', x: 30, y: 30 }],
    balls: [],
    cones: [],
    goals: [],
    zones: [],
    paths: [],
    animation: anim,
  };

  // 1. Both derive exact same effective duration
  const interactiveDuration = getEffectiveCoachingDuration(cm);
  assert.ok(interactiveDuration >= 3.5);
  assert.equal(cm.duration, 1.5, 'Stored duration was not modified');

  // 2. Export duration incorporates exact same effective duration
  const exportDuration = calculateExportDuration(anim);
  assert.equal(exportDuration, Math.round((anim.duration + interactiveDuration) * 100) / 100);

  // 3. Presentation timeline freezes for exact same duration
  const presTrigger = 3.0; // drillTime = 3.0
  const mappingTrigger = mapPresentationTimeToTimeline(presTrigger, anim, diag);
  assert.equal(mappingTrigger.isFrozen, true);
  assert.equal(mappingTrigger.activeMoment?.id, 'coach-consistency');

  // At end of freeze
  const mappingEnd = mapPresentationTimeToTimeline(presTrigger + interactiveDuration, anim, diag);
  assert.equal(mappingEnd.isFrozen, false);
  assert.equal(mappingEnd.drillTime, 3.0);

  // 4. Narration timeline uses exact same effective duration and starts at enter transition
  const narrSlots = buildNarrationTimeline(anim);
  assert.equal(narrSlots.length, 1);
  assert.equal(narrSlots[0].startPresentationTime, presTrigger + COACHING_ENTER_DURATION);
  assert.equal(narrSlots[0].duration, Math.round((interactiveDuration - COACHING_ENTER_DURATION - COACHING_EXIT_DURATION) * 100) / 100);
});

// =============================================================================
// TASK REP-B TESTS: REPRESENTATIVE GROUP LABEL & VIDEO EXPORT INTEGRATION
// =============================================================================

test('REP-B: getRepresentationDisplayLabel derives primary and secondary display labels for representative-group mode', () => {
  // 1. 8 groups of 2 (pairs)
  const rep8Pairs = getRepresentationDisplayLabel({
    mode: 'representative-group',
    totalGroups: 8,
    playersPerGroup: 2,
    representedGroups: 1,
    label: '8 cặp thực hiện đồng thời',
  });
  assert.ok(rep8Pairs);
  assert.equal(rep8Pairs.primary, 'Minh họa 1/8 cặp');
  assert.equal(rep8Pairs.secondary, '8 cặp thực hiện đồng thời');

  // 2. 4 groups of 4 (groups)
  const rep4Groups = getRepresentationDisplayLabel({
    mode: 'representative-group',
    totalGroups: 4,
    playersPerGroup: 4,
    representedGroups: 1,
  });
  assert.ok(rep4Groups);
  assert.equal(rep4Groups.primary, 'Minh họa 1/4 nhóm');
  assert.equal(rep4Groups.secondary, '4 nhóm thực hiện đồng thời');

  // 3. 3 groups of 3 (groups)
  const rep3Groups = getRepresentationDisplayLabel({
    mode: 'representative-group',
    totalGroups: 3,
    playersPerGroup: 3,
    representedGroups: 1,
  });
  assert.ok(rep3Groups);
  assert.equal(rep3Groups.primary, 'Minh họa 1/3 nhóm');
  assert.equal(rep3Groups.secondary, '3 nhóm thực hiện đồng thời');

  // 4. Custom label is preserved when provided
  const repCustom = getRepresentationDisplayLabel({
    mode: 'representative-group',
    totalGroups: 6,
    playersPerGroup: 2,
    representedGroups: 1,
    label: '6 trạm chuyền bóng độc lập',
  });
  assert.ok(repCustom);
  assert.equal(repCustom.primary, 'Minh họa 1/6 cặp');
  assert.equal(repCustom.secondary, '6 trạm chuyền bóng độc lập');

  // 5. Returns null for mode: 'full' or undefined/null
  assert.equal(getRepresentationDisplayLabel(undefined), null);
  assert.equal(getRepresentationDisplayLabel(null), null);
  assert.equal(
    getRepresentationDisplayLabel({
      mode: 'full',
      totalGroups: 8,
      playersPerGroup: 2,
      representedGroups: 8,
    }),
    null
  );
});

test('REP-B: renderDiagramFrameToSvgString renders representative label in fixed overlay layer', () => {
  const repDiag: StructuredDrillDiagram = {
    pitch: { width: 100, height: 60 },
    players: [
      { id: 'p1', team: 'blue', role: 'passer', x: 32, y: 30 },
      { id: 'p2', team: 'blue', role: 'receiver', x: 68, y: 30 },
    ],
    balls: [{ id: 'b1', x: 36, y: 30 }],
    cones: [
      { id: 'c1', x: 50, y: 22 },
      { id: 'c2', x: 50, y: 38 },
    ],
    goals: [],
    zones: [],
    paths: [{ id: 'path1', type: 'pass', fromPlayerId: 'p1', toPlayerId: 'p2' }],
    representation: {
      mode: 'representative-group',
      totalGroups: 8,
      playersPerGroup: 2,
      representedGroups: 1,
      label: '8 cặp thực hiện đồng thời',
    },
    animation: {
      duration: 5.0,
      steps: [
        {
          id: 'step1',
          start: 0,
          duration: 2.5,
          actions: [{ type: 'ballPass', ballId: 'b1', fromPlayerId: 'p1', toPlayerId: 'p2' }],
        },
      ],
      coachingMoments: [
        {
          id: 'cm-rep',
          time: 1.5,
          duration: 2.0,
          playerId: 'p2',
          title: 'Mở thân người',
          text: 'Mở thân người trước khi nhận bóng',
          orientation: 45,
          focus: { zoom: 2.0 },
        },
      ],
    },
  };

  const anim = repDiag.animation!;

  // 1. Normal running frame: representative badge is rendered in SVG overlay
  const normalMapping = mapPresentationTimeToTimeline(0.5, anim, repDiag);
  const normalSvg = renderDiagramFrameToSvgString(repDiag, normalMapping, 1200, 720);

  assert.ok(normalSvg.includes('class="representation-badge-overlay"'), 'SVG must include representation-badge-overlay');
  assert.ok(normalSvg.includes('Minh họa 1/8 cặp'), 'SVG must include primary representation text');
  assert.ok(normalSvg.includes('8 cặp thực hiện đồng thời'), 'SVG must include secondary representation text');

  // Verify exported SVG only contains representative players (p1, p2) and b1
  assert.ok(normalSvg.includes('>1</text>') || normalSvg.includes('>P1</text>'), 'Contains player 1');
  assert.ok(normalSvg.includes('>2</text>') || normalSvg.includes('>P2</text>'), 'Contains player 2');
  assert.ok(!normalSvg.includes('>3</text>') && !normalSvg.includes('>P3</text>'), 'Must NOT regenerate player 3');
  assert.ok(!normalSvg.includes('>16</text>') && !normalSvg.includes('>P16</text>'), 'Must NOT regenerate player 16');

  // 2. Frozen coaching moment frame with camera zoom:
  // Representative label stays in fixed screen coordinates outside zooming tactical SVG
  const frozenMapping = mapPresentationTimeToTimeline(2.0, anim, repDiag);
  assert.equal(frozenMapping.isFrozen, true);
  assert.notEqual(frozenMapping.cameraViewBox, '0 0 1000 600', 'Camera must be zoomed');

  const frozenSvg = renderDiagramFrameToSvgString(repDiag, frozenMapping, 1200, 720);
  assert.ok(frozenSvg.includes('class="representation-badge-overlay"'), 'Badge must remain visible during coaching zoom');
  assert.ok(frozenSvg.includes('Minh họa 1/8 cặp'), 'Badge text intact during coaching zoom');
  assert.ok(frozenSvg.includes('class="coaching-card-overlay"'), 'Coaching card is also rendered');

  // Visual priority check: coaching card is rendered after representation badge in SVG document order
  const badgeIdx = frozenSvg.indexOf('representation-badge-overlay');
  const coachIdx = frozenSvg.indexOf('coaching-card-overlay');
  assert.ok(badgeIdx >= 0 && coachIdx >= 0 && badgeIdx < coachIdx, 'Coaching card has higher visual priority in SVG stack');
});

test('REP-B: renderDiagramFrameToSvgString does not render representative badge for full diagrams', () => {
  const fullDiag: StructuredDrillDiagram = {
    pitch: { width: 100, height: 60 },
    players: [
      { id: 'p1', team: 'blue', x: 20, y: 30 },
      { id: 'p2', team: 'red', x: 60, y: 30 },
    ],
    balls: [{ id: 'b1', x: 20, y: 30 }],
    cones: [],
    goals: [],
    zones: [],
    paths: [],
    representation: {
      mode: 'full',
      totalGroups: 1,
      playersPerGroup: 2,
      representedGroups: 1,
    },
    animation: {
      duration: 4.0,
      steps: [],
    },
  };

  const anim = fullDiag.animation!;
  const mapping = mapPresentationTimeToTimeline(1.0, anim, fullDiag);
  const svg = renderDiagramFrameToSvgString(fullDiag, mapping, 1200, 720);

  assert.ok(!svg.includes('class="representation-badge-overlay"'), 'Full mode diagram must not render representation badge');
});

test('REP-B TEST CASE: 16 players, Nhận bóng mở thân người, 90 min, 7v7 representative pair video export end-to-end', () => {
  // Build representative pair diagram for the canonical 16-player unopposed drill
  const repDiagram = buildDefaultStructuredDiagram({
    blockType: 'warm_up',
    playerCount: 16,
    playerOrganization: { groups: 8, playersPerGroup: 2, leftover: 0, leftoverRole: 'none' },
    organization: '16 cầu thủ chia thành 8 cặp chuyền và nhận bóng mở thân người không đối kháng',
    execution: 'p1 chuyền cho p2, p2 mở thân người',
    topic: 'Nhận bóng mở thân người',
    representationMode: 'representative-group',
  });

  assert.equal(repDiagram.representation?.mode, 'representative-group');
  assert.equal(repDiagram.representation?.totalGroups, 8);
  assert.equal(repDiagram.representation?.playersPerGroup, 2);
  assert.equal(repDiagram.representation?.representedGroups, 1);
  assert.equal(repDiagram.players.length, 2);

  // Pre-flight validation
  const preflight = validateExportPreconditions(repDiagram, { fps: 30 }, (m) => m.includes('webm'));
  assert.equal(preflight.valid, true, `Preconditions must pass: ${preflight.error}`);

  // Frame rendering check
  const anim = repDiagram.animation!;
  const mapping = mapPresentationTimeToTimeline(0.5, anim, repDiagram);
  const svg = renderDiagramFrameToSvgString(repDiagram, mapping, 1200, 720);

  assert.ok(svg.includes('class="representation-badge-overlay"'));
  assert.ok(svg.includes('Minh họa 1/8 cặp'));
  assert.ok(svg.includes('8 cặp thực hiện đồng thời'));
  assert.equal(mapping.interpolatedState.players.length, 2);
  assert.equal(mapping.interpolatedState.balls.length, 1);
});

// =============================================================================
// TASK TTS-A3b: MOCK BROWSER INFRASTRUCTURE & TESTS FOR NARRATION VIDEO EXPORT
// =============================================================================

class MockAudioBuffer {
  duration: number;
  sampleRate = 44100;
  numberOfChannels = 1;
  length: number;
  constructor(options: { duration: number }) {
    this.duration = options.duration;
    this.length = Math.round(this.duration * this.sampleRate);
  }
}

class MockAudioBufferSourceNode {
  buffer: any = null;
  loop = false;
  state = 'idle';
  connect(dest: any) { return dest; }
  disconnect() {}
  start() { this.state = 'started'; }
  stop() { this.state = 'stopped'; }
}

class MockGainNode {
  gain = { value: 1.0, setValueAtTime: (v: number) => { this.gain.value = v; } };
  connect(dest: any) { return dest; }
  disconnect() {}
}

class MockAudioDestinationNode {
  stream = new MockMediaStream([new MockMediaStreamTrack('audio')]);
  connect(dest: any) { return dest; }
  disconnect() {}
}

class MockAudioContext {
  currentTime = 0;
  state: AudioContextState = 'running';
  createBufferSource() { return new MockAudioBufferSourceNode(); }
  createGain() { return new MockGainNode(); }
  createMediaStreamDestination() { return new MockAudioDestinationNode(); }
  async close() { this.state = 'closed'; }
  async resume() { this.state = 'running'; }
}

class MockMediaStreamTrack {
  kind: string;
  readyState: 'live' | 'ended' = 'live';
  id = 'track-' + Math.random().toString(36).substring(2, 9);
  constructor(kind: string = 'video') {
    this.kind = kind;
  }
  stop() {
    this.readyState = 'ended';
  }
}

class MockMediaStream {
  tracks: MockMediaStreamTrack[] = [];
  constructor(tracks?: MockMediaStreamTrack[]) {
    if (tracks) this.tracks = [...tracks];
  }
  getVideoTracks() { return this.tracks.filter((t) => t.kind === 'video'); }
  getAudioTracks() { return this.tracks.filter((t) => t.kind === 'audio'); }
  getTracks() { return [...this.tracks]; }
  addTrack(t: MockMediaStreamTrack) { this.tracks.push(t); }
}

class MockMediaRecorder {
  static isTypeSupported(mime: string) { return mime.includes('webm'); }
  stream: MockMediaStream;
  options: any;
  state: 'inactive' | 'recording' | 'paused' = 'inactive';
  mimeType = 'video/webm;codecs=vp9';
  ondataavailable: ((e: any) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: ((e: any) => void) | null = null;
  static lastCreatedInstance: MockMediaRecorder | null = null;

  constructor(stream: MockMediaStream, options?: any) {
    this.stream = stream;
    this.options = options;
    if (options && options.mimeType) {
      this.mimeType = options.mimeType;
    }
    MockMediaRecorder.lastCreatedInstance = this;
  }

  start(_timeslice?: number) {
    this.state = 'recording';
    if (this.ondataavailable) {
      this.ondataavailable({ data: new Blob(['mock-webm'], { type: this.mimeType }) });
    }
  }

  requestData() {
    if (this.ondataavailable) {
      this.ondataavailable({ data: new Blob(['mock-chunk'], { type: this.mimeType }) });
    }
  }

  stop() {
    this.state = 'inactive';
    if (this.onstop) {
      this.onstop();
    }
  }
}

function setupMockExportEnvironment(customIsTypeSupported?: (mime: string) => boolean) {
  const origWindow = (globalThis as any).window;
  const origDocument = (globalThis as any).document;
  const origMediaRecorder = (globalThis as any).MediaRecorder;
  const origMediaStream = (globalThis as any).MediaStream;
  const origImage = (globalThis as any).Image;
  const origURL = (globalThis as any).URL;
  const origAudioContext = (globalThis as any).AudioContext;
  const origSetTimeout = globalThis.setTimeout;
  const origIsTypeSupported = MockMediaRecorder.isTypeSupported;

  if (customIsTypeSupported) {
    MockMediaRecorder.isTypeSupported = customIsTypeSupported;
  }

  class MockImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_val: string) {
      if (this.onload) {
        this.onload();
      }
    }
  }

  const mockCanvas = {
    width: 1200,
    height: 720,
    getContext: () => ({
      clearRect: () => {},
      drawImage: () => {},
    }),
    captureStream: () => new MockMediaStream([new MockMediaStreamTrack('video')]),
  };

  (globalThis as any).MediaStream = MockMediaStream;
  (globalThis as any).MediaRecorder = MockMediaRecorder;
  (globalThis as any).Image = MockImage;
  (globalThis as any).AudioContext = MockAudioContext;
  (globalThis as any).window = {
    MediaRecorder: MockMediaRecorder,
    MediaStream: MockMediaStream,
    AudioContext: MockAudioContext,
  };
  (globalThis as any).document = {
    createElement: (tag: string) => {
      if (tag === 'canvas') return mockCanvas;
      return {};
    },
  };
  (globalThis as any).URL.createObjectURL = () => 'blob:http://localhost:3000/mock';
  (globalThis as any).URL.revokeObjectURL = () => {};

  // Accelerate frame pacing for test speed
  (globalThis as any).setTimeout = ((handler: any, _ms?: number, ...args: any[]) => {
    return origSetTimeout(handler, 0, ...args);
  }) as any;

  return () => {
    MockMediaRecorder.isTypeSupported = origIsTypeSupported;
    (globalThis as any).window = origWindow;
    (globalThis as any).document = origDocument;
    (globalThis as any).MediaRecorder = origMediaRecorder;
    (globalThis as any).MediaStream = origMediaStream;
    (globalThis as any).Image = origImage;
    (globalThis as any).URL = origURL;
    (globalThis as any).AudioContext = origAudioContext;
    globalThis.setTimeout = origSetTimeout;
  };
}

// =============================================================================
// TASK TTS-A3b TESTS: NARRATION AUDIO INTEGRATION INTO VIDEO EXPORT
// =============================================================================

test('TTS-A3b: narration preparation before export requests items in coaching order', async () => {
  const restoreEnv = setupMockExportEnvironment();
  try {
    const repDiagram = buildDefaultStructuredDiagram({
      blockType: 'warm_up',
      playerCount: 16,
      playerOrganization: { groups: 8, playersPerGroup: 2, leftover: 0, leftoverRole: 'none' },
      organization: '16 cầu thủ chia thành 8 nhóm 2',
      topic: 'Nhận bóng mở thân người',
      representationMode: 'representative-group',
    });

    const requestedItems: string[] = [];
    const provider: NarrationAudioProvider = async (item) => {
      requestedItems.push(item.text);
      return new MockAudioBuffer({ duration: 1.5 }) as unknown as AudioBuffer;
    };

    let statusEmitted = '';
    const controller = exportDiagramToVideoBlob(repDiagram, {
      narrationProvider: provider,
      onNarrationStatus: (s) => {
        statusEmitted = s;
      },
    });

    const result = await controller.promise;
    assert.ok(result);

    // Verify exactly 3 narration items requested in coaching order
    assert.equal(requestedItems.length, 3);
    assert.equal(requestedItems[0], 'Kiểm tra vai trước khi bóng đến.');
    assert.equal(requestedItems[1], 'Mở thân người về hướng chơi tiếp theo.');
    assert.equal(requestedItems[2], 'Chạm bước một đưa bóng vào khoảng trống.');

    // Verify narration status UI was emitted
    assert.equal(statusEmitted, 'Đang chuẩn bị giọng đọc...');
  } finally {
    restoreEnv();
  }
});

test('TTS-A3b: narration audio track passed into recorder MediaStream (video + audio)', async () => {
  const restoreEnv = setupMockExportEnvironment();
  try {
    const repDiagram = buildDefaultStructuredDiagram({
      blockType: 'warm_up',
      playerCount: 16,
      playerOrganization: { groups: 8, playersPerGroup: 2, leftover: 0, leftoverRole: 'none' },
      organization: '16 cầu thủ chia thành 8 nhóm 2',
      topic: 'Nhận bóng mở thân người',
      representationMode: 'representative-group',
    });

    const provider: NarrationAudioProvider = async () =>
      new MockAudioBuffer({ duration: 1.5 }) as unknown as AudioBuffer;

    const controller = exportDiagramToVideoBlob(repDiagram, {
      narrationProvider: provider,
    });

    const result = await controller.promise;
    assert.ok(result);

    // Verify result metadata
    assert.equal(result.hasAudio, true, 'Result must indicate hasAudio = true');

    // Verify recorder stream included audio track
    const recorderInstance = MockMediaRecorder.lastCreatedInstance;
    assert.ok(recorderInstance);
    assert.ok(recorderInstance.stream.getVideoTracks().length >= 1, 'Stream must have video track');
    assert.ok(recorderInstance.stream.getAudioTracks().length === 1, 'Stream must have exactly 1 audio track');
  } finally {
    restoreEnv();
  }
});

test('TTS-A3b: silent fallback on total TTS failure or missing provider', async () => {
  const restoreEnv = setupMockExportEnvironment();
  try {
    const repDiagram = buildDefaultStructuredDiagram({
      blockType: 'warm_up',
      playerCount: 16,
      playerOrganization: { groups: 8, playersPerGroup: 2, leftover: 0, leftoverRole: 'none' },
      organization: '16 cầu thủ chia thành 8 nhóm 2',
      topic: 'Nhận bóng mở thân người',
      representationMode: 'representative-group',
    });

    // Provider fails for all items
    const failProvider: NarrationAudioProvider = async () => null;

    let warningEmitted = '';
    const controller = exportDiagramToVideoBlob(repDiagram, {
      narrationProvider: failProvider,
      onNarrationWarning: (w) => {
        warningEmitted = w;
      },
    });

    const result = await controller.promise;
    assert.ok(result, 'Video export must still succeed without audio');
    assert.equal(result.hasAudio, false, 'hasAudio must be false on silent fallback');

    // Verify warning message
    assert.equal(warningEmitted, 'Không thể tạo giọng đọc. Video sẽ được xuất không có âm thanh.');

    // Verify recorder stream has only video track
    const recorderInstance = MockMediaRecorder.lastCreatedInstance;
    assert.ok(recorderInstance);
    assert.equal(recorderInstance.stream.getAudioTracks().length, 0, 'Stream must have 0 audio tracks');
  } finally {
    restoreEnv();
  }
});

test('TTS-A3b: partial narration success retains available audio track', async () => {
  const restoreEnv = setupMockExportEnvironment();
  try {
    const repDiagram = buildDefaultStructuredDiagram({
      blockType: 'warm_up',
      playerCount: 16,
      playerOrganization: { groups: 8, playersPerGroup: 2, leftover: 0, leftoverRole: 'none' },
      organization: '16 cầu thủ chia thành 8 nhóm 2',
      topic: 'Nhận bóng mở thân người',
      representationMode: 'representative-group',
    });

    // Clip 2 fails, clips 1 and 3 succeed
    const partialProvider: NarrationAudioProvider = async (item) => {
      if (item.coachingMomentId === 'coach2') return null;
      return new MockAudioBuffer({ duration: 1.5 }) as unknown as AudioBuffer;
    };

    const controller = exportDiagramToVideoBlob(repDiagram, {
      narrationProvider: partialProvider,
    });

    const result = await controller.promise;
    assert.ok(result);
    assert.equal(result.hasAudio, true, 'Partial success must still retain audio');

    const recorderInstance = MockMediaRecorder.lastCreatedInstance;
    assert.ok(recorderInstance);
    assert.equal(recorderInstance.stream.getAudioTracks().length, 1);
  } finally {
    restoreEnv();
  }
});

test('TTS-A3b: cancellation during narration preparation halts export and cleans resources', async () => {
  const restoreEnv = setupMockExportEnvironment();
  try {
    const repDiagram = buildDefaultStructuredDiagram({
      blockType: 'warm_up',
      playerCount: 16,
      playerOrganization: { groups: 8, playersPerGroup: 2, leftover: 0, leftoverRole: 'none' },
      organization: '16 cầu thủ chia thành 8 nhóm 2',
      topic: 'Nhận bóng mở thân người',
      representationMode: 'representative-group',
    });

    let controllerRef: any = null;
    let providerCalled = false;

    const slowProvider: NarrationAudioProvider = async () => {
      providerCalled = true;
      // Allow controller assignment to complete before triggering cancel
      await new Promise((r) => setTimeout(r, 5));
      if (controllerRef) {
        controllerRef.cancel();
      }
      return new MockAudioBuffer({ duration: 1.5 }) as unknown as AudioBuffer;
    };

    const controller = exportDiagramToVideoBlob(repDiagram, {
      narrationProvider: slowProvider,
    });
    controllerRef = controller;

    const result = await controller.promise;
    assert.equal(result, null, 'Cancelled export must resolve to null');
    assert.equal(providerCalled, true);

    // Repeated cancel must not throw
    assert.doesNotThrow(() => {
      controller.cancel();
    });
  } finally {
    restoreEnv();
  }
});

test('TTS-A3b: cancellation during recording stops audio and video tracks', async () => {
  const restoreEnv = setupMockExportEnvironment();
  try {
    const repDiagram = buildDefaultStructuredDiagram({
      blockType: 'warm_up',
      playerCount: 16,
      playerOrganization: { groups: 8, playersPerGroup: 2, leftover: 0, leftoverRole: 'none' },
      organization: '16 cầu thủ chia thành 8 nhóm 2',
      topic: 'Nhận bóng mở thân người',
      representationMode: 'representative-group',
    });

    const provider: NarrationAudioProvider = async () =>
      new MockAudioBuffer({ duration: 1.5 }) as unknown as AudioBuffer;

    let controllerRef: any = null;
    const controller = exportDiagramToVideoBlob(repDiagram, {
      narrationProvider: provider,
      onProgress: (p) => {
        if (p.stage === 'rendering' && p.frame === 0) {
          controllerRef.cancel();
        }
      },
    });
    controllerRef = controller;

    const result = await controller.promise;
    assert.equal(result, null, 'Must resolve to null when cancelled during recording');

    // Verify recorder stopped
    const recorderInstance = MockMediaRecorder.lastCreatedInstance;
    assert.ok(recorderInstance);
    assert.equal(recorderInstance.state, 'inactive');
  } finally {
    restoreEnv();
  }
});

test('TTS-A3b: cleanup after successful export terminates audio track and does not leak', async () => {
  const restoreEnv = setupMockExportEnvironment();
  try {
    const repDiagram = buildDefaultStructuredDiagram({
      blockType: 'warm_up',
      playerCount: 16,
      playerOrganization: { groups: 8, playersPerGroup: 2, leftover: 0, leftoverRole: 'none' },
      organization: '16 cầu thủ chia thành 8 nhóm 2',
      topic: 'Nhận bóng mở thân người',
      representationMode: 'representative-group',
    });

    const provider: NarrationAudioProvider = async () =>
      new MockAudioBuffer({ duration: 1.5 }) as unknown as AudioBuffer;

    const controller = exportDiagramToVideoBlob(repDiagram, {
      narrationProvider: provider,
    });

    const result = await controller.promise;
    assert.ok(result);

    // Verify stream tracks were stopped
    const recorderInstance = MockMediaRecorder.lastCreatedInstance;
    assert.ok(recorderInstance);
    const audioTracks = recorderInstance.stream.getAudioTracks();
    assert.equal(audioTracks.length, 1);
    assert.equal(audioTracks[0].readyState, 'ended', 'Audio track must be ended after export');
  } finally {
    restoreEnv();
  }
});

test('TTS-A3b: timeline consistency: export duration and freeze timing remain unchanged with audio', () => {
  const repDiagram = buildDefaultStructuredDiagram({
    blockType: 'warm_up',
    playerCount: 16,
    playerOrganization: { groups: 8, playersPerGroup: 2, leftover: 0, leftoverRole: 'none' },
    organization: '16 cầu thủ chia thành 8 nhóm 2',
    topic: 'Nhận bóng mở thân người',
    representationMode: 'representative-group',
  });

  const anim = repDiagram.animation!;
  const exportDurationWithoutAudio = calculateExportDuration(anim);
  const narrationItems = buildCoachingNarrationTimeline(anim);

  // Verify narration does not extend video duration
  for (const item of narrationItems) {
    const itemEnd = item.startPresentationTime + item.maxDuration;
    assert.ok(
      itemEnd <= exportDurationWithoutAudio,
      `Item end (${itemEnd}) must be <= total export duration (${exportDurationWithoutAudio})`
    );
  }

  // Verify coaching freeze timing
  const moments = anim.coachingMoments!;
  assert.equal(moments.length, 3);
  for (let i = 0; i < moments.length; i++) {
    const m = moments[i];
    const n = narrationItems[i];
    // Narration starts after enter delay in hold phase
    assert.ok(n.startPresentationTime > m.time);
  }
});

test('TTS-A3b TEST CASE: 16 players, 8 groups of 2, Nhận bóng mở thân người full 10-point verification', async () => {
  const restoreEnv = setupMockExportEnvironment();
  try {
    const repDiagram = buildDefaultStructuredDiagram({
      blockType: 'warm_up',
      playerCount: 16,
      playerOrganization: { groups: 8, playersPerGroup: 2, leftover: 0, leftoverRole: 'none' },
      organization: '16 cầu thủ chia thành 8 nhóm 2',
      topic: 'Nhận bóng mở thân người',
      representationMode: 'representative-group',
    });

    const anim = repDiagram.animation!;
    assert.ok(anim && anim.coachingMoments);

    // Point 1: exactly 3 narration items requested
    const calledItems: CoachingNarrationItem[] = [];
    const provider: NarrationAudioProvider = async (item) => {
      calledItems.push(item);
      return new MockAudioBuffer({ duration: 1.8 }) as unknown as AudioBuffer;
    };

    const controller = exportDiagramToVideoBlob(repDiagram, {
      narrationProvider: provider,
    });

    const result = await controller.promise;
    assert.ok(result, 'Must export video');

    // Point 1 & 2: exactly 3 narration items requested in coaching order
    assert.equal(calledItems.length, 3, 'Point 1: exactly 3 narration items requested');
    assert.equal(calledItems[0].coachingMomentId, 'coach1', 'Point 2: first item is coach1 (Kiểm tra vai)');
    assert.equal(calledItems[1].coachingMomentId, 'coach2', 'Point 2: second item is coach2 (Mở thân người)');
    assert.equal(calledItems[2].coachingMomentId, 'coach3', 'Point 2: third item is coach3 (Chạm bước một)');

    // Point 3 & 4: narration audio track passed to video export & recorder stream includes audio
    assert.equal(result.hasAudio, true, 'Point 3: exportResult hasAudio is true');
    const recorderInstance = MockMediaRecorder.lastCreatedInstance;
    assert.ok(recorderInstance);
    assert.equal(recorderInstance.stream.getAudioTracks().length, 1, 'Point 4: recorder stream includes 1 audio track');

    // Point 5: export timeline is unchanged
    const expectedDuration = calculateExportDuration(anim);
    assert.equal(result.duration, expectedDuration, 'Point 5: export duration matches calculation exactly');

    // Point 6: coaching freezes remain unchanged
    const m1Mapping = mapPresentationTimeToTimeline(calledItems[0].startPresentationTime, anim, repDiagram);
    assert.equal(m1Mapping.isFrozen, true, 'Point 6: drill is frozen during coaching moment hold phase');

    // Point 7: partial provider failure still exports remaining audio
    const partialProvider: NarrationAudioProvider = async (item) => {
      if (item.coachingMomentId === 'coach2') return null;
      return new MockAudioBuffer({ duration: 1.5 }) as unknown as AudioBuffer;
    };
    const partialController = exportDiagramToVideoBlob(repDiagram, { narrationProvider: partialProvider });
    const partialResult = await partialController.promise;
    assert.ok(partialResult);
    assert.equal(partialResult.hasAudio, true, 'Point 7: partial provider failure still produces audio track');

    // Point 8: total TTS failure exports silent WebM
    let warnCaptured = '';
    const failController = exportDiagramToVideoBlob(repDiagram, {
      narrationProvider: async () => null,
      onNarrationWarning: (w) => { warnCaptured = w; },
    });
    const failResult = await failController.promise;
    assert.ok(failResult);
    assert.equal(failResult.hasAudio, false, 'Point 8: total TTS failure exports silent WebM');
    assert.ok(warnCaptured.includes('Video sẽ được xuất không có âm thanh'), 'Point 8: warning emitted');

    // Point 9: cancel cleans both audio and video resources
    let cancelCtrlRef: any = null;
    const cancelController = exportDiagramToVideoBlob(repDiagram, {
      narrationProvider: provider,
      onProgress: (p) => {
        if (p.stage === 'rendering') cancelCtrlRef.cancel();
      },
    });
    cancelCtrlRef = cancelController;
    const cancelResult = await cancelController.promise;
    assert.equal(cancelResult, null, 'Point 9: cancel resolves to null');

    // Point 10: full-mode diagrams still export normally
    const fullDiag = buildDefaultStructuredDiagram({
      blockType: 'warm_up',
      playerCount: 16,
      playerOrganization: { groups: 8, playersPerGroup: 2, leftover: 0, leftoverRole: 'none' },
      organization: '16 cầu thủ chia thành 8 nhóm 2',
      topic: 'Nhận bóng mở thân người',
      representationMode: 'full',
    });
    const fullController = exportDiagramToVideoBlob(fullDiag, { narrationProvider: provider });
    const fullResult = await fullController.promise;
    assert.ok(fullResult, 'Point 10: full-mode diagram exports successfully');
    assert.equal(fullResult.hasAudio, true, 'Point 10: full-mode diagram includes audio');
  } finally {
    restoreEnv();
  }
});

// =============================================================================
// TASK MP4-A1 TESTS: NATIVE MP4 VIDEO EXPORT & SAFE WEBM FALLBACK
// =============================================================================

test('MP4-A1: detectPreferredNativeMp4Mime tests preferred MIME ordering and unsupported handling', () => {
  // 1. Highest priority: video/mp4;codecs=h264,aac
  const withH264Aac = detectPreferredNativeMp4Mime((mime) =>
    mime === 'video/mp4;codecs=h264,aac' || mime === 'video/mp4'
  );
  assert.equal(withH264Aac, 'video/mp4;codecs=h264,aac');

  // 2. Second priority: video/mp4;codecs=avc1.42E01E,mp4a.40.2
  const withAvc1Audio = detectPreferredNativeMp4Mime((mime) =>
    mime === 'video/mp4;codecs=avc1.42E01E,mp4a.40.2' || mime === 'video/mp4'
  );
  assert.equal(withAvc1Audio, 'video/mp4;codecs=avc1.42E01E,mp4a.40.2');

  // 3. Fallback priority: video/mp4
  const withBasicMp4 = detectPreferredNativeMp4Mime((mime) => mime === 'video/mp4');
  assert.equal(withBasicMp4, 'video/mp4');

  // 4. Unsupported MP4: returns null
  const unsupported = detectPreferredNativeMp4Mime((mime) => mime.includes('webm'));
  assert.equal(unsupported, null);

  // 5. Missing environment / no function: returns null
  const noEnv = detectPreferredNativeMp4Mime(undefined);
  assert.equal(noEnv, null);

  // 6. Preferred candidate list order integrity
  assert.deepEqual(PREFERRED_NATIVE_MP4_MIMES, [
    'video/mp4;codecs=h264,aac',
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1',
    'video/mp4;codecs=h264',
    'video/mp4',
  ]);
});

test('MP4-A1: selectExportFormat deterministic format selection behavior', () => {
  const mockSupportMp4AndWebm = (mime: string) => mime.includes('webm') || mime === 'video/mp4;codecs=h264,aac';
  const mockSupportWebmOnly = (mime: string) => mime.includes('webm');

  // 1. Explicit MP4 requested and native MP4 supported
  const mp4Ok = selectExportFormat('mp4', mockSupportMp4AndWebm);
  assert.equal(mp4Ok.format, 'mp4');
  assert.equal(mp4Ok.mimeType, 'video/mp4;codecs=h264,aac');
  assert.equal(mp4Ok.nativeMp4, true);
  assert.equal(mp4Ok.requiresTranscode, false);

  // 2. Explicit MP4 requested and native MP4 unsupported: fallback to WebM with clear warning
  const mp4Fallback = selectExportFormat('mp4', mockSupportWebmOnly);
  assert.equal(mp4Fallback.format, 'webm');
  assert.equal(mp4Fallback.nativeMp4, false);
  assert.equal(mp4Fallback.requiresTranscode, true);
  assert.ok(mp4Fallback.warning && mp4Fallback.warning.includes('WebM'));

  // 3. Default export without explicit format: preserves WebM behavior unchanged
  const defaultExport = selectExportFormat(undefined, mockSupportMp4AndWebm);
  assert.equal(defaultExport.format, 'webm');
  assert.equal(defaultExport.requiresTranscode, false);

  // 4. Explicit WebM requested: preserves WebM
  const webmExplicit = selectExportFormat('webm', mockSupportMp4AndWebm);
  assert.equal(webmExplicit.format, 'webm');
  assert.equal(webmExplicit.requiresTranscode, false);
});

test('MP4-A1: generateVideoFilename handles .mp4 and .webm extension correctly', () => {
  // 1. Native MP4 filename
  assert.equal(
    generateVideoFilename('Nhận bóng mở thân người', 'mp4'),
    'coquinho-nhan-bong-mo-than-nguoi.mp4'
  );
  assert.equal(
    generateVideoFilename('Bài tập 3v3 + 2 Neutral (Kỹ năng)', 'mp4'),
    'coquinho-bai-tap-3v3-2-neutral-ky-nang.mp4'
  );

  // 2. WebM fallback and explicit WebM filename
  assert.equal(
    generateVideoFilename('Nhận bóng mở thân người', 'webm'),
    'coquinho-nhan-bong-mo-than-nguoi.webm'
  );

  // 3. Default without second argument preserves existing .webm filename
  assert.equal(
    generateVideoFilename('Nhận bóng mở thân người'),
    'coquinho-nhan-bong-mo-than-nguoi.webm'
  );

  // 4. Empty and undefined inputs
  assert.equal(generateVideoFilename('', 'mp4'), 'coquinho-giao-an-tap-luyen.mp4');
  assert.equal(generateVideoFilename(undefined, 'mp4'), 'coquinho-giao-an-tap-luyen.mp4');
  assert.equal(generateVideoFilename(''), 'coquinho-giao-an-tap-luyen.webm');
});

test('MP4-A1: evaluateMediaExportCapability reports mp4Native and mp4RequiresTranscode correctly', () => {
  // 1. Browser supports native MP4: mp4Native=true, mp4RequiresTranscode=false
  const capWithMp4 = evaluateMediaExportCapability((mime) =>
    mime.includes('webm') || mime === 'video/mp4;codecs=h264,aac'
  );
  assert.equal(capWithMp4.webm, true);
  assert.equal(capWithMp4.mp4Native, true);
  assert.equal(capWithMp4.mp4NativeCodec, 'video/mp4;codecs=h264,aac');
  assert.equal(capWithMp4.mp4RequiresTranscode, false);

  // 2. Browser does NOT support native MP4: mp4Native=false, mp4RequiresTranscode=true
  const capWithoutMp4 = evaluateMediaExportCapability((mime) => mime.includes('webm'));
  assert.equal(capWithoutMp4.webm, true);
  assert.equal(capWithoutMp4.mp4Native, false);
  assert.equal(capWithoutMp4.mp4NativeCodec, undefined);
  assert.equal(capWithoutMp4.mp4RequiresTranscode, true);
});

test('MP4-A1 (Test Case A): Browser supports video/mp4;codecs=h264,aac -> exports native MP4 with preserved narration audio', async () => {
  const restoreEnv = setupMockExportEnvironment((mime: string) =>
    mime.includes('webm') || mime === 'video/mp4;codecs=h264,aac' || mime === 'video/mp4'
  );

  try {
    const diag = buildDefaultStructuredDiagram({
      blockType: 'technical',
      playerCount: 16,
      topic: 'Nhận bóng mở thân người',
      execution: 'p1 chuyền bóng cho p2, p2 mở góc đón bóng',
    });

    const provider: NarrationAudioProvider = async (_item: CoachingNarrationItem) => {
      return new MockAudioBuffer({ duration: 1.5 }) as unknown as AudioBuffer;
    };

    const controller = exportDiagramToVideoBlob(diag, {
      format: 'mp4',
      includeNarration: true,
      narrationProvider: provider,
      exerciseName: 'Nhận bóng mở thân người',
    });

    const result = await controller.promise;
    assert.ok(result, 'Export result must not be null');

    // 1. Format and MIME verification
    assert.equal(result.format, 'mp4', 'Result format must be mp4');
    assert.equal(result.nativeMp4, true, 'Result nativeMp4 must be true');
    assert.equal(result.mimeType, 'video/mp4;codecs=h264,aac', 'MediaRecorder mimeType must be native MP4');
    assert.equal(result.blob.type, 'video/mp4;codecs=h264,aac', 'Output Blob MIME must be native MP4');

    // 2. Filename verification
    assert.ok(result.filename.endsWith('.mp4'), 'Filename must end with .mp4');
    assert.equal(result.filename, 'coquinho-nhan-bong-mo-than-nguoi.mp4');

    // 3. Narration audio preservation verification
    assert.equal(result.hasAudio, true, 'Result hasAudio must be true');
    const recorderInstance = MockMediaRecorder.lastCreatedInstance;
    assert.ok(recorderInstance, 'MediaRecorder instance must exist');
    assert.ok(
      recorderInstance.stream.getAudioTracks().length >= 1,
      'MediaRecorder stream must contain narration audio track'
    );
    assert.ok(
      recorderInstance.stream.getVideoTracks().length >= 1,
      'MediaRecorder stream must contain video track'
    );
  } finally {
    restoreEnv();
  }
});

test('MP4-A1 (Test Case B): Browser does NOT support MP4 -> capability reports mp4Native=false, mp4RequiresTranscode=true, WebM still exports normally', async () => {
  const restoreEnv = setupMockExportEnvironment((mime: string) => mime.includes('webm'));

  try {
    const diag = buildDefaultStructuredDiagram({
      blockType: 'technical',
      playerCount: 16,
      topic: 'Nhận bóng mở thân người',
      execution: 'p1 chuyền cho p2',
    });

    const warningsCaptured: string[] = [];
    const controller = exportDiagramToVideoBlob(diag, {
      format: 'mp4',
      exerciseName: 'Nhận bóng mở thân người',
      onNarrationWarning: (warn) => {
        warningsCaptured.push(warn);
      },
    });

    const result = await controller.promise;
    assert.ok(result, 'Export must succeed on WebM fallback');

    // Expected fallback behavior
    assert.equal(result.format, 'webm', 'Fallback format must be webm');
    assert.equal(result.nativeMp4, false, 'nativeMp4 must be false');
    assert.ok(result.mimeType.includes('webm'), 'Mime type must be webm');
    assert.ok(result.filename.endsWith('.webm'), 'Filename must end with .webm');
    assert.equal(result.filename, 'coquinho-nhan-bong-mo-than-nguoi.webm');
    assert.ok(
      warningsCaptured.some((w) => w.includes('WebM')),
      'Clear warning must be emitted informing fallback to WebM'
    );
  } finally {
    restoreEnv();
  }
});

test('MP4-A1 (Test Case C): Default export without MP4 request preserves existing WebM behavior unchanged', async () => {
  const restoreEnv = setupMockExportEnvironment((mime: string) =>
    mime.includes('webm') || mime === 'video/mp4;codecs=h264,aac'
  );

  try {
    const diag = buildDefaultStructuredDiagram({
      blockType: 'technical',
      playerCount: 16,
      topic: 'Nhận bóng mở thân người',
      execution: 'p1 chuyền cho p2',
    });

    // Default export with no format specified
    const controller = exportDiagramToVideoBlob(diag, {
      exerciseName: 'Nhận bóng mở thân người',
    });

    const result = await controller.promise;
    assert.ok(result);
    assert.equal(result.format, 'webm', 'Default export format must remain webm');
    assert.ok(result.filename.endsWith('.webm'), 'Default export filename must end with .webm');
    assert.ok(result.mimeType.includes('webm'), 'Default export MIME must be webm');
  } finally {
    restoreEnv();
  }
});

test('MP4-A1: export duration and coaching freeze consistency unchanged across formats', async () => {
  const restoreEnv = setupMockExportEnvironment((mime: string) =>
    mime.includes('webm') || mime === 'video/mp4;codecs=h264,aac'
  );

  try {
    const diag = buildDefaultStructuredDiagram({
      blockType: 'technical',
      playerCount: 16,
      topic: 'Nhận bóng mở thân người',
      execution: 'p1 chuyền cho p2',
    });

    const expectedDuration = calculateExportDuration(diag.animation);

    // 1. WebM export duration
    const webmController = exportDiagramToVideoBlob(diag, { format: 'webm' });
    const webmResult = await webmController.promise;
    assert.ok(webmResult);
    assert.equal(webmResult.duration, expectedDuration);

    // 2. Native MP4 export duration
    const mp4Controller = exportDiagramToVideoBlob(diag, { format: 'mp4' });
    const mp4Result = await mp4Controller.promise;
    assert.ok(mp4Result);
    assert.equal(mp4Result.duration, expectedDuration);
    assert.equal(mp4Result.duration, webmResult.duration);
  } finally {
    restoreEnv();
  }
});

test('MP4-A1: native MP4 cancellation and resource cleanup', async () => {
  const restoreEnv = setupMockExportEnvironment((mime: string) =>
    mime.includes('webm') || mime === 'video/mp4;codecs=h264,aac'
  );

  try {
    const diag = buildDefaultStructuredDiagram({
      blockType: 'technical',
      playerCount: 16,
      topic: 'Nhận bóng mở thân người',
      execution: 'p1 chuyền cho p2',
    });

    const provider: NarrationAudioProvider = async () => {
      return new MockAudioBuffer({ duration: 1.5 }) as unknown as AudioBuffer;
    };

    let controllerRef: any = null;
    const controller = exportDiagramToVideoBlob(diag, {
      format: 'mp4',
      narrationProvider: provider,
      onProgress: (p) => {
        if (p.stage === 'rendering') {
          controllerRef.cancel();
        }
      },
    });
    controllerRef = controller;

    const result = await controller.promise;
    assert.equal(result, null, 'Cancelled export must resolve to null');

    const recorderInstance = MockMediaRecorder.lastCreatedInstance;
    assert.ok(recorderInstance);
    assert.equal(recorderInstance.state, 'inactive', 'Recorder must be inactive after cancellation');
  } finally {
    restoreEnv();
  }
});

