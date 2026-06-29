/** Asha ECG streams binary waveform bytes over Bluetooth Classic (not image files). */

const BACKSLASH_BYTE = 0x5c;
const MAX_STORED_ECG_SAMPLES = 2000;

export type AshaEcgPayloadKind = 'wave-start' | 'status' | 'samples' | 'unknown';

export function payloadToBytes(payload: string): Uint8Array {
  const bytes = new Uint8Array(payload.length);
  for (let i = 0; i < payload.length; i += 1) {
    bytes[i] = payload.charCodeAt(i) & 0xff;
  }
  return bytes;
}

export function classifyAshaEcgPayload(payload: string): AshaEcgPayloadKind {
  const clean = String(payload || '').trim();
  if (!clean) return 'unknown';
  if (clean === 'W') return 'wave-start';
  if (/^C_.*#$/i.test(clean)) return 'status';
  if (clean.length >= 2) return 'samples';
  return 'unknown';
}

/**
 * Asha ECG packets appear as repeated `\` + amplitude-byte pairs (0–255).
 * Falls back to raw bytes when the delimiter pattern is not detected.
 */
export function parseAshaEcgSamples(payload: string): number[] {
  const bytes = payloadToBytes(payload);
  if (bytes.length < 2) return [];

  const pairSamples: number[] = [];
  let delimiterHits = 0;

  for (let i = 0; i + 1 < bytes.length; i += 2) {
    if (bytes[i] === BACKSLASH_BYTE) {
      delimiterHits += 1;
      pairSamples.push(bytes[i + 1]);
    }
  }

  const expectedPairs = Math.floor(bytes.length / 2);
  if (expectedPairs > 0 && delimiterHits / expectedPairs >= 0.6) {
    return pairSamples;
  }

  const rawSamples: number[] = [];
  for (let i = 0; i < bytes.length; i += 1) {
    if (bytes[i] === BACKSLASH_BYTE) continue;
    rawSamples.push(bytes[i]);
  }
  return rawSamples.length > 0 ? rawSamples : [...bytes];
}

export function appendEcgSamples(existing: number[], incoming: number[]): number[] {
  if (incoming.length === 0) return existing;
  const merged = existing.concat(incoming);
  if (merged.length <= MAX_STORED_ECG_SAMPLES) return merged;
  return merged.slice(merged.length - MAX_STORED_ECG_SAMPLES);
}

export function formatEcgSummary(sampleCount: number): string {
  return `ECG wave (${sampleCount} samples)`;
}

/** Local storage + future preventive-health report API payload shape. */
export const ASHA_ECG_STORAGE_FORMAT = 'asha-ecg-v1' as const;

export type AshaStoredEcgPayload = {
  format: typeof ASHA_ECG_STORAGE_FORMAT;
  sampleCount: number;
  /** Raw amplitude bytes 0–255 (interleaved dual-lead stream from device). */
  samples: number[];
  capturedAt: string;
};

export function buildStoredEcgPayload(
  samples: number[],
  capturedAt: string,
): AshaStoredEcgPayload {
  const clipped = samples.slice(-MAX_STORED_ECG_SAMPLES);
  return {
    format: ASHA_ECG_STORAGE_FORMAT,
    sampleCount: clipped.length,
    samples: clipped,
    capturedAt,
  };
}

export function splitEcgLeads(samples: number[]): { lead1: number[]; lead2: number[] } {
  const lead1: number[] = [];
  const lead2: number[] = [];
  samples.forEach((sample, index) => {
    if (index % 2 === 0) {
      lead1.push(sample);
    } else {
      lead2.push(sample);
    }
  });
  return { lead1, lead2 };
}

export function getEcgLaneBaseline(samples: number[]): number {
  if (samples.length === 0) {
    return 128;
  }

  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * Min/max envelope downsampling keeps both upward (R) and downward (Q/S) deflections
 * inside each horizontal bucket — critical for readable PQRST-style morphology.
 */
export function downsampleEcgMinMaxEnvelope(
  samples: number[],
  bucketCount: number,
): number[] {
  if (samples.length <= bucketCount || bucketCount < 2) {
    return samples;
  }

  const output: number[] = [];
  const step = samples.length / bucketCount;

  for (let i = 0; i < bucketCount; i += 1) {
    const from = Math.floor(i * step);
    const to = Math.floor((i + 1) * step);
    if (from >= to) {
      output.push(samples[from]);
      continue;
    }

    let min = samples[from];
    let max = samples[from];
    let minIndex = from;
    let maxIndex = from;

    for (let j = from + 1; j < to; j += 1) {
      if (samples[j] < min) {
        min = samples[j];
        minIndex = j;
      }
      if (samples[j] > max) {
        max = samples[j];
        maxIndex = j;
      }
    }

    if (minIndex <= maxIndex) {
      output.push(min, max);
    } else {
      output.push(max, min);
    }
  }

  return output;
}

export function downsampleEcgPreservePeaks(samples: number[], targetCount: number): number[] {
  if (samples.length <= targetCount || targetCount < 2) {
    return samples;
  }

  const output: number[] = [];
  const step = samples.length / targetCount;
  const mid = 128;

  for (let i = 0; i < targetCount; i += 1) {
    const from = Math.floor(i * step);
    const to = Math.floor((i + 1) * step);
    let pick = samples[from];
    let maxDeviation = -1;

    for (let j = from; j < to; j += 1) {
      const deviation = Math.abs(samples[j] - mid);
      if (deviation > maxDeviation) {
        maxDeviation = deviation;
        pick = samples[j];
      }
    }

    output.push(pick);
  }

  return output;
}

export { MAX_STORED_ECG_SAMPLES };
