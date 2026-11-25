import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { AuthRole, MediaItem, Post } from '../types/zine';

interface PostCardProps {
  post: Post;
  role: AuthRole;
  index?: number;
  onOpenMedia: (media: MediaItem[], startIndex: number, caption: string) => void;
  onManagePost?: (post: Post) => void;
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '12';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[words.length - 2][0] + words[words.length - 1][0]).toUpperCase();
}

function formatFallbackDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export function PostCard({
  post,
  role,
  index = 0,
  onOpenMedia,
  onManagePost
}: PostCardProps) {
  const [peeled, setPeeled] = useState(false);

  const visibleMedia = post.media.slice(0, 4);
  const overflowCount = Math.max(0, post.media.length - 4);
  const gridClass =
    visibleMedia.length <= 1
      ? 'count-1'
      : visibleMedia.length === 2
        ? 'count-2'
        : visibleMedia.length === 3
          ? 'count-3'
          : 'count-4';

  const isMasked = post.isSpoiler && !peeled;

  const mediaGrid =
    visibleMedia.length > 0 ? (
      <div className={`media-grid ${gridClass}`}>
        {visibleMedia.map((item, idx) => {
          const isOverflowSlot = idx === 3 && overflowCount > 0;
          return (
            <button
              key={item.id}
              type="button"
              className="media-tile"
              aria-label={`Xem phương tiện ${idx + 1} của bài ${post.authorName}`}
              onClick={() => onOpenMedia(post.media, idx, post.body)}
            >
              {item.type === 'video' ? (
                <>
                  <video
                    src={item.url}
                    muted
                    playsInline
                    preload="metadata"
                  />
                  <span className="video-pill">
                    VIDEO
                    {item.durationSec ? ` 0:${String(Math.round(item.durationSec)).padStart(2, '0')}` : ''}
                  </span>
                  <span className="video-play-mark" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="#f7f3ea">
                      <polygon points="4,2 14,8 4,14" />
                    </svg>
                  </span>
                </>
              ) : (
                <img
                  src={item.url}
                  alt={item.alt || `Ảnh kỷ niệm lớp ${post.grade}`}
                  loading="lazy"
                />
              )}
              {isOverflowSlot && (
                <span className="media-overflow-mask">+{overflowCount}</span>
              )}
            </button>
          );
        })}
      </div>
    ) : null;

  return (
    <motion.article
      className={`post-card ${post.hidden ? 'hidden-preview' : ''}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.48,
        delay: Math.min(index * 0.06, 0.24),
        ease: [0.22, 1, 0.36, 1]
      }}
    >
      <header className="post-header">
        <div className="post-author-group">
          <div className="post-monogram" aria-hidden="true">
            {getInitials(post.authorName)}
          </div>
          <div>
            <strong className="post-author-name">{post.authorName}</strong>
            <span className="post-moment">
              {post.momentLabel || `Lớp ${post.grade} · ${formatFallbackDate(post.createdAt)}`}
            </span>
          </div>
        </div>

        <div className="post-header-right">
          {post.hidden && role === 'admin' && (
            <span className="post-tag-badge" data-tag="Nghịch phá">
              ĐANG ẨN
            </span>
          )}
          <span className="post-tag-badge" data-tag={post.tag}>
            {post.tag}
          </span>
          {role === 'admin' && onManagePost && (
            <button
              type="button"
              className="btn-danger-mini"
              onClick={() => onManagePost(post)}
            >
              Quản lý
            </button>
          )}
        </div>
      </header>

      {post.body && <p className="post-body">{post.body}</p>}

      {mediaGrid &&
        (post.isSpoiler ? (
          <div className="spoiler-wrap">
            <div className={`spoiler-content ${isMasked ? 'masked' : ''}`}>
              {mediaGrid}
            </div>
            <AnimatePresence>
              {isMasked && (
                <motion.button
                  type="button"
                  className="spoiler-curtain"
                  aria-label="Ảnh dìm — Bấm để bóc niêm phong"
                  onClick={() => setPeeled(true)}
                  initial={{ opacity: 1, x: 0, rotate: 0 }}
                  exit={{
                    opacity: 0,
                    x: '104%',
                    rotate: 4,
                    pointerEvents: 'none',
                    transition: { duration: 0.45, ease: [0.68, -0.14, 0.26, 1.05] }
                  }}
                >
                  <span className="spoiler-stamp">ẢNH DÌM — BẤM ĐỂ BÓC</span>
                  <span className="spoiler-sub">NỘI DUNG CHE MỜ CHỦ ĐỘNG</span>
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        ) : (
          mediaGrid
        ))}
    </motion.article>
  );
}
