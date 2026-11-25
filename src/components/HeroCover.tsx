import type { MouseEvent } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import type { SiteSettings } from '../types/zine';

interface HeroCoverProps {
  site: SiteSettings;
}

export function HeroCover({ site }: HeroCoverProps) {
  const rawRx = useMotionValue(0);
  const rawRy = useMotionValue(0);
  const rotateX = useSpring(rawRx, { stiffness: 180, damping: 20 });
  const rotateY = useSpring(rawRy, { stiffness: 180, damping: 20 });

  function handleMouseMove(e: MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    rawRx.set(-y * 9);
    rawRy.set(x * 11);
  }

  function handleMouseLeave() {
    rawRx.set(0);
    rawRy.set(0);
  }

  return (
    <section className="hero-cover" aria-label="Trang bìa ấn phẩm">
      <svg
        className="benzene-watermark"
        viewBox="0 0 120 120"
        aria-hidden="true"
      >
        <polygon
          points="60,10 103,35 103,85 60,110 17,85 17,35"
          fill="none"
          stroke="#171717"
          strokeWidth="1.4"
        />
        <circle
          cx="60"
          cy="60"
          r="28"
          fill="none"
          stroke="#171717"
          strokeWidth="1.15"
          strokeDasharray="6 4"
        />
      </svg>

      <motion.div
        className="hero-copy"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="hero-kicker">TẬP SAN LƯU TRỮ — CHUYÊN HÓA</p>
        <h1 className="hero-headline">
          Nơi mọi khoảnh khắc{' '}
          <span className="hero-emphasis">
            đứng yên cùng thời gian
            <motion.span
              className="hero-highlight"
              aria-hidden="true"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.8, delay: 0.32, ease: [0.22, 1, 0.36, 1] }}
            />
          </span>
        </h1>
        <p className="hero-desc">{site.subtitle}</p>
      </motion.div>

      <motion.div
        className="hero-polaroid-stage"
        initial={{ opacity: 0, y: 20, rotate: 2.4 }}
        animate={{ opacity: 1, y: 0, rotate: 1.4 }}
        transition={{ duration: 0.72, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <motion.figure
          className="hero-polaroid"
          style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
        >
          <span className="washi-tape" aria-hidden="true" />
          <div className="hero-photo-frame">
            <img src={site.heroImage} alt={site.heroCaption} />
          </div>
          <figcaption className="hero-caption-row">
            <strong>{site.heroCaption}</strong>
            <span>{site.cohort}</span>
          </figcaption>
        </motion.figure>
      </motion.div>
    </section>
  );
}
