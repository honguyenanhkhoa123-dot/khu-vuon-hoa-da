import { describe, it, expect, vi } from 'vitest';
import { sha256Hex, verifyPasscode } from '../lib/crypto';
import { validateMediaFiles, MAX_VIDEO_BYTES } from '../lib/media';
import { updateJsonFileWithRetry, verifyRepoToken, encodeUtf8Base64 } from '../lib/githubApi';

describe('crypto', () => {
  it('hashes and verifies admin passcode via SHA-256', async () => {
    const hash = await sha256Hex('hoa-da-12');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(await verifyPasscode('hoa-da-12', hash)).toBe(true);
    expect(await verifyPasscode('sai-mat-khau', hash)).toBe(false);
  });
});

describe('media validation (Review Focus #2)', () => {
  it('rejects videos over 20MB and unsupported MIME types with Vietnamese errors', () => {
    const bigVideo = new File([new Uint8Array(10)], 'clip.mp4', { type: 'video/mp4' });
    Object.defineProperty(bigVideo, 'size', { value: MAX_VIDEO_BYTES + 1 });
    const badFile = new File(['abc'], 'notes.pdf', { type: 'application/pdf' });
    const goodImg = new File(['img'], 'lop12.jpg', { type: 'image/jpeg' });

    const res = validateMediaFiles([bigVideo, badFile, goodImg]);
    expect(res.valid).toHaveLength(1);
    expect(res.errors).toHaveLength(2);
    expect(res.errors[0]).toContain('20MB');
    expect(res.errors[1]).toContain('không hỗ trợ');
  });
});

describe('githubApi conflict retry, UTF-8 Vietnamese & bad token (Review Focus #1 & #4)', () => {
  it('retries HTTP 409 SHA mismatch by refetching fresh SHA and preserves Vietnamese UTF-8', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ sha: 'sha-1', content: encodeUtf8Base64('[{"id":"a","body":"Lớp 12 Hóa"}]') }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Conflict' }), { status: 409 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            sha: 'sha-2',
            content: encodeUtf8Base64('[{"id":"a","body":"Lớp 12 Hóa"},{"id":"b","body":"Kỷ yếu"}]')
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ content: { sha: 'sha-3' } }), { status: 200 }));

    vi.stubGlobal('fetch', fetchMock);
    const updated = await updateJsonFileWithRetry<Array<{ id: string; body: string }>>(
      { owner: 'o', repo: 'r', branch: 'main' },
      'ghp_test',
      'public/data/posts.json',
      (list) => [{ id: 'c', body: 'Khu vườn hóa đá' }, ...list],
      'feat: add post c'
    );
    expect(updated.map((x) => x.id)).toEqual(['c', 'a', 'b']);
    expect(updated[1].body).toBe('Lớp 12 Hóa');
    expect(fetchMock).toHaveBeenCalledTimes(4);
    vi.unstubAllGlobals();
  });

  it('returns clear Vietnamese error on invalid or revoked GitHub token', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('{}', { status: 401 })));
    const res = await verifyRepoToken({ owner: 'o', repo: 'r', branch: 'main' }, 'bad-token');
    expect(res.ok).toBe(false);
    expect(res.error).toContain('Token');
    vi.unstubAllGlobals();
  });
});
