import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { MediaItem } from '../types/zine';

interface LightboxModalProps {
  media: MediaItem[];
  initialIndex: number;
  caption: string;
  onClose: () => void;
}

function clampIndex(idx: number, len: number): number {
  if (len <= 0) return 0;
  return Math.max(0, Math.min(idx, len - 1));
}

export function LightboxModal({
  media,
  initialIndex,
  caption,
  onClose
}: LightboxModalProps) {
  const [index, setIndex] = useState(() => clampIndex(initialIndex, media.length));
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    setIndex(clampIndex(initialIndex, media.length));
  }, [initialIndex, media.length]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' && media.length > 1) {
        setIndex((i) => (i + 1) % media.length);
      } else if (e.key === 'ArrowLeft' && media.length > 1) {
        setIndex((i) => (i - 1 + media.length) % media.length);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [media.length, onClose]);

  if (media.length === 0) return null;

  const safeIdx = clampIndex(index, media.length);
  const current = media[safeIdx];

  function goPrev() {
    setIndex((i) => (i - 1 + media.length) % media.length);
  }

  function goNext() {
    setIndex((i) => (i + 1) % media.length);
  }

  return (
    <motion.div
      className="lightbox-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Trình xem ảnh và video"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.24 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="lightbox-top">
        <span>
          {safeIdx + 1} / {media.length}
        </span>
        <button type="button" className="btn-ghost-dark" onClick={onClose}>
          Đóng (Esc)
        </button>
      </div>

      <div
        className="lightbox-stage"
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          if (touchStartX.current === null || media.length <= 1) return;
          const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
          const delta = endX - touchStartX.current;
          if (delta > 48) goPrev();
          if (delta < -48) goNext();
          touchStartX.current = null;
        }}
      >
        {media.length > 1 && (
          <button
            type="button"
            className="lightbox-nav prev"
            aria-label="Ảnh trước"
            onClick={goPrev}
          >
            Trước
          </button>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            style={{ display: 'flex', justifyContent: 'center', maxWidth: '100%' }}
          >
            {current.type === 'video' ? (
              <video
                className="lightbox-media"
                src={current.url}
                controls
                playsInline
                preload="metadata"
              />
            ) : (
              <img
                className="lightbox-media"
                src={current.url}
                alt={current.alt || caption || 'Ảnh kỷ niệm'}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {media.length > 1 && (
          <button
            type="button"
            className="lightbox-nav next"
            aria-label="Ảnh sau"
            onClick={goNext}
          >
            Sau
          </button>
        )}
      </div>

      {caption && <p className="lightbox-caption">{caption}</p>}
    </motion.div>
  );
}
