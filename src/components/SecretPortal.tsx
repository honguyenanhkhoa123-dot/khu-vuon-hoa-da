import { useState } from 'react';
import { motion } from 'framer-motion';
import type { AuthSession, SiteSettings } from '../types/zine';
import { verifyPasscode } from '../lib/crypto';
import { verifyRepoToken } from '../lib/githubApi';

interface SecretPortalProps {
  site: SiteSettings;
  onAuthenticated: (session: AuthSession) => void;
  onBackToMagazine: () => void;
}

export function SecretPortal({
  site,
  onAuthenticated,
  onBackToMagazine
}: SecretPortalProps) {
  const [token, setToken] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGitHubLogin(wantAdmin: boolean) {
    setError(null);
    setBusy(true);
    try {
      const check = await verifyRepoToken(
        {
          owner: site.repoOwner,
          repo: site.repoName,
          branch: site.repoBranch
        },
        token
      );

      if (!check.ok) {
        setError(check.error || 'Không thể xác thực Token GitHub.');
        return;
      }

      if (wantAdmin) {
        const okPass = await verifyPasscode(adminPass, site.adminPasscodeHash);
        if (!okPass) {
          setError('Mã Admin không đúng.');
          return;
        }
      }

      onAuthenticated({
        role: wantAdmin ? 'admin' : 'editor',
        mode: 'github',
        token: token.trim(),
        githubLogin: check.login
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xác thực thất bại.');
    } finally {
      setBusy(false);
    }
  }

  async function handleLocalDemo(wantAdmin: boolean) {
    setError(null);
    if (wantAdmin && adminPass.trim()) {
      const okPass = await verifyPasscode(adminPass, site.adminPasscodeHash);
      if (!okPass) {
        setError('Mã Admin không đúng.');
        return;
      }
    }
    onAuthenticated({
      role: wantAdmin ? 'admin' : 'editor',
      mode: 'local'
    });
  }

  return (
    <div className="portal-wrap">
      <motion.section
        className="portal-card"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="portal-eyebrow">CỔNG BIÊN TẬP ẨN — KHÔNG CÔNG KHAI</p>
        <h1>{site.title}</h1>
        <p className="portal-desc">
          Chỉ dành cho quản trị viên và thành viên được cấp quyền đăng bài. Nhập GitHub Fine-grained
          Token của kho <code>{site.repoName}</code> để đăng bài thật lên trang công khai.
        </p>

        {error && (
          <div className="field-error" role="alert">
            {error}
          </div>
        )}

        <div className="field-group">
          <label className="field-label" htmlFor="portal-token">
            GitHub Token (quyền Contents: Read and Write)
          </label>
          <input
            id="portal-token"
            type="password"
            className="field-input"
            placeholder="github_pat_..."
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoComplete="off"
          />
        </div>

        <div className="field-group">
          <label className="field-label" htmlFor="portal-admin-pass">
            Mã Admin (chỉ điền nếu mở quyền quản trị)
          </label>
          <input
            id="portal-admin-pass"
            type="password"
            className="field-input"
            placeholder="Để trống nếu chỉ đăng bài"
            value={adminPass}
            onChange={(e) => setAdminPass(e.target.value)}
            autoComplete="off"
          />
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={() => handleGitHubLogin(false)}
          >
            {busy ? 'Đang xác thực...' : 'Mở chế độ Biên tập viên'}
          </button>
          <button
            type="button"
            className="btn-ghost-light"
            disabled={busy}
            onClick={() => handleGitHubLogin(true)}
          >
            Mở chế độ Admin
          </button>
        </div>

        <hr className="portal-divider" />

        <p className="portal-desc" style={{ marginBottom: '10px' }}>
          Chưa tạo Token GitHub? Bạn có thể thử giao diện đăng bài và quản trị ngay trên trình duyệt
          này (dữ liệu chỉ lưu cục bộ trên máy bạn):
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            className="btn-ghost-light"
            disabled={busy}
            onClick={() => handleLocalDemo(false)}
          >
            Thử nhanh Biên tập viên
          </button>
          <button
            type="button"
            className="btn-ghost-light"
            disabled={busy}
            onClick={() => handleLocalDemo(true)}
          >
            Thử nhanh Admin
          </button>
          <button
            type="button"
            className="btn-ghost-light"
            style={{ marginLeft: 'auto', borderStyle: 'dashed' }}
            onClick={onBackToMagazine}
          >
            Quay lại tạp chí
          </button>
        </div>
      </motion.section>
    </div>
  );
}
