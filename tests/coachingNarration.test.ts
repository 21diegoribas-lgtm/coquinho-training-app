import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COACHING_ENTER_DURATION,
  COACHING_EXIT_DURATION,
  buildRepresentativePairDiagram,
  getEffectiveCoachingDuration,
} from '../src/services/structuredDiagram';
import {
  buildCoachingNarrationTimeline,
  CoachingNarrationItem,
  estimateSpeechDuration,
  fitNarrationToSlot,
  generateNarrationScript,
  preventNarrationOverlap,
  shortenNarrationText,
  sortNarrationChronologically,
} from '../src/services/coachingNarration';

// =============================================================================
// TASK TTS-A1 TESTS: Pure Coaching Narration Helpers & Timing
// =============================================================================

test('TTS-A1: generateNarrationScript generates concise Vietnamese scripts from canonical moments', () => {
  // Test canonical football coaching moments
  const s1 = generateNarrationScript({ title: 'Kiểm tra vai' });
  assert.equal(s1, 'Kiểm tra vai trước khi bóng đến.');

  const s2 = generateNarrationScript({ title: 'Mở thân người' });
  assert.equal(s2, 'Mở thân người để hướng về phía chơi tiếp theo.');

  const s3 = generateNarrationScript({ title: 'Chạm bước một' });
  assert.equal(s3, 'Chạm bước một đưa bóng vào không gian thuận lợi.');

  // Other common football cues
  const s4 = generateNarrationScript({ title: 'Chuẩn bị đón bóng' });
  assert.equal(s4, 'Chuẩn bị đón bóng chính xác từ đồng đội.');

  const s5 = generateNarrationScript({ title: 'Tiếp bóng an toàn' });
  assert.equal(s5, 'Tiếp bóng an toàn bằng lòng bàn chân.');

  const s6 = generateNarrationScript({ title: 'Chuyền trả bóng' });
  assert.equal(s6, 'Chuyền trả bóng chính xác cho đồng đội.');
});

test('TTS-A1: generateNarrationScript matches events and text fallbacks deterministically without AI', () => {
  // Event-based derivation
  assert.equal(
    generateNarrationScript({ event: 'preReceive' }),
    'Kiểm tra vai trước khi bóng đến.'
  );
  assert.equal(
    generateNarrationScript({ event: 'receive' }),
    'Mở thân người để hướng về phía chơi tiếp theo.'
  );
  assert.equal(
    generateNarrationScript({ event: 'firstTouch' }),
    'Chạm bước một đưa bóng vào không gian thuận lợi.'
  );

  // Text-based fallback when title is generic
  const sCustom = generateNarrationScript({
    title: 'Lưu ý kỹ thuật',
    text: 'Quan sát đồng đội phía trước để phối hợp nhanh.',
  });
  assert.equal(sCustom, 'Quan sát đồng đội phía trước để phối hợp nhanh.');
});

test('TTS-A1: estimateSpeechDuration calculates duration deterministically based on words and pauses', () => {
  assert.equal(estimateSpeechDuration(''), 0);

  const text7Words = 'Kiểm tra vai trước khi bóng đến.';
  const dur7 = estimateSpeechDuration(text7Words);
  // 7 words at 240 wpm: (7/240)*60 = 1.75s + 0.05s pause = 1.80s
  assert.equal(dur7, 1.80);

  const text10Words = 'Mở thân người để hướng về phía chơi tiếp theo.';
  const dur10 = estimateSpeechDuration(text10Words);
  // 10 words at 240 wpm: (10/240)*60 = 2.50s + 0.05s pause = 2.55s
  assert.equal(dur10, 2.55);

  assert.ok(dur10 > dur7, '10-word script should estimate longer duration than 7-word script');
});

test('TTS-A1: shortenNarrationText and fitNarrationToSlot fit long text into tight slots', () => {
  const original = 'Mở thân người để hướng về phía chơi tiếp theo.';
  
  // If slot is plenty (3.0s), fitNarrationToSlot keeps original
  const fittedLong = fitNarrationToSlot(original, 3.0);
  assert.equal(fittedLong, original);

  // If slot is tight (2.0s), fitNarrationToSlot shortens deterministically
  const fittedTight = fitNarrationToSlot(original, 2.0);
  assert.ok(
    estimateSpeechDuration(fittedTight) <= 2.0,
    `Shortened text must fit inside 2.0s slot (got ${estimateSpeechDuration(fittedTight)}s)`
  );
  assert.ok(fittedTight.length > 0 && fittedTight.endsWith('.'));
});

test('TTS-A1: sortNarrationChronologically sorts items strictly by presentation time', () => {
  const items: CoachingNarrationItem[] = [
    {
      id: 'narr-3',
      coachingMomentId: 'coach3',
      startPresentationTime: 12.0,
      maxDuration: 2.6,
      text: 'Chạm bước một đưa bóng vào không gian thuận lợi.',
      estimatedSpeechDuration: 2.55,
    },
    {
      id: 'narr-1',
      coachingMomentId: 'coach1',
      startPresentationTime: 2.1,
      maxDuration: 2.6,
      text: 'Kiểm tra vai trước khi bóng đến.',
      estimatedSpeechDuration: 1.80,
    },
    {
      id: 'narr-2',
      coachingMomentId: 'coach2',
      startPresentationTime: 7.1,
      maxDuration: 2.6,
      text: 'Mở thân người để hướng về phía chơi tiếp theo.',
      estimatedSpeechDuration: 2.55,
    },
  ];

  const sorted = sortNarrationChronologically(items);
  assert.equal(sorted[0].id, 'narr-1');
  assert.equal(sorted[1].id, 'narr-2');
  assert.equal(sorted[2].id, 'narr-3');
});

