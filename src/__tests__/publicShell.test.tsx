import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Masthead } from '../components/Masthead';
import { HeroCover } from '../components/HeroCover';
import { GradeTabs } from '../components/GradeTabs';

const EMOJI_RE = /\p{Extended_Pictographic}/u;

describe('Public Magazine Shell (Review Focus #4 & #5)', () => {
  it('renders Khu vườn hóa đá masthead with zero login, post, or admin controls and zero emojis', () => {
    const { container } = render(<Masthead title="Khu vườn hóa đá" cohort="2023–2026" />);
    expect(screen.getByText('Khu vườn hóa đá')).toBeInTheDocument();
    expect(screen.queryByText(/đăng nhập|đăng ký|đăng bài|admin|quản trị/i)).not.toBeInTheDocument();
    expect(container.querySelector('a[href*="cong-bien-tap"]')).toBeNull();
    expect(EMOJI_RE.test(container.textContent || '')).toBe(false);
  });

  it('switches cleanly between Lớp 10, Lớp 11, Lớp 12 and topic filters', async () => {
    const user = userEvent.setup();
    const onGrade = vi.fn();
    const onTag = vi.fn();
    render(
      <GradeTabs
        activeGrade={12}
        counts={{ 10: 0, 11: 1, 12: 3 }}
        activeTag="ALL"
        onSelectGrade={onGrade}
        onSelectTag={onTag}
      />
    );
    await user.click(screen.getByRole('tab', { name: /Lớp 10/i }));
    expect(onGrade).toHaveBeenCalledWith(10);
    await user.click(screen.getByRole('button', { name: 'Nghịch phá' }));
    expect(onTag).toHaveBeenCalledWith('Nghịch phá');
  });

  it('renders HeroCover photo and caption without emojis', () => {
    const { container } = render(
      <HeroCover
        site={{
          title: 'Khu vườn hóa đá',
          subtitle: 'Nơi mọi khoảnh khắc đứng yên cùng thời gian',
          cohort: '2023–2026',
          heroImage: './images/hero-default.svg',
          heroCaption: 'Kỷ yếu 12 Chuyên Hóa',
          repoOwner: 'o',
          repoName: 'r',
          repoBranch: 'main',
          adminPasscodeHash: '0'.repeat(64)
        }}
      />
    );
    expect(screen.getByAltText('Kỷ yếu 12 Chuyên Hóa')).toBeInTheDocument();
    expect(EMOJI_RE.test(container.textContent || '')).toBe(false);
  });
});
