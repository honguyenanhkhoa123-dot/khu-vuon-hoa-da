import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import type {
  AuthRole,
  AuthSession,
  DraftPostInput,
  Grade,
  MediaItem,
  Post,
  SiteSettings
} from './types/zine';
import {
  clearLocalPreviewData,
  createPost,
  deletePostAdmin,
  loadInitialData,
  updatePostAdmin,
  updateSiteSettingsAdmin
} from './lib/store';
import { Masthead } from './components/Masthead';
import { HeroCover } from './components/HeroCover';
import { GradeTabs, type TagFilter } from './components/GradeTabs';
import { PostCard } from './components/PostCard';
import { LightboxModal } from './components/LightboxModal';
import { SecretPortal } from './components/SecretPortal';
import { PostComposerModal } from './components/PostComposerModal';
import { AdminSettingsModal } from './components/AdminSettingsModal';

const SESSION_KEY = 'kvhd_editorial_session_v1';
const SECRET_HASH = '#/cong-bien-tap';

function readStoredSession(): AuthSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    return null;
  }
}

export function App() {
  const [hash, setHash] = useState(() => window.location.hash);
  const [session, setSession] = useState<AuthSession | null>(() => readStoredSession());
  const [site, setSite] = useState<SiteSettings | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [activeGrade, setActiveGrade] = useState<Grade>(12);
  const [activeTag, setActiveTag] = useState<TagFilter>('ALL');

  const [lightbox, setLightbox] = useState<{
    media: MediaItem[];
    index: number;
    caption: string;
  } | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [adminModal, setAdminModal] = useState<{ open: boolean; post: Post | null }>({
    open: false,
    post: null
  });
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    function onHashChange() {
      setHash(window.location.hash);
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    loadInitialData(session)
      .then((res) => {
        if (!active) return;
        setSite(res.site);
        setPosts(res.posts);
      })
      .catch((err) => {
        if (!active) return;
        setLoadError(err instanceof Error ? err.message : 'Không tải được dữ liệu ấn phẩm.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [session]);

  const role: AuthRole = session?.role ?? 'public';

  const visiblePosts = useMemo(
    () => (role === 'admin' ? posts : posts.filter((p) => !p.hidden)),
    [posts, role]
  );

  const gradeCounts = useMemo<Record<Grade, number>>(() => {
    const counts: Record<Grade, number> = { 10: 0, 11: 0, 12: 0 };
    for (const p of visiblePosts) {
      counts[p.grade] += 1;
    }
    return counts;
  }, [visiblePosts]);

  const filteredPosts = useMemo(
    () =>
      visiblePosts.filter(
        (p) => p.grade === activeGrade && (activeTag === 'ALL' || p.tag === activeTag)
      ),
    [visiblePosts, activeGrade, activeTag]
  );

  function saveSession(next: AuthSession | null) {
    setSession(next);
    if (next) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
      window.location.hash = '';
      setHash('');
    } else {
      sessionStorage.removeItem(SESSION_KEY);
      setBanner(null);
    }
  }

  function showNotice(msg: string) {
    setBanner(msg);
  }

  async function handleCreatePost(input: DraftPostInput, onProgress: (pct: number) => void) {
    if (!site || !session) return;
    const updated = await createPost(input, site, session, onProgress);
    setPosts(updated);
    setActiveGrade(input.grade);
    setActiveTag('ALL');
    showNotice(
      session.mode === 'github'
        ? 'Đã đăng bài lên GitHub — trang công khai sẽ tự cập nhật sau khoảng 30 giây.'
        : 'Đã đăng bài trong chế độ thử cục bộ trên máy này.'
    );
  }

  async function handleUpdatePost(
    postId: string,
    patch: Partial<Pick<Post, 'grade' | 'tag' | 'hidden' | 'media' | 'isSpoiler'>>
  ) {
    if (!site || !session) return;
    const updated = await updatePostAdmin(postId, patch, site, session);
    setPosts(updated);
    showNotice(
      session.mode === 'github'
        ? 'Đã cập nhật bài viết lên GitHub.'
        : 'Đã cập nhật bài viết cục bộ.'
    );
  }

  async function handleDeletePost(postId: string) {
    if (!site || !session) return;
    const updated = await deletePostAdmin(postId, site, session);
    setPosts(updated);
    showNotice(
      session.mode === 'github'
        ? 'Đã xóa bài viết khỏi kho GitHub.'
        : 'Đã xóa bài viết cục bộ.'
    );
  }

  async function handleUpdateSite(
    patch: Partial<Pick<SiteSettings, 'heroImage' | 'heroCaption' | 'adminPasscodeHash'>>,
    heroFile?: File
  ) {
    if (!site || !session) return;
    const updated = await updateSiteSettingsAdmin(patch, site, session, heroFile);
    setSite(updated);
    showNotice(
      session.mode === 'github'
        ? 'Đã lưu cài đặt trang lên GitHub.'
        : 'Đã lưu cài đặt trang cục bộ.'
    );
  }

  if (loading && !site) {
    return (
      <MotionConfig reducedMotion="user">
        <div className="zine-page">
          <p className="masthead-meta">Đang mở Khu vườn hóa đá...</p>
        </div>
      </MotionConfig>
    );
  }

  if (loadError || !site) {
    return (
      <MotionConfig reducedMotion="user">
        <div className="zine-page">
          <div className="field-error">{loadError || 'Không tìm thấy dữ liệu trang.'}</div>
        </div>
      </MotionConfig>
    );
  }

  const isPortalRoute = hash.replace(/\/+$/, '') === SECRET_HASH;
  if (isPortalRoute) {
    return (
      <MotionConfig reducedMotion="user">
        <SecretPortal
          site={site}
          onAuthenticated={(nextSession) => saveSession(nextSession)}
          onBackToMagazine={() => {
            window.location.hash = '';
            setHash('');
          }}
        />
      </MotionConfig>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      {session && (
        <div className="editorial-bar">
          <div className="editorial-bar-inner">
            <div className="editorial-status">
              <span className="status-dot" aria-hidden="true" />
              <span>
                {role === 'admin' ? 'CHẾ ĐỘ ADMIN' : 'CHẾ ĐỘ BIÊN TẬP VIÊN'} ·{' '}
                {session.mode === 'github'
                  ? `ĐỒNG BỘ GITHUB${session.githubLogin ? ` (${session.githubLogin})` : ''}`
                  : 'THỬ CỤC BỘ'}
              </span>
            </div>
            <div className="editorial-actions">
              <button
                type="button"
                className="btn-accent"
                onClick={() => setComposerOpen(true)}
              >
                + Đăng bài
              </button>
              {role === 'admin' && (
                <button
                  type="button"
                  className="btn-ghost-dark"
                  onClick={() => setAdminModal({ open: true, post: null })}
                >
                  Cài đặt trang
                </button>
              )}
              <button
                type="button"
                className="btn-ghost-dark"
                onClick={() => saveSession(null)}
              >
                Thoát
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="zine-page">
        <Masthead title={site.title} cohort={site.cohort} />
        <HeroCover site={site} />

        {banner && session && (
          <div className="field-notice" role="status">
            {banner}
          </div>
        )}

        <GradeTabs
          activeGrade={activeGrade}
          counts={gradeCounts}
          activeTag={activeTag}
          onSelectGrade={(g) => setActiveGrade(g)}
          onSelectTag={(t) => setActiveTag(t)}
        />

        <AnimatePresence mode="wait">
          <motion.section
            key={`${activeGrade}-${activeTag}`}
            className="feed-list"
            aria-label={`Dòng kỷ niệm Lớp ${activeGrade}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            {filteredPosts.length === 0 ? (
              <div className="empty-grade-card">
                <p className="empty-eyebrow">CHƯƠNG LỚP {activeGrade}</p>
                <h3>
                  {gradeCounts[activeGrade] === 0
                    ? `Ký ức Lớp ${activeGrade} đang được biên tập thêm`
                    : `Chưa có bài thuộc chủ đề "${activeTag}" ở Lớp ${activeGrade}`}
                </h3>
                <p>
                  {gradeCounts[activeGrade] === 0
                    ? `Những mảnh ghép đầu tiên của năm lớp ${activeGrade} sẽ sớm xuất hiện trên ${site.title}.`
                    : 'Chọn lại mục "Tất cả" để xem các bài viết khác của năm học này.'}
                </p>
              </div>
            ) : (
              filteredPosts.map((post, idx) => (
                <PostCard
                  key={post.id}
                  post={post}
                  role={role}
                  index={idx}
                  onOpenMedia={(media, index, caption) => setLightbox({ media, index, caption })}
                  onManagePost={
                    role === 'admin'
                      ? (target) => setAdminModal({ open: true, post: target })
                      : undefined
                  }
                />
              ))
            )}
          </motion.section>
        </AnimatePresence>

        <footer className="zine-footer">
          <span>{site.title} — 12 Chuyên Hóa</span>
          <span>Lưu giữ trọn vẹn ba năm cấp ba ({site.cohort})</span>
        </footer>
      </main>

      <AnimatePresence>
        {lightbox && (
          <LightboxModal
            media={lightbox.media}
            initialIndex={lightbox.index}
            caption={lightbox.caption}
            onClose={() => setLightbox(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {composerOpen && session && (
          <PostComposerModal
            defaultGrade={activeGrade}
            onSubmit={handleCreatePost}
            onClose={() => setComposerOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {adminModal.open && session?.role === 'admin' && (
          <AdminSettingsModal
            site={site}
            storageMode={session.mode}
            editingPost={adminModal.post}
            onUpdatePost={handleUpdatePost}
            onDeletePost={handleDeletePost}
            onUpdateSite={handleUpdateSite}
            onResetLocal={() => {
              clearLocalPreviewData();
              loadInitialData(session).then((res) => {
                setSite(res.site);
                setPosts(res.posts);
                showNotice('Đã khôi phục dữ liệu mẫu gốc.');
              });
            }}
            onClose={() => setAdminModal({ open: false, post: null })}
          />
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
