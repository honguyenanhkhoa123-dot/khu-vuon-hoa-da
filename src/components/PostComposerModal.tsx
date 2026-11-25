import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import type { DraftPostInput, Grade, PostTag } from '../types/zine';
import { isVideoFile, validateMediaFiles } from '../lib/media';

interface PostComposerModalProps {
  defaultGrade: Grade;
  onSubmit: (input: DraftPostInput, onProgress: (pct: number) => void) => Promise<void>;
  onClose: () => void;
}

const TAGS: PostTag[] = ['Ảnh lớp', 'Sự kiện', 'Điểm đồ', 'Nghịch phá', 'Kỷ niệm'];

export function PostComposerModal({
  defaultGrade,
  onSubmit,
  onClose
}: PostComposerModalProps) {
  const [grade, setGrade] = useState<Grade>(defaultGrade);
  const [tag, setTag] = useState<PostTag>('Ảnh lớp');
  const [authorName, setAuthorName] = useState('');
  const [momentLabel, setMomentLabel] = useState('');
  const [body, setBody] = useState('');
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);

  const previews = useMemo(
    () =>
      files.map((file) => ({
        file,
        isVideo: isVideoFile(file),
        url: typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : ''
      })),
    [files]
  );

  useEffect(() => {
    return () => {
      for (const item of previews) {
        if (item.url && typeof URL.revokeObjectURL === 'function') {
          URL.revokeObjectURL(item.url);
        }
      }
    };
  }, [previews]);

  function handleFileChange(selected: FileList | null) {
    if (!selected || selected.length === 0) return;
    const combined = [...files, ...Array.from(selected)];
    const res = validateMediaFiles(combined);
    setFiles(res.valid);
    setErrors(res.errors);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, idx) => idx !== index));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const nextErrors: string[] = [];
    if (!authorName.trim()) {
      nextErrors.push('Vui lòng nhập tên hoặc biệt danh người đăng.');
    }
    if (!body.trim() && files.length === 0) {
      nextErrors.push('Bài đăng cần có nội dung chữ hoặc ít nhất một ảnh/video.');
    }
    if (nextErrors.length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors([]);
    setSubmitting(true);
    setProgress(8);
    try {
      await onSubmit(
        {
          grade,
          tag,
          authorName,
          momentLabel,
          body,
          isSpoiler,
          files
        },
        (pct) => setProgress(pct)
      );
      onClose();
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Đăng bài thất bại, vui lòng thử lại.']);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <motion.div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Đăng bài kỷ niệm mới"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <motion.form
        className="modal-card"
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 18, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 14, scale: 0.97 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        <h2>Đăng bài mới vào Khu vườn hóa đá</h2>

        {errors.length > 0 && (
          <div className="field-error" role="alert">
            {errors.map((msg, i) => (
              <div key={i}>{msg}</div>
            ))}
          </div>
        )}

        <div className="field-grid">
          <div className="field-group" style={{ marginBottom: 0 }}>
            <label className="field-label" htmlFor="composer-grade">
              Chọn lớp
            </label>
            <select
              id="composer-grade"
              className="field-select"
              value={grade}
              onChange={(e) => setGrade(Number(e.target.value) as Grade)}
            >
              <option value={10}>Lớp 10</option>
              <option value={11}>Lớp 11</option>
              <option value={12}>Lớp 12</option>
            </select>
          </div>

          <div className="field-group" style={{ marginBottom: 0 }}>
            <label className="field-label" htmlFor="composer-tag">
              Chủ đề
            </label>
            <select
              id="composer-tag"
              className="field-select"
              value={tag}
              onChange={(e) => setTag(e.target.value as PostTag)}
            >
              {TAGS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field-grid">
          <div className="field-group" style={{ marginBottom: 0 }}>
            <label className="field-label" htmlFor="composer-author">
              Tên hiển thị
            </label>
            <input
              id="composer-author"
              type="text"
              className="field-input"
              placeholder="Ví dụ: Quang Minh"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
            />
          </div>

          <div className="field-group" style={{ marginBottom: 0 }}>
            <label className="field-label" htmlFor="composer-moment">
              Dịp / Thời gian (tùy chọn)
            </label>
            <input
              id="composer-moment"
              type="text"
              className="field-input"
              placeholder="Ví dụ: Chụp kỷ yếu · Tháng 11"
              value={momentLabel}
              onChange={(e) => setMomentLabel(e.target.value)}
            />
          </div>
        </div>

        <div className="field-group">
          <label className="field-label" htmlFor="composer-body">
            Nội dung bài đăng
          </label>
          <textarea
            id="composer-body"
            className="field-textarea"
            placeholder="Kể lại khoảnh khắc, câu chuyện điểm số hoặc pha nghịch phá của lớp..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>

        <div className="field-group">
          <label className="field-label" htmlFor="composer-files">
            Ảnh và video ngắn (chọn nhiều tệp cùng lúc, video tối đa 20MB)
          </label>
          <input
            id="composer-files"
            type="file"
            className="field-input"
            multiple
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif,video/mp4,video/webm,video/quicktime"
            onChange={(e) => {
              handleFileChange(e.target.files);
              e.target.value = '';
            }}
          />

          {previews.length > 0 && (
            <div className="preview-strip">
              {previews.map((item, idx) => (
                <div key={`${item.file.name}-${idx}`} className="preview-thumb">
                  {item.isVideo ? (
                    <video src={item.url} muted playsInline preload="metadata" />
                  ) : (
                    <img src={item.url} alt={item.file.name} />
                  )}
                  <button
                    type="button"
                    className="preview-remove"
                    aria-label={`Bỏ tệp ${item.file.name}`}
                    onClick={() => removeFile(idx)}
                  >
                    X
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.82rem',
            cursor: 'pointer'
          }}
        >
          <input
            type="checkbox"
            checked={isSpoiler}
            onChange={(e) => setIsSpoiler(e.target.checked)}
          />
          <span>Che mờ ảnh dìm (hiển thị dải niêm phong, bấm vào mới bóc)</span>
        </label>

        {submitting && (
          <div className="field-notice" style={{ marginTop: '12px', marginBottom: 0 }}>
            Đang nén và lưu bài đăng ({progress}%)...
          </div>
        )}

        <div className="modal-footer">
          <button
            type="button"
            className="btn-ghost-light"
            disabled={submitting}
            onClick={onClose}
          >
            Hủy
          </button>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Đang đăng...' : 'Đăng bài ngay'}
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}
