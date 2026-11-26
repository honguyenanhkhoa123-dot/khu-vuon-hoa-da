import { useRef } from 'react';
import { motion } from 'framer-motion';

interface MastheadProps {
  title: string;
  cohort: string;
  onSecretTrigger?: () => void;
}

const REQUIRED_TAPS = 5;
const TAP_WINDOW_MS = 4000;

export function Masthead({ title, cohort, onSecretTrigger }: MastheadProps) {
  const tapTimestamps = useRef<number[]>([]);

  function handleMetaClick() {
    if (!onSecretTrigger) return;
    const now = Date.now();
    const recent = tapTimestamps.current.filter((t) => now - t <= TAP_WINDOW_MS);
    recent.push(now);
    tapTimestamps.current = recent;
    if (recent.length >= REQUIRED_TAPS) {
      tapTimestamps.current = [];
      onSecretTrigger();
    }
  }

  return (
    <motion.header
      className="masthead"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="masthead-brand">
        <span className="masthead-title">{title}</span>
        <span className="masthead-sub">12 Chuyên Hóa</span>
      </div>
      <div
        className="masthead-meta"
        style={{ userSelect: 'none' }}
        onClick={handleMetaClick}
      >
        NIÊN KHÓA {cohort}
      </div>
    </motion.header>
  );
}
