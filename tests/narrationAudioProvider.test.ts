import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBrowserNarrationAudioProvider,
  clearNarrationAudioCache,
  getNarrationAudioCacheSize,
  getNormalizedCacheKey,
  DEFAULT_TTS_LANGUAGE,
  DEFAULT_TTS_VOICE,
  MAX_TTS_TEXT_LENGTH,
  DEFAULT_TTS_ENDPOINT,
} from '../src/services/narrationAudioProvider';
import {
  CoachingNarrationItem,
  prepareNarrationAudioTrack,
} from '../src/services/coachingNarration';

// =============================================================================
// Mock AudioContext and AudioBuffer for Testing
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

class MockAudioContext {
  decodeCallCount = 0;
  shouldFailDecode = false;

  decodeAudioData(
    arrayBuffer: ArrayBuffer,
    successCallback?: (buf: AudioBuffer) => void,
    errorCallback?: (err: any) => void
  ): Promise<AudioBuffer> {
    this.decodeCallCount++;
    if (this.shouldFailDecode || !arrayBuffer || arrayBuffer.byteLength === 0) {
      const err = new Error('MockAudioDecodeError: Unable to decode audio bytes');
      if (errorCallback) errorCallback(err);
      return Promise.reject(err);
    }
    const mockBuf = new MockAudioBuffer({ duration: 1.8 }) as unknown as AudioBuffer;
    if (successCallback) successCallback(mockBuf);
    return Promise.resolve(mockBuf);
  }
}

// Helpers to create mock fetch responses
function createMockFetch(responseConfig: {
  ok: boolean;
  status: number;
  contentType?: string;
  bytes?: Uint8Array;
  onCall?: (url: string, init: RequestInit) => void;
}) {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (responseConfig.onCall) {
      responseConfig.onCall(String(input), init || {});
    }

    const headers = new Headers();
    if (responseConfig.contentType) {
      headers.set('content-type', responseConfig.contentType);
    }

    const bodyBytes = responseConfig.bytes || new Uint8Array([1, 2, 3, 4]);

    return {
      ok: responseConfig.ok,
      status: responseConfig.status,
      headers,
      arrayBuffer: async () => bodyBytes.buffer,
      json: async () => ({ error: 'Simulated server error' }),
    } as unknown as Response;
  };
}

const sampleItem: CoachingNarrationItem = {
  id: 'narr-1',
  coachingMomentId: 'coach1',
  startPresentationTime: 2.1,
  maxDuration: 2.6,
  text: 'Kiểm tra vai trước khi bóng đến.',
  estimatedSpeechDuration: 1.8,
};

// =============================================================================
// TASK TTS-A3a TESTS: Vietnamese Narration Audio Provider
// =============================================================================

test('TTS-A3a: provider sends exact POST request body and endpoint', async () => {
  let capturedUrl = '';
  let capturedInit: RequestInit = {};

  const mockFetch = createMockFetch({
    ok: true,
    status: 200,
    contentType: 'audio/mpeg',
    onCall: (url, init) => {
      capturedUrl = url;
      capturedInit = init;
    },
  });

  const mockCtx = new MockAudioContext();
  const provider = createBrowserNarrationAudioProvider({
    fetchFn: mockFetch,
    audioContext: mockCtx as unknown as AudioContext,
    enableCache: false,
  });

  const result = await provider(sampleItem);

  assert.ok(result, 'Must successfully return decoded AudioBuffer');
  assert.equal(capturedUrl, DEFAULT_TTS_ENDPOINT, 'Must call default endpoint /api/tts');
  assert.equal(capturedInit.method, 'POST');

  const headers = capturedInit.headers as Record<string, string>;
  assert.equal(headers['Content-Type'], 'application/json');

  const parsedBody = JSON.parse(String(capturedInit.body));
  assert.equal(parsedBody.text, 'Kiểm tra vai trước khi bóng đến.');
  assert.equal(parsedBody.language, 'vi-VN');
  assert.equal(parsedBody.voice, 'vi-VN-Standard-A');
});

test('TTS-A3a: default language is vi-VN and neutral voice', async () => {
  let capturedBody: any = null;

  const mockFetch = createMockFetch({
    ok: true,
    status: 200,
    contentType: 'audio/mpeg',
    onCall: (_url, init) => {
      capturedBody = JSON.parse(String(init.body));
    },
  });

  const provider = createBrowserNarrationAudioProvider({
    fetchFn: mockFetch,
    audioContext: new MockAudioContext() as unknown as AudioContext,
    enableCache: false,
  });

  await provider(sampleItem);

  assert.ok(capturedBody);
  assert.equal(capturedBody.language, DEFAULT_TTS_LANGUAGE);
  assert.equal(capturedBody.language, 'vi-VN');
  assert.equal(capturedBody.voice, DEFAULT_TTS_VOICE);
  assert.equal(capturedBody.voice, 'vi-VN-Standard-A');
});

