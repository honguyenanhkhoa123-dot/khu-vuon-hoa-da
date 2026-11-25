import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PostCard } from '../components/PostCard';
import { LightboxModal } from '../components/LightboxModal';
import type { Post } from '../types/zine';

const EMOJI_RE = /\p{Extended_Pictographic}/u;

const multiPost: Post = {
  id: 'p1',
  grade: 12,
  authorName: 'Quang Minh',
  momentLabel: 'Chụp kỷ yếu',
  tag: 'Ảnh lớp',
  body: 'Trọn bộ ảnh sân trường.',
  isSpoiler: false,
  createdAt: '2026-11-20T10:00:00Z',
  media: [
    { id: 'm1', type: 'image', url: './img/1.jpg' },
    { id: 'm2', type: 'image', url: './img/2.jpg' },
    { id: 'm3', type: 'image', url: './img/3.jpg' },
    { id: 'm4', type: 'image', url: './img/4.jpg' },
    { id: 'm5', type: 'video', url: './vid/5.mp4', durationSec: 18 }
  ]
};

describe('PostCard & LightboxModal (Review Focus #3 & #5)', () => {
  it('renders Facebook-style 4+ grid with +1 overflow badge, zero like/comment UI, and zero emojis', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const { container } = render(<PostCard post={multiPost} role="public" onOpenMedia={onOpen} />);
    expect(screen.getByText('+1')).toBeInTheDocument();
    expect(screen.queryByText(/thích|bình luận|chia sẻ|quản lý/i)).not.toBeInTheDocument();
    expect(EMOJI_RE.test(container.textContent || '')).toBe(false);
    await user.click(screen.getAllByRole('button', { name: /Xem phương tiện/i })[0]);
    expect(onOpen).toHaveBeenCalledWith(multiPost.media, 0, multiPost.body);
  });

  it('masks spoiler post until clicked to peel open', async () => {
    const user = userEvent.setup();
    const spoilerPost: Post = { ...multiPost, id: 'p2', tag: 'Nghịch phá', isSpoiler: true };
    const { container } = render(<PostCard post={spoilerPost} role="public" onOpenMedia={vi.fn()} />);
    expect(container.querySelector('.spoiler-content.masked')).not.toBeNull();
    const peelBtn = screen.getByRole('button', { name: /Bấm để bóc/i });
    await user.click(peelBtn);
    expect(container.querySelector('.spoiler-content.masked')).toBeNull();
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /Bấm để bóc/i })).not.toBeInTheDocument()
    );
  });

  it('handles empty media gracefully after partial deletion and clamps Lightbox index safely', async () => {
    const user = userEvent.setup();
    const textOnly: Post = { ...multiPost, id: 'p3', media: [] };
    const { container } = render(<PostCard post={textOnly} role="public" onOpenMedia={vi.fn()} />);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('Trọn bộ ảnh sân trường.')).toBeInTheDocument();

    const onClose = vi.fn();
    render(
      <LightboxModal
        media={[
          { id: 'm1', type: 'image', url: './img/1.jpg' },
          { id: 'm2', type: 'video', url: './vid/2.mp4' }
        ]}
        initialIndex={99}
        caption="Chú thích"
        onClose={onClose}
      />
    );
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});
