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
  DEFAULT_NARRATION_VOLUME,
  estimateSpeechDuration,
  fitNarrationToSlot,
  generateNarrationScript,
  isNarrationAudioSupported,
  NarrationAudioController,
  NarrationAudioProvider,
  prepareNarrationAudioTrack,
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
  assert.equal(s2, 'Mở thân người về hướng chơi tiếp theo.');

  const s3 = generateNarrationScript({ title: 'Chạm bước một' });
  assert.equal(s3, 'Chạm bước một đưa bóng vào khoảng trống.');

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
    'Mở thân người về hướng chơi tiếp theo.'
  );
  assert.equal(
    generateNarrationScript({ event: 'firstTouch' }),
    'Chạm bước một đưa bóng vào khoảng trống.'
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
      text: 'Chạm bước một đưa bóng vào khoảng trống.',
      estimatedSpeechDuration: 2.05,
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
      text: 'Mở thân người về hướng chơi tiếp theo.',
      estimatedSpeechDuration: 2.05,
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
      text: 'Mở thân người về hướng chơi tiếp theo.',
      estimatedSpeechDuration: 2.05,
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
  assert.equal(items[1].text, 'Mở thân người về hướng chơi tiếp theo.');
  assert.equal(items[2].text, 'Chạm bước một đưa bóng vào khoảng trống.');

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

// =============================================================================
// TASK TTS-A2: Mock Browser Audio Infrastructure for Node.js Testing
// =============================================================================

class MockAudioBuffer {
  duration: number;
  sampleRate: number;
  numberOfChannels: number;
  length: number;

  constructor(options: { duration: number; sampleRate?: number; numberOfChannels?: number }) {
    this.duration = options.duration;
    this.sampleRate = options.sampleRate || 44100;
    this.numberOfChannels = options.numberOfChannels || 1;
    this.length = Math.round(this.duration * this.sampleRate);
  }

  getChannelData(_channel: number) {
    return new Float32Array(this.length);
  }
}

class MockMediaStreamTrack {
  kind = 'audio';
  id = 'track-' + Math.random().toString(36).substring(2, 9);
  enabled = true;
  readyState: 'live' | 'ended' = 'live';

  stop() {
    this.readyState = 'ended';
  }
}

class MockMediaStream {
  tracks: MockMediaStreamTrack[];

  constructor(tracks: MockMediaStreamTrack[] = [new MockMediaStreamTrack()]) {
    this.tracks = tracks;
  }

  getAudioTracks() {
    return this.tracks.filter((t) => t.kind === 'audio');
  }

  getTracks() {
    return [...this.tracks];
  }
}

class MockAudioBufferSourceNode {
  buffer: MockAudioBuffer | null = null;
  loop = false;
  startedAt: number | null = null;
  startOffset: number | null = null;
  startDuration: number | null | undefined = null;
  stoppedAt: number | null = null;
  state: 'idle' | 'started' | 'stopped' = 'idle';
  connectedTo: any = null;
  onended: (() => void) | null = null;

  connect(dest: any) {
    this.connectedTo = dest;
    return dest;
  }

  disconnect() {
    this.connectedTo = null;
  }

  start(when: number = 0, offset: number = 0, duration?: number) {
    this.startedAt = Math.round(when * 1000) / 1000;
    this.startOffset = offset;
    this.startDuration = duration !== undefined ? Math.round(duration * 1000) / 1000 : undefined;
    this.state = 'started';
  }

  stop(when: number = 0) {
    this.stoppedAt = Math.round(when * 1000) / 1000;
    this.state = 'stopped';
    if (this.onended) {
      this.onended();
    }
  }
}

class MockGainNode {
  gain = {
    value: 1.0,
    setValueAtTime: (val: number, _time: number) => {
      this.gain.value = val;
    },
  };
  connectedTo: any = null;

  connect(dest: any) {
    this.connectedTo = dest;
    return dest;
  }

  disconnect() {
    this.connectedTo = null;
  }
}

class MockMediaStreamDestinationNode {
  stream = new MockMediaStream();
  connectedTo: any = null;

  connect(dest: any) {
    this.connectedTo = dest;
    return dest;
  }

  disconnect() {
    this.connectedTo = null;
  }
}

class MockAudioContext {
  currentTime = 0;
  state: AudioContextState = 'running';
  createdSources: MockAudioBufferSourceNode[] = [];
  createdGainNodes: MockGainNode[] = [];
  createdDestinations: MockMediaStreamDestinationNode[] = [];

  createBufferSource() {
    const node = new MockAudioBufferSourceNode();
    this.createdSources.push(node);
    return node as unknown as AudioBufferSourceNode;
  }

  createGain() {
    const node = new MockGainNode();
    this.createdGainNodes.push(node);
    return node as unknown as GainNode;
  }

  createMediaStreamDestination() {
    const node = new MockMediaStreamDestinationNode();
    this.createdDestinations.push(node);
    return node as unknown as MediaStreamAudioDestinationNode;
  }

  createBuffer(channels: number, length: number, sampleRate: number) {
    return new MockAudioBuffer({
      duration: length / sampleRate,
      numberOfChannels: channels,
      sampleRate,
    }) as unknown as AudioBuffer;
  }

  async close() {
    this.state = 'closed';
  }

  async resume() {
    this.state = 'running';
  }
}

// =============================================================================
// TASK TTS-A2 TESTS: Browser Audio Track Generation & Web Audio Scheduling
// =============================================================================

test('TTS-A2: capability detection (isNarrationAudioSupported)', () => {
  // Save previous global state
  const prevAudioContext = (globalThis as any).AudioContext;
  try {
    delete (globalThis as any).AudioContext;
    delete (globalThis as any).window;
    assert.equal(isNarrationAudioSupported(), false, 'Should be unsupported in bare Node.js environment');

    (globalThis as any).AudioContext = MockAudioContext;
    assert.equal(isNarrationAudioSupported(), true, 'Should detect support when MockAudioContext is present');
  } finally {
    if (prevAudioContext) {
      (globalThis as any).AudioContext = prevAudioContext;
    } else {
      delete (globalThis as any).AudioContext;
    }
  }
});

test('TTS-A2: output-track creation and volume routing pipeline', async () => {
  const mockCtx = new MockAudioContext();
  const testItem: CoachingNarrationItem = {
    id: 'n1',
    coachingMomentId: 'c1',
    startPresentationTime: 1.0,
    maxDuration: 2.0,
    text: 'Kiểm tra vai trước khi bóng đến.',
    estimatedSpeechDuration: 1.8,
  };

  const provider: NarrationAudioProvider = async () =>
    new MockAudioBuffer({ duration: 1.5 }) as unknown as AudioBuffer;

  const controller = await prepareNarrationAudioTrack({
    items: [testItem],
    audioProvider: provider,
    audioContext: mockCtx as unknown as AudioContext,
    volume: 0.85,
  });

  assert.ok(controller.audioTrack, 'Must return a valid MediaStreamTrack');
  assert.equal(controller.audioTrack.kind, 'audio', 'Track kind must be audio');
  assert.ok(controller.stream, 'Must return a valid MediaStream');
  assert.equal(controller.stream.getAudioTracks().length, 1, 'Stream must have exactly one audio track');
  assert.equal(controller.scheduledClipsCount, 1, 'Must schedule exactly 1 clip');

  // Verify GainNode creation and volume normalization
  assert.equal(mockCtx.createdGainNodes.length, 1);
  assert.equal(mockCtx.createdGainNodes[0].gain.value, 0.85);

  controller.cleanup();
});

test('TTS-A2: scheduling times and base offset positioning', async () => {
  const mockCtx = new MockAudioContext();
  mockCtx.currentTime = 5.0; // Simulate non-zero context current time

  const items: CoachingNarrationItem[] = [
    {
      id: 'n1',
      coachingMomentId: 'c1',
      startPresentationTime: 2.0,
      maxDuration: 2.5,
      text: 'Kiểm tra vai trước khi bóng đến.',
      estimatedSpeechDuration: 1.8,
    },
    {
      id: 'n2',
      coachingMomentId: 'c2',
      startPresentationTime: 7.0,
      maxDuration: 2.5,
      text: 'Mở thân người về hướng chơi tiếp theo.',
      estimatedSpeechDuration: 2.05,
    },
  ];

  const provider: NarrationAudioProvider = async (item) =>
    new MockAudioBuffer({ duration: item.estimatedSpeechDuration }) as unknown as AudioBuffer;

  // Pass custom presentationStartOffset = 0.5
  const controller = await prepareNarrationAudioTrack({
    items,
    audioProvider: provider,
    audioContext: mockCtx as unknown as AudioContext,
    presentationStartOffset: 0.5,
  });

  assert.equal(controller.scheduledClipsCount, 2);
  assert.equal(mockCtx.createdSources.length, 2);

  // Item 1: base (0.5) + startPresentationTime (2.0) = 2.5s
  assert.equal(mockCtx.createdSources[0].startedAt, 2.5);
  // Item 2: base (0.5) + startPresentationTime (7.0) = 7.5s
  assert.equal(mockCtx.createdSources[1].startedAt, 7.5);

  controller.cleanup();
});

test('TTS-A2: duration clamping respects item.maxDuration and adjacent slots', async () => {
  const mockCtx = new MockAudioContext();

  const items: CoachingNarrationItem[] = [
    {
      id: 'n1',
      coachingMomentId: 'c1',
      startPresentationTime: 1.0,
      maxDuration: 2.0, // slot is 2.0s
      text: 'Cắt bóng nhanh.',
      estimatedSpeechDuration: 1.0,
    },
    {
      id: 'n2',
      coachingMomentId: 'c2',
      startPresentationTime: 4.0,
      maxDuration: 1.5, // slot is 1.5s
      text: 'Quan sát.',
      estimatedSpeechDuration: 0.8,
    },
  ];

  // Provider returns buffers longer than slots!
  const provider: NarrationAudioProvider = async (item) => {
    if (item.id === 'n1') return new MockAudioBuffer({ duration: 3.5 }) as unknown as AudioBuffer; // exceeds 2.0s
    return new MockAudioBuffer({ duration: 1.2 }) as unknown as AudioBuffer; // fits within 1.5s
  };

  const controller = await prepareNarrationAudioTrack({
    items,
    audioProvider: provider,
    audioContext: mockCtx as unknown as AudioContext,
    presentationStartOffset: 0,
  });

  assert.equal(mockCtx.createdSources.length, 2);

  // Clip 1 had 3.5s buffer but maxDuration was 2.0s -> must be clamped to 2.0s!
  assert.equal(mockCtx.createdSources[0].startDuration, 2.0);
  assert.equal(mockCtx.createdSources[0].stoppedAt, 3.0); // 1.0 + 2.0 = 3.0s

  // Clip 2 had 1.2s buffer with maxDuration 1.5s -> plays full 1.2s
  assert.equal(mockCtx.createdSources[1].startDuration, 1.2);
  assert.equal(mockCtx.createdSources[1].stoppedAt, 5.2); // 4.0 + 1.2 = 5.2s

  controller.cleanup();
});

test('TTS-A2: partial provider failure schedules remaining valid clips', async () => {
  const mockCtx = new MockAudioContext();

  const items: CoachingNarrationItem[] = [
    { id: 'n1', coachingMomentId: 'c1', startPresentationTime: 1.0, maxDuration: 2.0, text: 'Clip 1', estimatedSpeechDuration: 1.0 },
    { id: 'n2', coachingMomentId: 'c2', startPresentationTime: 4.0, maxDuration: 2.0, text: 'Clip 2 (fails)', estimatedSpeechDuration: 1.0 },
    { id: 'n3', coachingMomentId: 'c3', startPresentationTime: 7.0, maxDuration: 2.0, text: 'Clip 3', estimatedSpeechDuration: 1.0 },
  ];

  // Provider fails for clip 2 (returns null)
  const provider: NarrationAudioProvider = async (item) => {
    if (item.id === 'n2') return null;
    return new MockAudioBuffer({ duration: 1.0 }) as unknown as AudioBuffer;
  };

  const controller = await prepareNarrationAudioTrack({
    items,
    audioProvider: provider,
    audioContext: mockCtx as unknown as AudioContext,
  });

  assert.equal(controller.scheduledClipsCount, 2, 'Must schedule 2 clips despite 1 failure');
  assert.ok(controller.audioTrack, 'Track must still be valid');
  assert.equal(mockCtx.createdSources.length, 2);
  assert.equal(mockCtx.createdSources[0].startedAt, 1.0);
  assert.equal(mockCtx.createdSources[1].startedAt, 7.0);

  controller.cleanup();
});

test('TTS-A2: total provider failure and empty items return clean no-audio result', async () => {
  const mockCtx = new MockAudioContext();

  // Test 1: Empty items array
  const emptyController = await prepareNarrationAudioTrack({
    items: [],
    audioProvider: async () => null,
    audioContext: mockCtx as unknown as AudioContext,
  });
  assert.equal(emptyController.audioTrack, null);
  assert.equal(emptyController.stream, null);
  assert.equal(emptyController.scheduledClipsCount, 0);

  // Test 2: All items fail / return null
  const failProvider: NarrationAudioProvider = async () => null;
  const failController = await prepareNarrationAudioTrack({
    items: [{ id: 'n1', coachingMomentId: 'c1', startPresentationTime: 1.0, maxDuration: 2.0, text: 'Fail', estimatedSpeechDuration: 1.0 }],
    audioProvider: failProvider,
    audioContext: mockCtx as unknown as AudioContext,
  });
  assert.equal(failController.audioTrack, null);
  assert.equal(failController.stream, null);
  assert.equal(failController.scheduledClipsCount, 0);

  // Test 3: Provider throws exception for all items
  const throwProvider: NarrationAudioProvider = async () => {
    throw new Error('TTS network failure');
  };
  const throwController = await prepareNarrationAudioTrack({
    items: [{ id: 'n1', coachingMomentId: 'c1', startPresentationTime: 1.0, maxDuration: 2.0, text: 'Throw', estimatedSpeechDuration: 1.0 }],
    audioProvider: throwProvider,
    audioContext: mockCtx as unknown as AudioContext,
  });
  assert.equal(throwController.audioTrack, null);
  assert.equal(throwController.stream, null);
  assert.equal(throwController.scheduledClipsCount, 0);
});

test('TTS-A2: cancel handling stops all active sources, track and allows repeated cancel', async () => {
  const mockCtx = new MockAudioContext();
  const items: CoachingNarrationItem[] = [
    { id: 'n1', coachingMomentId: 'c1', startPresentationTime: 1.0, maxDuration: 2.0, text: 'Clip 1', estimatedSpeechDuration: 1.5 },
  ];
  const provider: NarrationAudioProvider = async () => new MockAudioBuffer({ duration: 1.5 }) as unknown as AudioBuffer;

  const controller = await prepareNarrationAudioTrack({
    items,
    audioProvider: provider,
    audioContext: mockCtx as unknown as AudioContext,
  });

  const source = mockCtx.createdSources[0];
  const track = controller.audioTrack as unknown as MockMediaStreamTrack;
  assert.equal(track.readyState, 'live');

  // Cancel once
  controller.cancel();
  assert.equal(source.state, 'stopped');
  assert.equal(track.readyState, 'ended');

  // Cancel again (must not throw)
  assert.doesNotThrow(() => {
    controller.cancel();
  });
});

test('TTS-A2: cleanup handling closes context and is idempotent', async () => {
  const mockCtx = new MockAudioContext();
  const items: CoachingNarrationItem[] = [
    { id: 'n1', coachingMomentId: 'c1', startPresentationTime: 1.0, maxDuration: 2.0, text: 'Clip 1', estimatedSpeechDuration: 1.5 },
  ];
  const provider: NarrationAudioProvider = async () => new MockAudioBuffer({ duration: 1.5 }) as unknown as AudioBuffer;

  const controller = await prepareNarrationAudioTrack({
    items,
    audioProvider: provider,
    audioContext: mockCtx as unknown as AudioContext,
    closeContextOnCleanup: true,
  });

  assert.equal(mockCtx.state, 'running');

  // First cleanup
  controller.cleanup();
  assert.equal(mockCtx.state, 'closed');

  // Repeated cleanup (must be idempotent and not throw)
  assert.doesNotThrow(() => {
    controller.cleanup();
  });
});

// =============================================================================
// TASK TTS-A2 TEST CASE: 16 players, 8 pairs, full 10-point audio verification
// =============================================================================

test('TTS-A2 TEST CASE: 16 players representative pair full 10-point audio verification', async () => {
  const diag = buildRepresentativePairDiagram(16, {
    blockType: 'warm_up',
    playerCount: 16,
    playerOrganization: { groups: 8, playersPerGroup: 2, leftover: 0, leftoverRole: 'none' },
    organization: '16 cầu thủ chia thành 8 nhóm 2',
    topic: 'Nhận bóng mở thân người',
  });

  const anim = diag.animation!;
  assert.ok(anim && anim.coachingMoments);

  // 1. Get TTS-A1 items (Kiểm tra vai, Mở thân người, Chạm bước một)
  const items = buildCoachingNarrationTimeline(anim);
  assert.equal(items.length, 3, 'Must have exactly 3 TTS-A1 narration items');

  // Mock 3 AudioBuffers with realistic durations:
  // Item 1: "Kiểm tra vai" (estimated 1.80s, maxDuration 2.6s) -> buffer 1.8s
  // Item 2: "Mở thân người" (estimated 2.55s, maxDuration 2.6s) -> buffer 3.5s (overshoot to test clamping)
  // Item 3: "Chạm bước một" (estimated 2.55s, maxDuration 2.6s) -> buffer 2.5s
  const mockBuffers: Record<string, MockAudioBuffer> = {
    'narr-coach1': new MockAudioBuffer({ duration: 1.8 }),
    'narr-coach2': new MockAudioBuffer({ duration: 3.5 }), // intentionally exceeds maxDuration 2.6s
    'narr-coach3': new MockAudioBuffer({ duration: 2.5 }),
  };

  const audioProvider: NarrationAudioProvider = async (item) => {
    return (mockBuffers[item.id] || new MockAudioBuffer({ duration: 2.0 })) as unknown as AudioBuffer;
  };

  const mockCtx = new MockAudioContext();

  const controller = await prepareNarrationAudioTrack({
    items,
    audioProvider,
    audioContext: mockCtx as unknown as AudioContext,
    presentationStartOffset: 0,
    volume: DEFAULT_NARRATION_VOLUME,
    closeContextOnCleanup: true,
  });

  // Verify 1: exactly 3 clips scheduled
  assert.equal(controller.scheduledClipsCount, 3, 'Requirement 1: exactly 3 clips scheduled');
  assert.equal(mockCtx.createdSources.length, 3, 'Requirement 1: 3 AudioBufferSourceNodes created');

  const [src0, src1, src2] = mockCtx.createdSources;

  // Verify 2: each scheduled at correct presentation time
  assert.equal(src0.startedAt, 2.1, 'Requirement 2: clip 1 starts at 2.1s');
  assert.equal(src1.startedAt, 7.1, 'Requirement 2: clip 2 starts at 7.1s');
  assert.equal(src2.startedAt, 12.0, 'Requirement 2: clip 3 starts at 12.0s');

  // Verify 3: duration clamped to maxDuration
  // Clip 1: buffer 1.8s <= maxDuration 2.6s -> duration = 1.8s, stops at 2.1 + 1.8 = 3.9s
  assert.equal(src0.startDuration, 1.8, 'Requirement 3: clip 1 plays full 1.8s');
  assert.equal(src0.stoppedAt, 3.9, 'Requirement 3: clip 1 stops at 3.9s');

  // Clip 2: buffer 3.5s > maxDuration 2.6s -> clamped to 2.6s, stops at 7.1 + 2.6 = 9.7s
  assert.equal(src1.startDuration, 2.6, 'Requirement 3: clip 2 clamped to maxDuration 2.6s');
  assert.equal(src1.stoppedAt, 9.7, 'Requirement 3: clip 2 stops at 9.7s');

  // Clip 3: buffer 2.5s <= maxDuration 2.6s -> duration = 2.5s, stops at 12.0 + 2.5 = 14.5s
  assert.equal(src2.startDuration, 2.5, 'Requirement 3: clip 3 plays full 2.5s');
  assert.equal(src2.stoppedAt, 14.5, 'Requirement 3: clip 3 stops at 14.5s');

  // Verify 4: one output audio track returned
  assert.ok(controller.audioTrack, 'Requirement 4: output audioTrack exists');
  assert.equal(controller.audioTrack.kind, 'audio', 'Requirement 4: track is audio');
  assert.equal(controller.stream?.getAudioTracks().length, 1, 'Requirement 4: exactly one audio track in stream');

  // Verify 5: silence preserved between clips
  // Gap 1: from clip 0 end (3.9s) to clip 1 start (7.1s) = 3.2s silence
  assert.ok(src0.stoppedAt! < src1.startedAt!, 'Requirement 5: positive gap between clip 1 and clip 2');
  const silenceGap1 = src1.startedAt! - src0.stoppedAt!;
  assert.equal(Math.round(silenceGap1 * 10) / 10, 3.2, 'Requirement 5: exactly 3.2s silence between clip 1 & 2');

  // Gap 2: from clip 1 end (9.7s) to clip 2 start (12.0s) = 2.3s silence
  assert.ok(src1.stoppedAt! < src2.startedAt!, 'Requirement 5: positive gap between clip 2 and clip 3');
  const silenceGap2 = src2.startedAt! - src1.stoppedAt!;
  assert.equal(Math.round(silenceGap2 * 10) / 10, 2.3, 'Requirement 5: exactly 2.3s silence between clip 2 & 3');

  // Verify 6: no overlap
  assert.ok(src0.stoppedAt! <= src1.startedAt!, 'Requirement 6: clip 0 does not overlap clip 1');
  assert.ok(src1.stoppedAt! <= src2.startedAt!, 'Requirement 6: clip 1 does not overlap clip 2');

  // Verify 7: cancel stops all sources
  controller.cancel();
  assert.equal(src0.state, 'stopped', 'Requirement 7: cancel stops source 0');
  assert.equal(src1.state, 'stopped', 'Requirement 7: cancel stops source 1');
  assert.equal(src2.state, 'stopped', 'Requirement 7: cancel stops source 2');
  assert.equal((controller.audioTrack as unknown as MockMediaStreamTrack).readyState, 'ended', 'Requirement 7: audio track ended');

  // Verify 8: cleanup idempotent
  controller.cleanup();
  assert.equal(mockCtx.state, 'closed', 'Requirement 8: cleanup closes context');
  assert.doesNotThrow(() => {
    controller.cleanup();
  }, 'Requirement 8: repeated cleanup does not throw');

  // Verify 9: one failed clip does not kill others
  const partialProvider: NarrationAudioProvider = async (item) => {
    if (item.id === 'narr-coach2') return null; // clip 2 fails
    return (mockBuffers[item.id] || new MockAudioBuffer({ duration: 2.0 })) as unknown as AudioBuffer;
  };
  const partialCtx = new MockAudioContext();
  const partialController = await prepareNarrationAudioTrack({
    items,
    audioProvider: partialProvider,
    audioContext: partialCtx as unknown as AudioContext,
  });
  assert.equal(partialController.scheduledClipsCount, 2, 'Requirement 9: 2 clips scheduled when 1 fails');
  assert.equal(partialCtx.createdSources[0].startedAt, 2.1, 'Requirement 9: clip 1 still scheduled at 2.1s');
  assert.equal(partialCtx.createdSources[1].startedAt, 12.0, 'Requirement 9: clip 3 still scheduled at 12.0s');
  partialController.cleanup();

  // Verify 10: all failed clips produce clean no-audio result
  const totalFailCtx = new MockAudioContext();
  const totalFailController = await prepareNarrationAudioTrack({
    items,
    audioProvider: async () => null,
    audioContext: totalFailCtx as unknown as AudioContext,
  });
  assert.equal(totalFailController.scheduledClipsCount, 0, 'Requirement 10: scheduled count is 0');
  assert.equal(totalFailController.audioTrack, null, 'Requirement 10: audioTrack is null');
  assert.equal(totalFailController.stream, null, 'Requirement 10: stream is null');
  assert.doesNotThrow(() => {
    totalFailController.cancel();
    totalFailController.cleanup();
  }, 'Requirement 10: cancel and cleanup on empty result do not throw');
});
