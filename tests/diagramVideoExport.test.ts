import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateExportDuration,
  calculateExportProgress,
  generateVideoFilename,
  getExportCoachingMoments,
  isBrowserVideoExportSupported,
  mapPresentationTimeToTimeline,
  renderDiagramFrameToSvgString,
  slugifyTitle,
} from '../src/services/diagramVideoExport';
import {
  buildDefaultStructuredDiagram,
  buildSemanticAnimation,
  DEFAULT_POLISHED_MOTION_OPTIONS,
  interpolateAnimationState,
} from '../src/services/structuredDiagram';
import { DiagramAnimation, StructuredDrillDiagram } from '../src/types/session';

// =============================================================================
// TASK D8B1 TESTS: VIDEO EXPORT FOUNDATION
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
// TASK D8B1 REQUIREMENT 18 TEST CASE:
// 16 players, Nhận bóng mở thân người, 90 minutes, 7v7 technical drill full export verification
// =============================================================================

test('D8B1 TEST CASE: 16 players, Nhận bóng mở thân người, 90 min, 7v7 technical drill video export timeline verification', () => {
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

  // 1. Export duration is calculated strictly as drill duration + sum of coaching moment durations
  const expectedTotalDuration = anim.duration + c1.duration + c2.duration + c3.duration;
  const totalDuration = calculateExportDuration(anim);
  assert.equal(totalDuration, Math.round(expectedTotalDuration * 100) / 100);
  assert.ok(totalDuration > anim.duration, 'Total export duration includes coaching presentation time');

  // 2. Timeline starts from correct initial frame
  const initialFrame = mapPresentationTimeToTimeline(0, anim, diag);
  assert.equal(initialFrame.drillTime, 0);
  assert.equal(initialFrame.isFrozen, false);
  assert.equal(initialFrame.activeMoment, null);
  assert.equal(initialFrame.cameraViewBox, '0 0 1000 600');
  assert.equal(initialFrame.interpolatedState.players.length, 16);

  // 3. Player/ball movement matches interactive playback prior to first freeze
  const midInitialDrill = mapPresentationTimeToTimeline(c1.time * 0.5, anim, diag);
  const interactiveState = interpolateAnimationState(
    { ...diag, animation: anim },
    c1.time * 0.5,
    DEFAULT_POLISHED_MOTION_OPTIONS
  );
  assert.deepEqual(midInitialDrill.interpolatedState.players, interactiveState.players);
  assert.deepEqual(midInitialDrill.interpolatedState.balls, interactiveState.balls);

  // 4. Coaching freeze 1 (coach1 - Kiểm tra vai) appears at exact drill timestamp c1.time
  const freeze1PresTime = c1.time + c1.duration * 0.5;
  const frameFreeze1 = mapPresentationTimeToTimeline(freeze1PresTime, anim, diag);
  assert.equal(frameFreeze1.drillTime, c1.time, 'Drill time must freeze at coach1.time');
  assert.equal(frameFreeze1.isFrozen, true);
  assert.equal(frameFreeze1.activeMoment?.id, 'coach1');
  assert.ok(frameFreeze1.activeMoment?.title.includes('Kiểm tra vai'));
  assert.notEqual(frameFreeze1.cameraViewBox, '0 0 1000 600', 'Camera zoom appears during coaching moment');
  assert.equal(frameFreeze1.sequenceProgress?.current, 1);
  assert.equal(frameFreeze1.sequenceProgress?.total, 3);

  // 5. Drill resumes after coach1 freeze completes
  const postFreeze1PresTime = c1.time + c1.duration + 0.1;
  const framePostFreeze1 = mapPresentationTimeToTimeline(postFreeze1PresTime, anim, diag);
  assert.equal(framePostFreeze1.isFrozen, false);
  assert.equal(framePostFreeze1.activeMoment, null);
  assert.ok(framePostFreeze1.drillTime > c1.time);

  // 6. Coaching freeze 2 (coach2 - Mở thân người) appears at exact drill timestamp c2.time
  const presTimeC2Start = c1.time + c1.duration + (c2.time - c1.time);
  const frameFreeze2 = mapPresentationTimeToTimeline(presTimeC2Start + c2.duration * 0.5, anim, diag);
  assert.equal(frameFreeze2.drillTime, c2.time, 'Drill time must freeze at coach2.time');
  assert.equal(frameFreeze2.isFrozen, true);
  assert.equal(frameFreeze2.activeMoment?.id, 'coach2');
  assert.ok(frameFreeze2.activeMoment?.title.includes('Mở thân'));
  assert.equal(frameFreeze2.sequenceProgress?.current, 2);

  // 7. Coaching freeze 3 (coach3 - Chạm bước một) appears at exact drill timestamp c3.time
  const presTimeC3Start = presTimeC2Start + c2.duration + (c3.time - c2.time);
  const frameFreeze3 = mapPresentationTimeToTimeline(presTimeC3Start + c3.duration * 0.5, anim, diag);
  assert.equal(frameFreeze3.drillTime, c3.time, 'Drill time must freeze at coach3.time');
  assert.equal(frameFreeze3.isFrozen, true);
  assert.equal(frameFreeze3.activeMoment?.id, 'coach3');
  assert.ok(frameFreeze3.activeMoment?.title.includes('bước một'));
  assert.equal(frameFreeze3.sequenceProgress?.current, 3);

  // 8. Drill resumes to completion
  const frameFinal = mapPresentationTimeToTimeline(totalDuration, anim, diag);
  assert.equal(frameFinal.drillTime, anim.duration, 'Video ends at exact final frame');
  assert.equal(frameFinal.isFrozen, false);

  // 9. Rendered SVG frame verification at freeze: contains orientation, zoom, text, sequence indicator
  const svgFreeze2 = renderDiagramFrameToSvgString(diag, frameFreeze2, 1200, 720);
  assert.ok(svgFreeze2.includes('ĐIỂM HUẤN LUYỆN: Mở thân người'));
  assert.ok(svgFreeze2.includes('Điểm HLV 2/3'));
  assert.ok(svgFreeze2.includes('sd-arrow-pass'));

  // 10. Download filename is valid according to specification
  const filename = generateVideoFilename('Nhận bóng mở thân người');
  assert.equal(filename, 'coquinho-nhan-bong-mo-than-nguoi.webm');
});
