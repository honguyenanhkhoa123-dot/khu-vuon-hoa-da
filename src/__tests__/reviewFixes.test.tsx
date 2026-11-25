import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fs from 'node:fs';
import path from 'node:path';
import { verifyRepoToken, updateJsonFileWithRetry, uploadBinaryFile, encodeUtf8Base64 } from '../lib/githubApi';
import { validateHeroImageFile } from '../lib/media';
import { updateSiteSettingsAdmin, createPost } from '../lib/store';
import { AdminSettingsModal } from '../components/AdminSettingsModal';
import { App } from '../App';
import type { AuthSession, Post, SiteSettings } from '../types/zine';

const baseSite: SiteSettings = {
  title: 'Khu vườn hóa đá',
  subtitle: 'Subtitle',
  cohort: '2023–2026',
  heroImage: './images/hero-default.svg',
  heroCaption: 'Caption',
  repoOwner: 'o',
  repoName: 'r',
  repoBranch: 'main',
  adminPasscodeHash: '687dd71f0becc61bc354dda4d2a62f8eea8f23a1552df1e76b46c89d915c3318'
};

describe('Final review Critical & Important fixes', () => {
  beforeEach(() => {
    window.location.hash = '';
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('Critical #1: public README does not expose secret portal route or plaintext default Admin passcode', () => {
    const readme = fs.readFileSync(path.resolve('README.md'), 'utf8');
    expect(readme).not.toContain('khuvuonhoada12');
    expect(readme).not.toContain('cong-bien-tap');
  });

  it('Critical #2: verifyRepoToken fails closed when permissions is omitted on a public repo, and App clears revoked GitHub session on 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ id: 1, full_name: 'o/r' }), { status: 200 }))
    );
    const res = await verifyRepoToken({ owner: 'o', repo: 'r', branch: 'main' }, 'ghp_public_only');
    expect(res.ok).toBe(false);
    expect(res.error).toContain('Contents');

    // Revoked session stored in sessionStorage must be cleared on 401 reload
    sessionStorage.setItem(
      'kvhd_editorial_session_v1',
      JSON.stringify({ role: 'editor', mode: 'github', token: 'ghp_revoked' })
    );
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (String(url).includes('api.github.com/repos/')) {
          return Promise.resolve(new Response('{}', { status: 401 }));
        }
        if (String(url).includes('site.json')) {
          return Promise.resolve(new Response(JSON.stringify(baseSite), { status: 200 }));
        }
        return Promise.resolve(new Response('[]', { status: 200 }));
      })
    );
    render(<App />);
    await waitFor(() => expect(sessionStorage.getItem('kvhd_editorial_session_v1')).toBeNull());
    expect(screen.queryByRole('button', { name: /\+ Đăng bài/i })).not.toBeInTheDocument();
  });

  it('Important #1: newly uploaded GitHub media provides immediate local preview URL map until Pages rebuilds', async () => {
    const fetchMock = vi
      .fn()
      // uploadBinaryFile PUT
      .mockResolvedValueOnce(new Response(JSON.stringify({ content: { sha: 'm1' } }), { status: 201 }))
      // readJsonFile GET posts.json
      .mockResolvedValueOnce(new Response(JSON.stringify({ sha: 's1', content: btoa('[]') }), { status: 200 }))
      // updateJsonFile PUT posts.json
      .mockResolvedValueOnce(new Response(JSON.stringify({ content: { sha: 's2' } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const imgFile = new File(['fake-jpg'], 'ky-yeu.jpg', { type: 'image/jpeg' });
    const session: AuthSession = { role: 'editor', mode: 'github', token: 'ghp_ok' };
    const previewMap = new Map<string, string>();
    const posts = await createPost(
      {
        grade: 12,
        authorName: 'Minh',
        tag: 'Ảnh lớp',
        body: 'Ảnh mới',
        isSpoiler: false,
        files: [imgFile]
      },
      baseSite,
      session,
      undefined,
      (repoRelUrl, localPreviewUrl) => previewMap.set(repoRelUrl, localPreviewUrl)
    );

    expect(posts[0].media).toHaveLength(1);
    const relUrl = posts[0].media[0].url;
    expect(relUrl.startsWith('./uploads/')).toBe(true);
    expect(previewMap.get(relUrl)).toMatch(/^(blob:|data:)/);
  });

  it('Important #2: updateJsonFileWithRetry shows conflict message on exhaustion, uploadBinaryFile retries 409, and updateSiteSettingsAdmin keeps latest cur.heroImage', async () => {
    // 1. Exhausted 409 conflict reaches friendly Vietnamese conflict message
    const conflictFetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ sha: '1', content: btoa('[]') }), { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 409 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ sha: '2', content: btoa('[]') }), { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 409 }));
    vi.stubGlobal('fetch', conflictFetch);
    await expect(
      updateJsonFileWithRetry(
        { owner: 'o', repo: 'r', branch: 'main' },
        'ghp_ok',
        'public/data/posts.json',
        (x: unknown[]) => x,
        'msg',
        2
      )
    ).rejects.toThrow('người khác cập nhật cùng lúc');

    // 2. uploadBinaryFile retries on 409
    const binFetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 409 }))
      .mockResolvedValueOnce(new Response('{}', { status: 201 }));
    vi.stubGlobal('fetch', binFetch);
    await uploadBinaryFile({ owner: 'o', repo: 'r', branch: 'main' }, 'ghp_ok', 'public/uploads/a.jpg', 'YQ==', 'up');
    expect(binFetch).toHaveBeenCalledTimes(2);

    // 3. updateSiteSettingsAdmin preserves remote cur.heroImage when updating caption only
    const newerSite = { ...baseSite, heroImage: './uploads/hero/newest.webp' };
    const siteFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ sha: 's1', content: encodeUtf8Base64(JSON.stringify(newerSite)) }), { status: 200 })
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ content: { sha: 's2' } }), { status: 200 }));
    vi.stubGlobal('fetch', siteFetch);

    const saved = await updateSiteSettingsAdmin(
      { heroCaption: 'New caption' },
      baseSite,
      { role: 'admin', mode: 'github', token: 'ghp_ok' }
    );
    expect(saved.heroImage).toBe('./uploads/hero/newest.webp');
    expect(saved.heroCaption).toBe('New caption');
  });

  it('Important #3: Hero validator rejects video files and AdminSettingsModal blocks removing last media of textless post', async () => {
    const vid = new File(['v'], 'clip.mp4', { type: 'video/mp4' });
    expect(validateHeroImageFile(vid)).toContain('hình ảnh');

    const user = userEvent.setup();
    const textlessPost: Post = {
      id: 'p-photo-only',
      grade: 12,
      authorName: 'Lan',
      tag: 'Ảnh lớp',
      body: '',
      isSpoiler: false,
      createdAt: '2026-11-20T00:00:00Z',
      media: [{ id: 'm1', type: 'image', url: './img/1.jpg' }]
    };

    render(
      <AdminSettingsModal
        site={baseSite}
        storageMode="local"
        editingPost={textlessPost}
        onUpdatePost={vi.fn()}
        onDeletePost={vi.fn()}
        onUpdateSite={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /Xóa tệp m1/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/ít nhất 1 ảnh\/video/i);
  });

  it('Important #4: local preview mode handles localStorage QuotaExceededError gracefully without uncaught crash', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('[]', { status: 200 }))
    );
    const setItemSpy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });

    const vid = new File(['video-bytes'], 'demo.mp4', { type: 'video/mp4' });
    const posts = await createPost(
      {
        grade: 12,
        authorName: 'Minh',
        tag: 'Sự kiện',
        body: 'Test video cục bộ',
        isSpoiler: false,
        files: [vid]
      },
      baseSite,
      { role: 'editor', mode: 'local' }
    );

    expect(posts[0].body).toBe('Test video cục bộ');
    expect(posts[0].media).toHaveLength(1);
    setItemSpy.mockRestore();
  });
});