test('TTS-A1: preventNarrationOverlap clamps overlapping slots and refits text', () => {
  const overlappingItems: CoachingNarrationItem[] = [
    {
      id: 'narr-1',
      coachingMomentId: 'coach1',
      startPresentationTime: 2.0,
      maxDuration: 5.0, // Would extend to 7.0s, overlapping item 2 at 4.0s
      text: 'Kiểm tra vai trước khi bóng đến.',
      estimatedSpeechDuration: 1.80,
    },
    {
      id: 'narr-2',
      coachingMomentId: 'coach2',
      startPresentationTime: 4.0,
      maxDuration: 2.5,
      text: 'Mở thân người để hướng về phía chơi tiếp theo.',
      estimatedSpeechDuration: 2.55,
    },
  ];

  const nonOverlapping = preventNarrationOverlap(overlappingItems);
  assert.equal(nonOverlapping.length, 2);
  // Item 1 maxDuration should be clamped to 2.0s (4.0s - 2.0s)
  assert.ok(nonOverlapping[0].startPresentationTime + nonOverlapping[0].maxDuration <= nonOverlapping[1].startPresentationTime);
  assert.ok(nonOverlapping[0].estimatedSpeechDuration <= nonOverlapping[0].maxDuration);
});

// =============================================================================
// TEST CASE: 16 players, 8 pairs, Nhận bóng mở thân người, representative pair
// =============================================================================

test('TTS-A1 TEST CASE: 16 players, 8 pairs, Nhận bóng mở thân người representative pair full verification', () => {
  const diag = buildRepresentativePairDiagram(16, {
    blockType: 'warm_up',
    playerCount: 16,
    playerOrganization: { groups: 8, playersPerGroup: 2, leftover: 0, leftoverRole: 'none' },
    organization: '16 cầu thủ chia thành 8 nhóm 2',
    topic: 'Nhận bóng mở thân người',
  });

  const anim = diag.animation!;
  assert.ok(anim && anim.coachingMoments);

  // 1. Build narration timeline
  const items = buildCoachingNarrationTimeline(anim);

  // Verify requirement: exactly 3 narration items
  assert.equal(items.length, 3, 'Must produce exactly 3 narration items');

  // Verify requirement: correct order
  assert.equal(items[0].coachingMomentId, 'coach1');
  assert.equal(items[1].coachingMomentId, 'coach2');
  assert.equal(items[2].coachingMomentId, 'coach3');

  // Verify requirement: concise Vietnamese text
  assert.equal(items[0].text, 'Kiểm tra vai trước khi bóng đến.');
  assert.equal(items[1].text, 'Mở thân người để hướng về phía chơi tiếp theo.');
  assert.equal(items[2].text, 'Chạm bước một đưa bóng vào không gian thuận lợi.');

  // Verify requirement: each starts in hold phase
  // In FIX-A, hold phase starts after enter transition: startPresentationTime = momentPresentationStart + COACHING_ENTER_DURATION
  const m1 = anim.coachingMoments.find((m) => m.id === 'coach1')!;
  const m2 = anim.coachingMoments.find((m) => m.id === 'coach2')!;
  const m3 = anim.coachingMoments.find((m) => m.id === 'coach3')!;

  // Drill time for coach1 is 1.4s -> presentation start is 1.4s -> hold starts at 1.4 + 0.7 = 2.1s
  assert.equal(items[0].startPresentationTime, 2.1);

  // Moment 1 effective duration is 4.0s (70 chars) -> finishes at 1.4 + 4.0 = 5.4s
  // Drill runs from 1.4s to 2.4s (1.0s) -> coach2 presentation starts at 5.4 + 1.0 = 6.4s -> hold starts at 6.4 + 0.7 = 7.1s
  assert.equal(items[1].startPresentationTime, 7.1);

  // Moment 2 effective duration is 4.0s -> finishes at 6.4 + 4.0 = 10.4s
  // Drill runs from 2.4s to 3.3s (0.9s) -> coach3 presentation starts at 10.4 + 0.9 = 11.3s -> hold starts at 11.3 + 0.7 = 12.0s
  assert.equal(items[2].startPresentationTime, 12.0);

  // Verify requirement: no overlap
  for (let i = 0; i < items.length - 1; i++) {
    const currentEnd = items[i].startPresentationTime + items[i].maxDuration;
    const nextStart = items[i + 1].startPresentationTime;
    assert.ok(
      currentEnd <= nextStart,
      `Item ${i} end (${currentEnd}) must be <= next start (${nextStart})`
    );
  }

  // Verify requirement: each fits inside its slot
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    assert.ok(
      item.estimatedSpeechDuration <= item.maxDuration,
      `Item ${i} estimatedSpeechDuration (${item.estimatedSpeechDuration}) must fit inside maxDuration (${item.maxDuration})`
    );
  }

  // Verify FIX-A presentation durations remain completely unchanged
  assert.equal(getEffectiveCoachingDuration(m1), 4.0);
  assert.equal(getEffectiveCoachingDuration(m2), 4.0);
  assert.equal(getEffectiveCoachingDuration(m3), 4.0);
  assert.equal(COACHING_ENTER_DURATION, 0.7);
  assert.equal(COACHING_EXIT_DURATION, 0.7);
});
