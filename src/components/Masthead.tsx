import { motion } from 'framer-motion';

interface MastheadProps {
  title: string;
  cohort: string;
}

export function Masthead({ title, cohort }: MastheadProps) {
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
      <div className="masthead-meta">NIÊN KHÓA {cohort}</div>
    </motion.header>
  );
}
