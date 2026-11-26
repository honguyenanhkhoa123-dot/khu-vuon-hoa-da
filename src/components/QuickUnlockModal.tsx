import { useEffect, useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import type { AuthSession, SiteSettings } from '../types/zine';
import { decryptSecretWithPasscode, verifyPasscode } from '../lib/crypto';
import { verifyRepoToken } from '../lib/githubApi';
import { setupQuickAccessVaults } from '../lib/store';

interface QuickUnlockModalProps {
  site: SiteSettings;
  onUnlocked: (session: AuthSession, remember: boolean, updatedSite?: SiteSettings) => void;
  onClose: () => void;
}

type ModalMode = 'passcode' | 'setup';

export function QuickUnlockModal({
  site,
  onUnlocked,
  onClose
}: QuickUnlockModalProps) {
  const hasVaults = Boolean(site.editorVault || site.adminVault);
  const [mode, setMode] = useState<ModalMode>('passcode');
  const [passcode, setPasscode] = useState('');
  const [remember, setRemember] = useState(true);

  // One-time setup fields
  const [setupToken, setSetupToken] = useState('');
  const [editorCode, setEditorCode] = useState('');
  const [adminCode, setAdminCode] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, onClose]);

  async function handlePasscodeSubmit(e: FormEvent) {
    e.preventDefault();
    const code = passcode.trim();
    if (!code) {
      setError('Vui lòng nhập mật mã truy cập.');
      return;
    }

    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const cfg = {
        owner: site.repoOwner,
        repo: site.repoName,
        branch: site.repoBranch
      };

      // 1. Try Admin vault first
      if (site.adminVault) {
        const decryptedAdminToken = await decryptSecretWithPasscode(site.adminVault, code);
        if (decryptedAdminToken) {
          const check = await verifyRepoToken(cfg, decryptedAdminToken);
          if (!check.ok) {
            setError(
              check.error ||
                'Token GitHub đã hết hạn hoặc bị thu hồi — hãy thiết lập lại bằng Token mới.'
            );
            return;
          }
          onUnlocked(
            {
              role: 'admin',
              mode: 'github',
              token: decryptedAdminToken,
              githubLogin: check.login
            },
            remember
          );
          return;
        }
      }

      // 2. Try Editor vault
      if (site.editorVault) {
        const decryptedEditorToken = await decryptSecretWithPasscode(site.editorVault, code);
        if (decryptedEditorToken) {
          const check = await verifyRepoToken(cfg, decryptedEditorToken);
          if (!check.ok) {
            setError(
              check.error ||
                'Token GitHub đã hết hạn hoặc bị thu hồi — báo Admin cập nhật lại khóa.'
            );
            return;
          }
          onUnlocked(
            {
              role: 'editor',
              mode: 'github',
              token: decryptedEditorToken,
              githubLogin: check.login
            },
            remember
          );
          return;
        }
      }

      // 3. Before first-time vault setup: recognize initial Admin passcode and guide 1-time setup
      if (!hasVaults && (await verifyPasscode(code, site.adminPasscodeHash))) {
        setAdminCode(code);
        setMode('setup');
        setNotice(
          'Đã nhận diện Admin. Dán GitHub Token đúng 1 lần duy nhất và đặt 2 mật mã ngắn để từ sau chỉ cần gõ mật mã.'
        );
        return;
      }

      setError('Mật mã không đúng.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mở khóa thất bại.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSetupSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await setupQuickAccessVaults(site, setupToken, editorCode, adminCode);
      onUnlocked(res.session, remember, res.site);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thiết lập khóa nhanh thất bại.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Mở khóa chế độ biên tập"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <motion.div
        className="modal-card"
        style={{ maxWidth: '430px' }}
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.97 }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      >
        {mode === 'passcode' ? (
          <form onSubmit={handlePasscodeSubmit}>
            <p className="portal-eyebrow">TRUY CẬP NỘI BỘ</p>
            <h2 style={{ marginBottom: '8px' }}>Mở khóa {site.title}</h2>
            <p className="portal-desc" style={{ marginBottom: '14px' }}>
              {hasVaults
                ? 'Nhập mật mã ngắn của Biên tập viên hoặc Admin — hệ thống tự nhận diện quyền của bạn.'
                : 'Nhập mã Admin ban đầu để thiết lập khóa nhanh 1 lần duy nhất, hoặc chọn thử nhanh trên máy này.'}
            </p>

            {error && (
              <div className="field-error" role="alert">
                {error}
              </div>
            )}

            <div className="field-group">
              <label className="field-label" htmlFor="quick-passcode">
                Mật mã truy cập
              </label>
              <input
                id="quick-passcode"
                type="password"
                className="field-input"
                placeholder="Nhập mật mã ngắn..."
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                autoFocus
                autoComplete="off"
              />
            </div>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.82rem',
                marginBottom: '14px',
                cursor: 'pointer'
              }}
            >
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <span>Ghi nhớ trên thiết bị này (lần sau vào thẳng)</span>
            </label>

            <div className="modal-footer" style={{ marginTop: 0 }}>
              <button type="button" className="btn-ghost-light" disabled={busy} onClick={onClose}>
                Đóng
              </button>
              <button type="submit" className="btn-primary" disabled={busy}>
                {busy ? 'Đang mở khóa...' : 'Mở khóa'}
              </button>
            </div>

            <hr className="portal-divider" />

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
              <button
                type="button"
                className="btn-ghost-light"
                style={{ fontSize: '0.73rem', padding: '5px 11px' }}
                disabled={busy}
                onClick={() => {
                  setError(null);
                  setMode('setup');
                }}
              >
                Thiết lập khóa nhanh (1 lần)
              </button>
              <button
                type="button"
                className="btn-ghost-light"
                style={{ fontSize: '0.73rem', padding: '5px 11px', borderStyle: 'dashed' }}
                disabled={busy}
                onClick={() => onUnlocked({ role: 'admin', mode: 'local' }, remember)}
              >
                Thử nhanh cục bộ
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSetupSubmit}>
            <p className="portal-eyebrow">THIẾT LẬP 1 LẦN DUY NHẤT</p>
            <h2 style={{ marginBottom: '8px' }}>Khóa Token bằng mật mã ngắn</h2>
            <p className="portal-desc" style={{ marginBottom: '12px' }}>
              Dán GitHub Token (Contents: Read &amp; Write cho kho <code>{site.repoName}</code>) một
              lần duy nhất. Token sẽ được mã hóa AES-256 bằng 2 mật mã ngắn bên dưới.
            </p>

            {notice && <div className="field-notice">{notice}</div>}
            {error && (
              <div className="field-error" role="alert">
                {error}
              </div>
            )}

            <div className="field-group">
              <label className="field-label" htmlFor="setup-token">
                GitHub Token
              </label>
              <input
                id="setup-token"
                type="password"
                className="field-input"
                placeholder="github_pat_..."
                value={setupToken}
                onChange={(e) => setSetupToken(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="field-grid">
              <div className="field-group" style={{ marginBottom: 0 }}>
                <label className="field-label" htmlFor="setup-editor-code">
                  Mã Biên tập viên
                </label>
                <input
                  id="setup-editor-code"
                  type="password"
                  className="field-input"
                  placeholder="Tối thiểu 6 ký tự"
                  value={editorCode}
                  onChange={(e) => setEditorCode(e.target.value)}
                  autoComplete="off"
                />
              </div>

              <div className="field-group" style={{ marginBottom: 0 }}>
                <label className="field-label" htmlFor="setup-admin-code">
                  Mã Admin
                </label>
                <input
                  id="setup-admin-code"
                  type="password"
                  className="field-input"
                  placeholder="Khác mã Biên tập"
                  value={adminCode}
                  onChange={(e) => setAdminCode(e.target.value)}
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-ghost-light"
                disabled={busy}
                onClick={() => {
                  setError(null);
                  setMode('passcode');
                }}
              >
                Quay lại
              </button>
              <button type="submit" className="btn-primary" disabled={busy}>
                {busy ? 'Đang mã hóa & lưu...' : 'Lưu & kích hoạt mã ngắn'}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </motion.div>
  );
}
