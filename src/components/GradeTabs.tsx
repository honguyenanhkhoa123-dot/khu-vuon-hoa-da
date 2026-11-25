import { motion } from 'framer-motion';
import type { Grade, PostTag } from '../types/zine';

export type TagFilter = 'ALL' | PostTag;

interface GradeTabsProps {
  activeGrade: Grade;
  counts: Record<Grade, number>;
  activeTag: TagFilter;
  onSelectGrade: (grade: Grade) => void;
  onSelectTag: (tag: TagFilter) => void;
}

const GRADES: Grade[] = [10, 11, 12];

const TAGS: Array<{ value: TagFilter; label: string }> = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'Ảnh lớp', label: 'Ảnh lớp' },
  { value: 'Sự kiện', label: 'Sự kiện' },
  { value: 'Điểm đồ', label: 'Điểm đồ' },
  { value: 'Nghịch phá', label: 'Nghịch phá' },
  { value: 'Kỷ niệm', label: 'Kỷ niệm' }
];

export function GradeTabs({
  activeGrade,
  counts,
  activeTag,
  onSelectGrade,
  onSelectTag
}: GradeTabsProps) {
  return (
    <nav className="grade-nav-wrap" aria-label="Chọn năm học và chủ đề">
      <div className="grade-tabs" role="tablist" aria-label="Các năm học">
        {GRADES.map((grade) => {
          const isSelected = activeGrade === grade;
          return (
            <button
              key={grade}
              type="button"
              role="tab"
              aria-selected={isSelected}
              className="grade-tab-btn"
              onClick={() => onSelectGrade(grade)}
            >
              {isSelected && (
                <motion.span
                  layoutId="active-grade-pill"
                  className="grade-tab-pill"
                  transition={{ type: 'spring', stiffness: 360, damping: 32 }}
                />
              )}
              <span className="grade-tab-label">Lớp {grade}</span>
              <span className="grade-tab-count">{counts[grade]} BÀI</span>
            </button>
          );
        })}
      </div>

      <div className="filter-strip">
        <div className="tag-chips" role="group" aria-label="Lọc theo chủ đề">
          {TAGS.map((tag) => (
            <button
              key={tag.value}
              type="button"
              className={`tag-chip ${activeTag === tag.value ? 'active' : ''}`}
              onClick={() => onSelectTag(tag.value)}
            >
              {tag.label}
            </button>
          ))}
        </div>
        <span className="filter-note">SỐ ĐẶC BIỆT CUỐI CẤP</span>
      </div>
    </nav>
  );
}
