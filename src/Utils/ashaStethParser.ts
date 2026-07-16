import { Buffer } from 'buffer';
import { payloadToBytes } from './ashaEcgParser';

const globalBuffer = globalThis as typeof globalThis & { Buffer?: typeof Buffer };
globalBuffer.Buffer = globalBuffer.Buffer ?? Buffer;

/** Minimum time user should record before Stop (matches UI guard). */
export const ASHA_STETH_MIN_RECORD_MS = 5000;
/** Keep listening after Stop command for late-arriving audio from device. */
export const ASHA_STETH_POST_STOP_WAIT_MS = 12000;

export const ASHA_STETH_STORAGE_FORMAT = 'asha-steth-wav-v1' as const;
const MAX_API_WAVEFORM_POINTS = 256;

export type AshaStoredStethPayload = {
  format: typeof ASHA_STETH_STORAGE_FORMAT;
  /** Valid WAV file size (from `RIFF` header, excluding `C_Saved` / `C_Steth` text prefix). */
  byteCount: number;
  sampleCount: number;
  beatCount: number;
  sampleRate: number;
  audioMime: 'audio/wav';
  /** Downsampled PCM amplitudes for API / waveform preview. */
  samples: number[];
  /** Full `.wav` file as base64 (playable on backend). */
  audioBase64: string;
  status?: string;
  capturedAt: string;
};

export type AshaStethoscopeAnalysis = {
  isWav: boolean;
  wavByteCount: number;
  sampleRate: number;
  sampleCount: number;
  beatCount: number;
  beatPeakIndexes: number[];
  waveformPreview: number[];
};

export function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

export function payloadIncludesWav(payload: string): boolean {
  return payload.includes('RIFF') && payload.includes('WAVE');
}

/** Status-only line e.g. `C_Steth Recording..._#` without embedded WAV. */
export function isAshaStethStatusOnlyPayload(payload: string): boolean {
  const clean = String(payload || '').trim();
  if (payloadIncludesWav(payload)) return false;
  return /^C_(?:Steth|Saved)\s+.+_#$/i.test(clean);
}

export function parseAshaStethStatusMessage(payload: string): string {
  const clean = String(payload || '').trim();
  const match = clean.match(/^C_(?:Steth|Saved)\s+(.+?)_#/i);
  return match ? match[1].trim() : clean;
}

export function findWavStartIndex(bytes: Uint8Array): number {
  for (let i = 0; i <= bytes.length - 4; i += 1) {
    if (
      bytes[i] === 0x52 &&
      bytes[i + 1] === 0x49 &&
      bytes[i + 2] === 0x46 &&
      bytes[i + 3] === 0x46
    ) {
      return i;
    }
  }
  return -1;
}

export function extractWavBytes(rawBuffer: string): Uint8Array | null {
  const bytes = payloadToBytes(rawBuffer);
  const riffAt = findWavStartIndex(bytes);
  if (riffAt < 0) return null;
  return bytes.slice(riffAt);
}

function readUint32Le(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  );
}

