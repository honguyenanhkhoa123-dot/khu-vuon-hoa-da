import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  encryptSecretWithPasscode,
  decryptSecretWithPasscode,
  sha256Hex
} from '../lib/crypto';
import { App } from '../App';

const EMOJI_RE = /\p{Extended_Pictographic}/u;

describe('PBKDF2 + AES-GCM encrypted token vault', () => {
  it('encrypts and decrypts a GitHub token with a short passcode, returning null for wrong passcodes', async () => {
    const token = 'github_pat_11ABCDEF_real_secret_token_999';
    const vault = await encryptSecretWithPasscode(token, 'bientap12hoa', 1000);
    expect(vault.ciphertext).not.toContain('github_pat_');
    expect(await decryptSecretWithPasscode(vault, 'bientap12hoa')).toBe(token);
    expect(await decryptSecretWithPasscode(vault, 'sai-mat-ma')).toBeNull();
  });
});

describe('5-tap secret gesture, single-passcode unlock & remember device', () => {
  beforeEach(() => {
    window.location.hash = '';
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function buildMockSiteWithVaults() {
    const editorVault = await encryptSecretWithPasscode('ghp_editor_token', 'bientap12', 1000);
    const adminVault = await encryptSecretWithPasscode('ghp_admin_token', 'admin12hoa', 1000);
    const adminPasscodeHash = await sha256Hex('admin12hoa');
    return {
      title: 'Khu vườn hóa đá',
      subtitle: 'Lưu trữ kỷ niệm',
      cohort: '2023–2026',
      heroImage: './images/hero-default.svg',
      heroCaption: 'Kỷ yếu 12 Hóa',
      repoOwner: 'o',
      repoName: 'r',
      repoBranch: 'main',
      adminPasscodeHash,
      editorVault,
      adminVault
    };
  }

  it('opens quick unlock modal only on 5 rapid taps on NIÊN KHÓA, unlocks Editor with 1 short passcode, remembers device, and logs out cleanly', async () => {
    const mockSite = await buildMockSiteWithVaults();
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        const s = String(url);
        if (s.includes('site.json') && !s.includes('api.github.com')) {
          return Promise.resolve(new Response(JSON.stringify(mockSite), { status: 200 }));
        }
        if (s.includes('posts.json') && !s.includes('api.github.com')) {
          return Promise.resolve(new Response('[]', { status: 200 }));
        }
        if (s.endsWith('/repos/o/r')) {
          return Promise.resolve(
            new Response(JSON.stringify({ permissions: { push: true } }), { status: 200 })
          );
        }
        if (s.includes('/contents/docs/data/site.json')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                sha: 's1',
                content: Buffer.from(JSON.stringify(mockSite), 'utf8').toString('base64')
              }),
              { status: 200 }
            )
          );
        }
        if (s.includes('/contents/docs/data/posts.json')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ sha: 'p1', content: Buffer.from('[]', 'utf8').toString('base64') }),
              { status: 200 }
            )
          );
        }
        return Promise.resolve(new Response('{}', { status: 404 }));
      })
    );

    const user = userEvent.setup();
    const { container, unmount } = render(<App />);
    await waitFor(() => expect(screen.getByText(/NIÊN KHÓA 2023–2026/i)).toBeInTheDocument());

    const trigger = screen.getByText(/NIÊN KHÓA 2023–2026/i);
    // 4 taps must NOT open modal
    for (let i = 0; i < 4; i += 1) {
      await user.click(trigger);
    }
    expect(screen.queryByLabelText(/Mật mã truy cập/i)).not.toBeInTheDocument();

    // 5th tap opens minimal 1-passcode modal with zero emojis
    await user.click(trigger);
    await waitFor(() => expect(screen.getByLabelText(/Mật mã truy cập/i)).toBeInTheDocument());
    expect(EMOJI_RE.test(container.textContent || '')).toBe(false);

    // Wrong passcode shows clear Vietnamese error
    await user.type(screen.getByLabelText(/Mật mã truy cập/i), 'khong-dung');
    await user.click(screen.getByRole('button', { name: /Mở khóa/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/Mật mã không đúng/i));

    // Short Editor passcode unlocks GitHub Editor mode directly without pasting any token
    await user.clear(screen.getByLabelText(/Mật mã truy cập/i));
    await user.type(screen.getByLabelText(/Mật mã truy cập/i), 'bientap12');
    await user.click(screen.getByRole('button', { name: /Mở khóa/i }));

    await waitFor(() => expect(screen.getByText(/CHẾ ĐỘ BIÊN TẬP VIÊN/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /\+ Đăng bài/i })).toBeInTheDocument();
    expect(localStorage.getItem('kvhd_editorial_session_v1')).toContain('ghp_editor_token');

    // Reloading remembers the device automatically
    unmount();
    render(<App />);
    await waitFor(() => expect(screen.getByText(/CHẾ ĐỘ BIÊN TẬP VIÊN/i)).toBeInTheDocument());

    // Logout clears remembered device session completely
    await user.click(screen.getByRole('button', { name: /Thoát/i }));
    await waitFor(() =>
      expect(screen.queryByText(/CHẾ ĐỘ BIÊN TẬP VIÊN/i)).not.toBeInTheDocument()
    );
    expect(localStorage.getItem('kvhd_editorial_session_v1')).toBeNull();
    expect(sessionStorage.getItem('kvhd_editorial_session_v1')).toBeNull();
  }, 15000);

  it('auto-detects Admin role when short Admin passcode is entered', async () => {
    const mockSite = await buildMockSiteWithVaults();
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        const s = String(url);
        if (s.includes('site.json') && !s.includes('api.github.com')) {
          return Promise.resolve(new Response(JSON.stringify(mockSite), { status: 200 }));
        }
        if (s.includes('posts.json') && !s.includes('api.github.com')) {
          return Promise.resolve(new Response('[]', { status: 200 }));
        }
        if (s.endsWith('/repos/o/r')) {
          return Promise.resolve(
            new Response(JSON.stringify({ permissions: { push: true } }), { status: 200 })
          );
        }
        if (s.includes('/contents/docs/data/site.json')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                sha: 's1',
                content: Buffer.from(JSON.stringify(mockSite), 'utf8').toString('base64')
              }),
              { status: 200 }
            )
          );
        }
        if (s.includes('/contents/docs/data/posts.json')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ sha: 'p1', content: Buffer.from('[]', 'utf8').toString('base64') }),
              { status: 200 }
            )
          );
        }
        return Promise.resolve(new Response('{}', { status: 404 }));
      })
    );

    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => expect(screen.getByText(/NIÊN KHÓA 2023–2026/i)).toBeInTheDocument());

    const trigger = screen.getByText(/NIÊN KHÓA 2023–2026/i);
    for (let i = 0; i < 5; i += 1) {
      await user.click(trigger);
    }

    await waitFor(() => expect(screen.getByLabelText(/Mật mã truy cập/i)).toBeInTheDocument());
    await user.type(screen.getByLabelText(/Mật mã truy cập/i), 'admin12hoa');
    await user.click(screen.getByRole('button', { name: /Mở khóa/i }));

    await waitFor(() => expect(screen.getByText(/CHẾ ĐỘ ADMIN/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Cài đặt trang/i })).toBeInTheDocument();
  });
});