test('TTS-A3a: AbortSignal stops request and returns null cleanly', async () => {
  const abortController = new AbortController();
  abortController.abort(); // already aborted

  let wasFetchCalled = false;
  const mockFetch = async () => {
    wasFetchCalled = true;
    throw new Error('Should not be called when already aborted');
  };

  const provider = createBrowserNarrationAudioProvider({
    fetchFn: mockFetch as any,
    audioContext: new MockAudioContext() as unknown as AudioContext,
    enableCache: false,
  });

  const result = await provider(sampleItem, abortController.signal);
  assert.equal(result, null, 'Must return null when signal is already aborted');
  assert.equal(wasFetchCalled, false, 'Fetch should not be called when aborted beforehand');

  // Test abortion during active fetch
  const dynamicAbort = new AbortController();
  const abortingFetch = async (_url: any, init: any) => {
    init.signal?.throwIfAborted?.();
    const err = new Error('The operation was aborted');
    err.name = 'AbortError';
    throw err;
  };

  const dynamicProvider = createBrowserNarrationAudioProvider({
    fetchFn: abortingFetch as any,
    audioContext: new MockAudioContext() as unknown as AudioContext,
    enableCache: false,
  });

  const dynamicResult = await dynamicProvider(sampleItem, dynamicAbort.signal);
  assert.equal(dynamicResult, null, 'Must return null on AbortError');
});

test('TTS-A3a: successful audio decode returns AudioBuffer with valid duration', async () => {
  const mockCtx = new MockAudioContext();
  const mockFetch = createMockFetch({
    ok: true,
    status: 200,
    contentType: 'audio/mpeg',
    bytes: new Uint8Array([73, 68, 51, 3, 0, 0, 0]),
  });

  const provider = createBrowserNarrationAudioProvider({
    fetchFn: mockFetch,
    audioContext: mockCtx as unknown as AudioContext,
    enableCache: false,
  });

  const buffer = await provider(sampleItem);
  assert.ok(buffer, 'Must return AudioBuffer');
  assert.equal(buffer.duration, 1.8);
  assert.equal(mockCtx.decodeCallCount, 1, 'Must call decodeAudioData once');
});

test('TTS-A3a: 4xx and 5xx responses return null without throwing', async () => {
  const testStatuses = [400, 403, 404, 500, 502, 503];

  for (const status of testStatuses) {
    const mockFetch = createMockFetch({
      ok: false,
      status,
      contentType: 'application/json',
    });

    const provider = createBrowserNarrationAudioProvider({
      fetchFn: mockFetch,
      audioContext: new MockAudioContext() as unknown as AudioContext,
      enableCache: false,
    });

    const result = await provider(sampleItem);
    assert.equal(result, null, `Status ${status} must return null`);
  }
});

test('TTS-A3a: malformed audio response and decode errors return null without crash', async () => {
  const mockCtx = new MockAudioContext();
  mockCtx.shouldFailDecode = true; // force decodeAudioData failure

  const mockFetch = createMockFetch({
    ok: true,
    status: 200,
    contentType: 'audio/mpeg',
    bytes: new Uint8Array([0, 0]), // corrupt bytes
  });

  const provider = createBrowserNarrationAudioProvider({
    fetchFn: mockFetch,
    audioContext: mockCtx as unknown as AudioContext,
    enableCache: false,
  });

  const result = await provider(sampleItem);
  assert.equal(result, null, 'Must return null when decoding fails');
});

test('TTS-A3a: text length safety clamps overly long text to MAX_TTS_TEXT_LENGTH', async () => {
  let capturedText = '';

  const mockFetch = createMockFetch({
    ok: true,
    status: 200,
    contentType: 'audio/mpeg',
    onCall: (_url, init) => {
      const parsed = JSON.parse(String(init.body));
      capturedText = parsed.text;
    },
  });

  const provider = createBrowserNarrationAudioProvider({
    fetchFn: mockFetch,
    audioContext: new MockAudioContext() as unknown as AudioContext,
    enableCache: false,
  });

  const longText = 'Cầu thủ cần quan sát '.repeat(30); // ~630 characters
  assert.ok(longText.length > MAX_TTS_TEXT_LENGTH);

  await provider({
    ...sampleItem,
    text: longText,
  });

  assert.equal(capturedText.length, MAX_TTS_TEXT_LENGTH, `Text must be clamped to ${MAX_TTS_TEXT_LENGTH}`);
});

test('TTS-A3a: in-memory caching reuses decoded buffer and avoids duplicate network requests', async () => {
  clearNarrationAudioCache();
  assert.equal(getNarrationAudioCacheSize(), 0);

  let fetchCount = 0;
  const mockFetch = createMockFetch({
    ok: true,
    status: 200,
    contentType: 'audio/mpeg',
    onCall: () => {
      fetchCount++;
    },
  });

  const mockCtx = new MockAudioContext();
  const provider = createBrowserNarrationAudioProvider({
    fetchFn: mockFetch,
    audioContext: mockCtx as unknown as AudioContext,
    enableCache: true,
  });

  // First request: hits fetch & decodes
  const buf1 = await provider(sampleItem);
  assert.ok(buf1);
  assert.equal(fetchCount, 1);
  assert.equal(getNarrationAudioCacheSize(), 1);

  // Second request with same item: returns cached buffer without calling fetch
  const buf2 = await provider(sampleItem);
  assert.ok(buf2);
  assert.equal(fetchCount, 1, 'Must not make second fetch request for cached item');
  assert.equal(buf1, buf2, 'Must return the exact cached AudioBuffer reference');

  // Clear cache
  clearNarrationAudioCache();
  assert.equal(getNarrationAudioCacheSize(), 0);

  // Third request after clear: fetches again
  const buf3 = await provider(sampleItem);
  assert.ok(buf3);
  assert.equal(fetchCount, 2, 'Must fetch again after cache is cleared');
});