function readUint16Le(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

/** Parse PCM16 from a WAV byte stream (works with incomplete stream — uses all available `data` bytes). */
export function parseWavPcm16(wavBytes: Uint8Array): {
  pcmSamples: number[];
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
} {
  if (wavBytes.length < 44) {
    return { pcmSamples: [], sampleRate: 8000, channels: 1, bitsPerSample: 16 };
  }

  const channels = readUint16Le(wavBytes, 22);
  const sampleRate = readUint32Le(wavBytes, 24);
  const bitsPerSample = readUint16Le(wavBytes, 34);

  let offset = 12;
  while (offset + 8 <= wavBytes.length) {
    const chunkId = String.fromCharCode(
      wavBytes[offset],
      wavBytes[offset + 1],
      wavBytes[offset + 2],
      wavBytes[offset + 3],
    );
    const chunkSize = readUint32Le(wavBytes, offset + 4);
    if (chunkId === 'data') {
      const dataStart = offset + 8;
      const dataEnd = Math.min(wavBytes.length, dataStart + chunkSize);
      const pcmBytes = wavBytes.slice(dataStart, dataEnd);
      const pcmSamples: number[] = [];
      for (let i = 0; i + 1 < pcmBytes.length; i += 2) {
        const lo = pcmBytes[i];
        const hi = pcmBytes[i + 1];
        let val = lo | (hi << 8);
        if (val & 0x8000) val -= 0x10000;
        pcmSamples.push(val);
      }
      return {
        pcmSamples,
        sampleRate: sampleRate || 8000,
        channels: channels || 1,
        bitsPerSample: bitsPerSample || 16,
      };
    }
    offset += 8 + chunkSize;
  }

  return { pcmSamples: [], sampleRate: sampleRate || 8000, channels: 1, bitsPerSample: 16 };
}

export function downsamplePcm(samples: number[], maxPoints: number): number[] {
  if (samples.length <= maxPoints) return samples;
  const result: number[] = [];
  const step = samples.length / maxPoints;
  for (let i = 0; i < maxPoints; i += 1) {
    result.push(samples[Math.floor(i * step)]);
  }
  return result;
}

/** Heartbeat peak detection on 16-bit PCM (not raw bytes). */
export function estimateHeartbeatPeaksFromPcm(pcmSamples: number[]): number[] {
  if (pcmSamples.length < 80) return [];

  const abs = pcmSamples.map(sample => Math.abs(sample));
  const avg = abs.reduce((sum, value) => sum + value, 0) / abs.length;
  const threshold = Math.max(avg * 1.8, 200);
  const refractory = Math.max(40, Math.floor(pcmSamples.length / 40));

  const peaks: number[] = [];
  let lastPeak = -refractory * 2;

  for (let i = 1; i < abs.length - 1; i += 1) {
    const curr = abs[i];
    if (
      curr >= threshold &&
      curr > abs[i - 1] &&
      curr >= abs[i + 1] &&
      i - lastPeak >= refractory
    ) {
      peaks.push(i);
      lastPeak = i;
    }
  }

  return peaks;
}

export function analyzeStethoscopeBuffer(rawBuffer: string): AshaStethoscopeAnalysis {
  const wavBytes = extractWavBytes(rawBuffer);
  if (!wavBytes || wavBytes.length < 12) {
    return {
      isWav: false,
      wavByteCount: 0,
      sampleRate: 0,
      sampleCount: 0,
      beatCount: 0,
      beatPeakIndexes: [],
      waveformPreview: [],
    };
  }

  const { pcmSamples, sampleRate } = parseWavPcm16(wavBytes);
  const beatPeakIndexes = estimateHeartbeatPeaksFromPcm(pcmSamples);
  const waveformPreview = downsamplePcm(pcmSamples, MAX_API_WAVEFORM_POINTS);

  return {
    isWav: true,
    wavByteCount: wavBytes.length,
    sampleRate,
    sampleCount: pcmSamples.length,
    beatCount: beatPeakIndexes.length,
    beatPeakIndexes,
    waveformPreview,
  };
}

export function buildStoredStethPayload(
  rawBuffer: string,
  capturedAt: string,
  status?: string,
): AshaStoredStethPayload | null {
  const wavBytes = extractWavBytes(rawBuffer);
  if (!wavBytes || wavBytes.length < 44) return null;

  const analysis = analyzeStethoscopeBuffer(rawBuffer);

  return {
    format: ASHA_STETH_STORAGE_FORMAT,
    byteCount: wavBytes.length,
    sampleCount: analysis.sampleCount,
    beatCount: analysis.beatCount,
    sampleRate: analysis.sampleRate,
    audioMime: 'audio/wav',
    samples: analysis.waveformPreview,
    audioBase64: bytesToBase64(wavBytes),
    status,
    capturedAt,
  };
}

export function buildAshaStethoscopeApiResult(payload: AshaStoredStethPayload) {
  return {
    audio_base64: payload.audioBase64,
    format: payload.format,
    audio_mime: payload.audioMime,
    byte_count: payload.byteCount,
    sample_count: payload.sampleCount,
    sample_rate: payload.sampleRate,
    beat_count: payload.beatCount,
    ...(payload.samples.length > 0 ? { samples: payload.samples } : {}),
    ...(payload.status ? { status: payload.status } : {}),
  };
}
