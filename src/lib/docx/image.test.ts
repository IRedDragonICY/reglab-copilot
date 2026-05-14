// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { decodeDataUrl, clampToMaxWidth } from '@/lib/docx/image';

describe('decodeDataUrl', () => {
  it('returns null for non-image data URLs', () => {
    expect(decodeDataUrl('')).toBeNull();
    expect(decodeDataUrl('data:application/pdf;base64,AAA=')).toBeNull();
    expect(decodeDataUrl('https://example.com/img.png')).toBeNull();
  });

  it('decodes a valid png data URL', () => {
    // 1x1 transparent PNG
    const png =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const decoded = decodeDataUrl(png);
    expect(decoded).not.toBeNull();
    expect(decoded!.imageType).toBe('png');
    expect(decoded!.bytes.byteLength).toBeGreaterThan(0);
  });

  it('normalizes jpeg and jpg mime to "jpg"', () => {
    const jpeg = 'data:image/jpeg;base64,/9j/4AAQ';
    const jpg = 'data:image/jpg;base64,/9j/4AAQ';
    expect(decodeDataUrl(jpeg)?.imageType).toBe('jpg');
    expect(decodeDataUrl(jpg)?.imageType).toBe('jpg');
  });

  it('recognizes gif and bmp mime tags', () => {
    expect(decodeDataUrl('data:image/gif;base64,R0lGODlh')?.imageType).toBe('gif');
    expect(decodeDataUrl('data:image/bmp;base64,Qk0=')?.imageType).toBe('bmp');
  });

  it('repairs base64 with internal whitespace and missing padding', () => {
    // Same PNG as above but with embedded whitespace and no trailing '='.
    const png =
      'data:image/png;base64,iVBO\nRw0K GgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII';
    const decoded = decodeDataUrl(png);
    expect(decoded).not.toBeNull();
    expect(decoded!.bytes.byteLength).toBeGreaterThan(40);
  });
});

describe('clampToMaxWidth', () => {
  it('is identity for widths within bounds', () => {
    expect(clampToMaxWidth(400, 300)).toEqual({ width: 400, height: 300 });
    expect(clampToMaxWidth(600, 400)).toEqual({ width: 600, height: 400 });
  });

  it('scales proportionally when width exceeds the cap', () => {
    expect(clampToMaxWidth(1200, 600)).toEqual({ width: 600, height: 300 });
    expect(clampToMaxWidth(1800, 900, 600)).toEqual({ width: 600, height: 300 });
  });

  it('respects a custom max', () => {
    expect(clampToMaxWidth(800, 400, 400)).toEqual({ width: 400, height: 200 });
    expect(clampToMaxWidth(300, 100, 400)).toEqual({ width: 300, height: 100 });
  });

  it('defends against zero and negative widths', () => {
    expect(clampToMaxWidth(0, 100)).toEqual({ width: 0, height: 100 });
    expect(clampToMaxWidth(-50, 100)).toEqual({ width: 0, height: 100 });
  });
});