test('TTS-A3a: missing provider config (503 TTS_UNAVAILABLE) returns null cleanly', async () => {
  const mockFetch = createMockFetch({
    ok: false,
    status: 503,
    contentType: 'application/json',
  });

  const provider = createBrowserNarrationAudioProvider({
    fetchFn: mockFetch,
    audioContext: new MockAudioContext() as unknown as AudioContext,
    enableCache: false,
  });

  const result = await provider(sampleItem);
  assert.equal(result, null, 'Must return null when provider is unconfigured');
});

test('TTS-A3a: client request never exposes API keys or secrets', async () => {
  let capturedHeaders: any = {};
  let capturedBody: any = {};

  const mockFetch = createMockFetch({
    ok: true,
    status: 200,
    contentType: 'audio/mpeg',
    onCall: (_url, init) => {
      capturedHeaders = init.headers || {};
      capturedBody = JSON.parse(String(init.body));
    },
  });

  const provider = createBrowserNarrationAudioProvider({
    fetchFn: mockFetch,
    audioContext: new MockAudioContext() as unknown as AudioContext,
    enableCache: false,
  });

  await provider(sampleItem);

  // Verify headers
  assert.equal(capturedHeaders['Authorization'], undefined);
  assert.equal(capturedHeaders['x-api-key'], undefined);

  // Verify body
  assert.equal(capturedBody['apiKey'], undefined);
  assert.equal(capturedBody['key'], undefined);
  assert.equal(capturedBody['secret'], undefined);

  // Only allowed fields
  const keys = Object.keys(capturedBody).sort();
  assert.deepEqual(keys, ['language', 'text', 'voice']);
});

test('TTS-A3a: full integration between browser audio provider and TTS-A2 prepareNarrationAudioTrack', async () => {
  clearNarrationAudioCache();

  // Create full TTS-A2 mock context
  class FullMockAudioContext {
    currentTime = 0;
    state: AudioContextState = 'running';
    createdSources: any[] = [];
    createdGainNodes: any[] = [];
    createdDestinations: any[] = [];

    decodeAudioData(
      arrayBuffer: ArrayBuffer,
      successCallback?: (buf: AudioBuffer) => void
    ): Promise<AudioBuffer> {
      const mockBuf = new MockAudioBuffer({ duration: 2.0 }) as unknown as AudioBuffer;
      if (successCallback) successCallback(mockBuf);
      return Promise.resolve(mockBuf);
    }

    createBufferSource() {
      const node = {
        buffer: null as any,
        loop: false,
        startedAt: null as any,
        stoppedAt: null as any,
        state: 'idle',
        connect: (_d: any) => _d,
        disconnect: () => {},
        start: (when: number = 0) => {
          node.startedAt = when;
          node.state = 'started';
        },
        stop: (when: number = 0) => {
          node.stoppedAt = when;
          node.state = 'stopped';
        },
      };
      this.createdSources.push(node);
      return node as unknown as AudioBufferSourceNode;
    }

    createGain() {
      const node = {
        gain: { value: 1.0, setValueAtTime: (v: number) => { node.gain.value = v; } },
        connect: (_d: any) => _d,
        disconnect: () => {},
      };
      this.createdGainNodes.push(node);
      return node as unknown as GainNode;
    }

    createMediaStreamDestination() {
      const node = {
        stream: {
          getAudioTracks: () => [{ kind: 'audio', stop: () => {} }],
          getTracks: () => [{ kind: 'audio', stop: () => {} }],
        },
        connect: (_d: any) => _d,
        disconnect: () => {},
      };
      this.createdDestinations.push(node);
      return node as unknown as MediaStreamAudioDestinationNode;
    }

    async close() {
      this.state = 'closed';
    }
  }

  const mockCtx = new FullMockAudioContext();
  const mockFetch = createMockFetch({
    ok: true,
    status: 200,
    contentType: 'audio/mpeg',
  });

  const audioProvider = createBrowserNarrationAudioProvider({
    fetchFn: mockFetch,
    audioContext: mockCtx as unknown as AudioContext,
    enableCache: true,
  });

  const controller = await prepareNarrationAudioTrack({
    items: [sampleItem],
    audioProvider,
    audioContext: mockCtx as unknown as AudioContext,
  });

  assert.equal(controller.scheduledClipsCount, 1, 'Must successfully schedule 1 clip from provider');
  assert.ok(controller.audioTrack, 'Controller must have valid audioTrack');
  assert.equal(controller.audioTrack.kind, 'audio');

  controller.cleanup();
});
