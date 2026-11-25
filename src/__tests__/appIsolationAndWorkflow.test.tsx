import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';

const EMOJI_RE = /\p{Extended_Pictographic}/u;

const mockSite = {
  title: 'Khu vườn hóa đá',
  subtitle: 'Nơi mọi khoảnh khắc đứng yên cùng thời gian',
  cohort: '2023–2026',
  heroImage: './images/hero-default.svg',
  heroCaption: 'Kỷ yếu 12 Hóa',
  repoOwner: 'honguyenanhkhoa123-dot',
  repoName: 'khu-vuon-hoa-da',
  repoBranch: 'main',
  adminPasscodeHash: '687dd71f0becc61bc354dda4d2a62f8eea8f23a1552df1e76b46c89d915c3318'
};

const mockPosts = [
  {
    id: 'p12',
    grade: 12,
    authorName: 'Minh',
    momentLabel: 'Kỷ yếu',
    tag: 'Ảnh lớp',
    body: 'Kỷ niệm lớp 12',
    isSpoiler: false,
    createdAt: '2026-11-20T00:00:00Z',
    media: []
  },
  {
    id: 'p12-hidden',
    grade: 12,
    authorName: 'Ẩn',
    tag: 'Nghịch phá',
    body: 'Bài bị admin ẩn khỏi trang công khai',
    isSpoiler: false,
    hidden: true,
    createdAt: '2026-11-19T00:00:00Z',
    media: []
  }
];

describe('App public isolation & hidden editorial portal (Review Focus #4 & #5)', () => {
  beforeEach(() => {
    window.location.hash = '';
    sessionStorage.clear();
    localStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (String(url).includes('site.json')) {
          return Promise.resolve(new Response(JSON.stringify(mockSite), { status: 200 }));
        }
        if (String(url).includes('posts.json')) {
          return Promise.resolve(new Response(JSON.stringify(mockPosts), { status: 200 }));
        }
        if (String(url).includes('api.github.com/repos/')) {
          return Promise.resolve(new Response('{}', { status: 401 }));
        }
        return Promise.resolve(new Response('{}', { status: 404 }));
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows pure magazine at / with Lớp 12 active, hides hidden posts, and leaks zero editor/admin UI or emojis', async () => {
    const { container } = render(<App />);
    await waitFor(() => expect(screen.getByText('Kỷ niệm lớp 12')).toBeInTheDocument());
    expect(screen.queryByText('Bài bị admin ẩn khỏi trang công khai')).not.toBeInTheDocument();
    expect(screen.queryByText(/Đăng bài|Đăng nhập|Admin|Quản lý|Cổng biên tập/i)).not.toBeInTheDocument();
    expect(container.querySelector('a[href*="cong-bien-tap"]')).toBeNull();
    expect(EMOJI_RE.test(container.textContent || '')).toBe(false);
  });

  it('rejects bad GitHub token in hidden portal without saving a broken session', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/cong-bien-tap';
    render(<App />);
    await waitFor(() => expect(screen.getByText(/Cổng biên tập ẩn/i)).toBeInTheDocument());
    await user.type(screen.getByLabelText(/GitHub Token/i), 'ghp_invalid');
    await user.click(screen.getByRole('button', { name: /Mở chế độ Biên tập viên/i }));
    await waitFor(() => expect(screen.getByText(/Token GitHub không hợp lệ/i)).toBeInTheDocument());
    expect(sessionStorage.length).toBe(0);
  });

  it('allows authorized local editor via hidden portal to publish a post into Lớp 10', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/cong-bien-tap';
    render(<App />);
    await waitFor(() => expect(screen.getByText(/Cổng biên tập ẩn/i)).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /Thử nhanh Biên tập viên/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /\+ Đăng bài/i })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /\+ Đăng bài/i }));
    await user.selectOptions(screen.getByLabelText(/Chọn lớp/i), '10');
    await user.type(screen.getByLabelText(/Tên hiển thị/i), 'Thảo');
    await user.type(screen.getByLabelText(/Nội dung bài đăng/i), 'Bài mở hàng lớp 10');
    await user.click(screen.getByRole('button', { name: /Đăng bài ngay/i }));

    await waitFor(() => expect(screen.getByText('Bài mở hàng lớp 10')).toBeInTheDocument());
  });
});
