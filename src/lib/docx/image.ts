import { ImageRun } from 'docx';
import { MAX_IMG_WIDTH } from './constants';

export type DocxImageType = 'png' | 'jpg' | 'gif' | 'bmp';

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface DecodedDataUrl {
  bytes: Uint8Array;
  imageType: DocxImageType;
}

/**
 * Per-build cache for `measureImage`. The builder creates one fresh cache
 * per `generateDocx` invocation and threads it to every call site, so
 * memory is released when the export finishes (see R8 #2).
 */
export type MeasureCache = Map<string, ImageDimensions>;

/**
 * Parse a `data:image/*;base64,...` URL into a byte buffer + type tag.
 * Returns null for anything that is not a recognizable image data URL
 * (including PDF data URLs).
 *
 * Quirk: some serializers insert whitespace inside the base64 payload; we
 * strip non-base64 characters and repair missing '=' padding.
 */
export function decodeDataUrl(dataUrl: string): DecodedDataUrl | null {
  if (!dataUrl || !dataUrl.startsWith('data:image/')) return null;
  const mimeMatch = dataUrl.match(/^data:image\/(png|jpeg|jpg|gif|bmp);base64,/i);
  if (!mimeMatch) return null;

  const mime = mimeMatch[1].toLowerCase();
  const imageType: DocxImageType =
    mime === 'jpeg' || mime === 'jpg' ? 'jpg'
    : mime === 'gif' ? 'gif'
    : mime === 'bmp' ? 'bmp'
    : 'png';

  const payload = dataUrl.split(',')[1] ?? '';
  let cleanBase64 = payload.replace(/[^A-Za-z0-9+/=]/g, '');
  const padNeeded = (4 - (cleanBase64.length % 4)) % 4;
  if (padNeeded) cleanBase64 += '='.repeat(padNeeded);

  try {
    const binaryString = atob(cleanBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return { bytes, imageType };
  } catch {
    return null;
  }
}

/**
 * Module-level cache for `measureImage` results. The same image data URL
 * frequently appears multiple times within a single `generateDocx` build
 * (e.g. when the AI references the same screenshot from multiple cells),
 * so caching by URL string saves the synthetic `Image()` decode each time.
 *
 * Memory note: data URLs can be large (~MB each), so we cap the cache at
 * 256 entries via simple FIFO eviction.
 */
const measureCacheGlobal: MeasureCache = new Map();
const MEASURE_CACHE_MAX = 256;

function rememberMeasurement(src: string, dim: ImageDimensions) {
  if (measureCacheGlobal.size >= MEASURE_CACHE_MAX) {
    const firstKey = measureCacheGlobal.keys().next().value;
    if (firstKey !== undefined) measureCacheGlobal.delete(firstKey);
  }
  measureCacheGlobal.set(src, dim);
}

/**
 * Measure a raster image via a browser `Image()`. Returns `fallback` on
 * error. Pass a `cache` to deduplicate measurements across a single build.
 */
export function measureImage(
  src: string,
  cache?: MeasureCache,
  fallback: ImageDimensions = { width: 0, height: 0 },
): Promise<ImageDimensions> {
  if (cache && cache.has(src)) return Promise.resolve(cache.get(src)!);
  if (measureCacheGlobal.has(src)) return Promise.resolve(measureCacheGlobal.get(src)!);
  return new Promise<ImageDimensions>((resolve) => {
    if (typeof globalThis === 'undefined' || typeof (globalThis as { Image?: unknown }).Image === 'undefined') {
      resolve(fallback);
      return;
    }
    const ImgCtor = (globalThis as unknown as { Image: new () => HTMLImageElement }).Image;
    const img = new ImgCtor();
    img.onload = () => {
      const dim = { width: img.width, height: img.height };
      cache?.set(src, dim);
      rememberMeasurement(src, dim);
      resolve(dim);
    };
    img.onerror = () => resolve(fallback);
    img.src = src;
  });
}

/**
 * Clamp `(w, h)` to `max` width while preserving aspect ratio. Identity
 * when already within bounds. Defensive against zero/negative inputs.
 */
export function clampToMaxWidth(
  w: number,
  h: number,
  max: number = MAX_IMG_WIDTH,
): ImageDimensions {
  if (w <= 0 || h <= 0) return { width: Math.max(w, 0), height: Math.max(h, 0) };
  if (w <= max) return { width: w, height: h };
  const ratio = max / w;
  return { width: max, height: h * ratio };
}

export interface ToImageRunOpts {
  maxWidth?: number;
  /**
   * Legacy markdown-inline sizing: halve measured pixels, with `minSize`
   * as a floor when measurement returns zero. Used by data-URL/KaTeX
   * images inlined via `parseMarkdownToParagraphs` to preserve the
   * pre-refactor on-page sizing.
   */
  halfScale?: boolean;
  minSize?: ImageDimensions;
  /** Dimensions to resolve to if `Image.onerror` fires. */
  measureFallback?: ImageDimensions;
  /** Shared `MeasureCache` for the current build. */
  cache?: MeasureCache;
  /** Override the detected image type (e.g. force 'png' for fetched buffers). */
  forceType?: DocxImageType;
  /** Skip measurement and use these dimensions directly. */
  preMeasured?: ImageDimensions;
}

export type ToImageRunInput =
  | string
  | {
      buffer: ArrayBuffer;
      measureSrc?: string;
      forceType?: DocxImageType;
    };

/**
 * Unified factory for every `ImageRun` emitted by the DOCX builder.
 *
 * Accepts one of:
 *  - a `data:image/*` URL (decoded inline, measured via `measureImage`)
 *  - an external http(s) URL (fetched + measured via a temporary ObjectURL;
 *    routed through AllOrigins for codecogs.com to work around CORS on
 *    KaTeX → PNG fetches)
 *  - a pre-decoded `ArrayBuffer` (optionally with `measureSrc` for
 *    measurement, or with `opts.preMeasured` to skip measurement entirely).
 *
 * Returns `null` if the input cannot be decoded or measured, so callers
 * can fall back to a text placeholder.
 */
export async function toImageRun(
  src: ToImageRunInput,
  opts: ToImageRunOpts = {},
): Promise<ImageRun | null> {
  const {
    maxWidth = MAX_IMG_WIDTH,
    halfScale = false,
    minSize,
    measureFallback,
    cache,
    forceType,
    preMeasured,
  } = opts;

  let bytes: ArrayBuffer | Uint8Array | null = null;
  let imageType: DocxImageType = 'png';
  let measureSrc = '';
  let dim: ImageDimensions | null = null;

  if (typeof src === 'string') {
    measureSrc = src;
    if (src.startsWith('data:image/')) {
      const decoded = decodeDataUrl(src);
      if (!decoded) return null;
      bytes = decoded.bytes;
      imageType = forceType ?? decoded.imageType;
    } else {
      // External URL. Route codecogs via AllOrigins (CORS workaround).
      const isCodeCogs = src.includes('codecogs.com');
      const fetchUrl = isCodeCogs
        ? `https://api.allorigins.win/raw?url=${encodeURIComponent(src)}`
        : src;
      try {
        const response = await fetch(fetchUrl);
        if (!response.ok) return null;
        const blob = await response.blob();
        bytes = await blob.arrayBuffer();
        imageType = forceType ?? 'png';
        if (
          !preMeasured &&
          typeof window !== 'undefined' &&
          typeof window.URL?.createObjectURL === 'function'
        ) {
          const objectUrl = window.URL.createObjectURL(blob);
          try {
            dim = await measureImage(objectUrl, cache, measureFallback);
          } finally {
            window.URL.revokeObjectURL(objectUrl);
          }
        }
      } catch {
        return null;
      }
    }
  } else {
    bytes = src.buffer;
    imageType = src.forceType ?? forceType ?? 'png';
    measureSrc = src.measureSrc ?? '';
  }

  if (!bytes) return null;

  if (preMeasured) {
    dim = preMeasured;
  } else if (!dim) {
    if (measureSrc) {
      dim = await measureImage(measureSrc, cache, measureFallback);
    } else {
      // Pre-decoded buffer with no measurement source and no preMeasured
      // hint — fall back to the provided legacy measureFallback or fail.
      dim = measureFallback ?? { width: 0, height: 0 };
    }
  }

  return buildRun(bytes, dim, imageType, { halfScale, minSize, maxWidth });
}

function buildRun(
  bytes: ArrayBuffer | Uint8Array,
  dim: ImageDimensions,
  imageType: DocxImageType,
  sizing: { halfScale: boolean; minSize?: ImageDimensions; maxWidth: number },
): ImageRun | null {
  let w = dim.width;
  let h = dim.height;

  if (sizing.halfScale) {
    // Legacy: halve measured pixels, with a defensive floor for zero-measure.
    w = w > 0 ? w / 2 : sizing.minSize?.width ?? 100;
    h = h > 0 ? h / 2 : sizing.minSize?.height ?? 16;
  } else if (w <= 0 || h <= 0) {
    // Natural-size path: if measurement failed, bail.
    return null;
  }

  let clampedW = w;
  let clampedH = h;
  if (clampedW > sizing.maxWidth) {
    const ratio = sizing.maxWidth / clampedW;
    clampedW = sizing.maxWidth;
    clampedH = clampedH * ratio;
  }

  const data = bytes instanceof Uint8Array ? bytes.buffer : bytes;

  return new ImageRun({
    data,
    transformation: { width: clampedW, height: clampedH },
    type: imageType,
  });
}
