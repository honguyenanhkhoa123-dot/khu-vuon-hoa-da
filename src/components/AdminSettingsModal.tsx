import { useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import type { Grade, MediaItem, Post, PostTag, SiteSettings, StorageMode } from '../types/zine';
import { sha256Hex, verifyPasscode } from '../lib/crypto';
import { validateHeroImageFile } from '../lib/media';

interface AdminSettingsModalProps {
  site: SiteSettings;
  storageMode: StorageMode;
  editingPost: Post | null;
  onUpdatePost: (
    postId: string,
    patch: Partial<Pick<Post, 'grade' | 'tag' | 'hidden' | 'media' | 'isSpoiler'>>
  ) => Promise<void>;
  onDeletePost: (postId: string) => Promise<void>;
  onUpdateSite: (
    patch: Partial<Pick<SiteSettings, 'heroImage' | 'heroCaption' | 'adminPasscodeHash'>>,
    heroFile?: File
  ) => Promise<void>;
  onResetLocal?: () => void;
  onClose: () => void;
}

const TAGS: PostTag[] = ['Ảnh lớp', 'Sự kiện', 'Điểm đồ', 'Nghịch phá', 'Kỷ niệm'];

export function AdminSettingsModal({
  site,
  storageMode,
  editingPost,
  onUpdatePost,
  onDeletePost,
  onUpdateSite,
  onResetLocal,
  onClose
}: AdminSettingsModalProps) {
  // Post editing state
  const [grade, setGrade] = useState<Grade>(editingPost?.grade ?? 12);
  const [tag, setTag] = useState<PostTag>(editingPost?.tag ?? 'Ảnh lớp');
  const [hidden, setHidden] = useState<boolean>(Boolean(editingPost?.hidden));
  const [isSpoiler, setIsSpoiler] = useState<boolean>(Boolean(editingPost?.isSpoiler));
  const [media, setMedia] = useState<MediaItem[]>(editingPost?.media ?? []);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Site settings state
  const [heroCaption, setHeroCaption] = useState(site.heroCaption);
  const [heroFile, setHeroFile] = useState<File | undefined>(undefined);
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSavePost(e: FormEvent) {
    e.preventDefault();
    if (!editingPost) return;
    setError(null);
    setBusy(true);
    try {
      await onUpdatePost(editingPost.id, { grade, tag, hidden, isSpoiler, media });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cập nhật bài viết thất bại.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!editingPost) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await onDeletePost(editingPost.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xóa bài viết thất bại.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveSite(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const patch: Partial<Pick<SiteSettings, 'heroImage' | 'heroCaption' | 'adminPasscodeHash'>> = {
      heroCaption: heroCaption.trim() || site.heroCaption
    };

    if (newPass.trim()) {
      if (newPass.trim().length < 6) {
        setError('Mã Admin mới cần ít nhất 6 ký tự.');
        return;
      }
      const okOld = await verifyPasscode(currentPass, site.adminPasscodeHash);
      if (!okOld) {
        setError('Mã Admin hiện tại không đúng.');
        return;
      }
      patch.adminPasscodeHash = await sha256Hex(newPass.trim());
    }

    setBusy(true);
    try {
      await onUpdateSite(patch, heroFile);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu cài đặt thất bại.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={editingPost ? 'Quản lý bài viết' : 'Cài đặt quản trị'}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <motion.div
        className="modal-card"
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 14, scale: 0.97 }}
        transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
      >
        {editingPost ? (
          <form onSubmit={handleSavePost}>
            <h2>Quản lý bài của {editingPost.authorName}</h2>
            {error && (
              <div className="field-error" role="alert">
                {error}
              </div>
            )}

            <div className="field-grid">
              <div className="field-group" style={{ marginBottom: 0 }}>
                <label className="field-label" htmlFor="admin-grade">
                  Chuyển mục lớp
                </label>
                <select
                  id="admin-grade"
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
                <label className="field-label" htmlFor="admin-tag">
                  Đổi chủ đề
                </label>
                <select
                  id="admin-tag"
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '12px 0' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem' }}>
                <input
                  type="checkbox"
                  checked={isSpoiler}
                  onChange={(e) => setIsSpoiler(e.target.checked)}
                />
                <span>Bật lớp che mờ ảnh dìm</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem' }}>
                <input
                  type="checkbox"
                  checked={hidden}
                  onChange={(e) => setHidden(e.target.checked)}
                />
                <span>Ẩn bài này khỏi người xem công khai</span>
              </label>
            </div>

            {media.length > 0 && (
              <div className="field-group">
                <span className="field-label">
                  Tệp đính kèm ({media.length}) — có thể bỏ riêng từng ảnh/video
                </span>
                <div className="preview-strip">
                  {media.map((item) => (
                    <div key={item.id} className="preview-thumb">
                      {item.type === 'video' ? (
                        <video src={item.url} muted playsInline preload="metadata" />
                      ) : (
                        <img src={item.url} alt={item.alt || 'Tệp đính kèm'} />
                      )}
                      <button
                        type="button"
                        className="preview-remove"
                        aria-label={`Xóa tệp ${item.id}`}
                        onClick={() => {
                          if (!editingPost.body.trim() && media.length <= 1) {
                            setError(
                              'Bài viết không có chữ phải giữ lại ít nhất 1 ảnh/video (hoặc hãy xóa hẳn bài).'
                            );
                            return;
                          }
                          setError(null);
                          setMedia((prev) => prev.filter((m) => m.id !== item.id));
                        }}
                      >
                        X
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
              <button
                type="button"
                className="btn-danger-mini"
                style={{ padding: '7px 12px', fontSize: '0.74rem' }}
                disabled={busy}
                onClick={handleDelete}
              >
                {confirmDelete ? 'Bấm lại để xác nhận xóa hẳn' : 'Xóa bài viết'}
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="btn-ghost-light" disabled={busy} onClick={onClose}>
                  Hủy
                </button>
                <button type="submit" className="btn-primary" disabled={busy}>
                  {busy ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSaveSite}>
            <h2>Cài đặt trang Khu vườn hóa đá</h2>
            {error && (
              <div className="field-error" role="alert">
                {error}
              </div>
            )}

            <div className="field-group">
              <label className="field-label" htmlFor="admin-hero-file">
                Thay ảnh bìa tập thể lớp (tùy chọn)
              </label>
              <input
                id="admin-hero-file"
                type="file"
                className="field-input"
                accept="image/jpeg,image/png,image/webp,image/avif"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const heroErr = validateHeroImageFile(f);
                  if (heroErr) {
                    setError(heroErr);
                    setHeroFile(undefined);
                  } else {
                    setError(null);
                    setHeroFile(f);
                  }
                }}
              />
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="admin-hero-cap">
                Chú thích dưới ảnh bìa
              </label>
              <input
                id="admin-hero-cap"
                type="text"
                className="field-input"
                value={heroCaption}
                onChange={(e) => setHeroCaption(e.target.value)}
              />
            </div>

            <hr className="portal-divider" />

            <div className="field-grid">
              <div className="field-group" style={{ marginBottom: 0 }}>
                <label className="field-label" htmlFor="admin-old-pass">
                  Mã Admin hiện tại
                </label>
                <input
                  id="admin-old-pass"
                  type="password"
                  className="field-input"
                  placeholder="Chỉ điền khi muốn đổi mã"
                  value={currentPass}
                  onChange={(e) => setCurrentPass(e.target.value)}
                />
              </div>

              <div className="field-group" style={{ marginBottom: 0 }}>
                <label className="field-label" htmlFor="admin-new-pass">
                  Mã Admin mới
                </label>
                <input
                  id="admin-new-pass"
                  type="password"
                  className="field-input"
                  placeholder="Ít nhất 6 ký tự"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
              {storageMode === 'local' && onResetLocal ? (
                <button
                  type="button"
                  className="btn-ghost-light"
                  onClick={() => {
                    onResetLocal();
                    onClose();
                  }}
                >
                  Đặt lại dữ liệu thử cục bộ
                </button>
              ) : (
                <span />
              )}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="btn-ghost-light" disabled={busy} onClick={onClose}>
                  Đóng
                </button>
                <button type="submit" className="btn-primary" disabled={busy}>
                  {busy ? 'Đang lưu...' : 'Lưu cài đặt'}
                </button>
              </div>
            </div>
          </form>
        )}
      </motion.div>
    </motion.div>
  );
}
