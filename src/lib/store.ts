import type {
  AuthSession,
  DraftPostInput,
  MediaItem,
  Post,
  SiteSettings
} from '../types/zine';
import {
  GitHubAuthError,
  readJsonFile,
  updateJsonFileWithRetry,
  uploadBinaryFile,
  type RepoConfig
} from './githubApi';
import {
  blobToBase64,
  blobToDataUrl,
  compressImageFile,
  isVideoFile
} from './media';

const LOCAL_POSTS_KEY = 'kvhd_local_posts_v1';
const LOCAL_SITE_KEY = 'kvhd_local_site_v1';

function repoConfigOf(site: SiteSettings): RepoConfig {
  return {
    owner: site.repoOwner,
    repo: site.repoName,
    branch: site.repoBranch
  };
}

function makeId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}

function safeLocalStorageSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

async function makePreviewUrl(blob: Blob): Promise<string> {
  if (typeof URL.createObjectURL === 'function') {
    return URL.createObjectURL(blob);
  }
  return blobToDataUrl(blob);
}

async function fetchStaticJson<T>(relativePath: string): Promise<T> {
  const res = await fetch(relativePath, { cache: 'no-cache' });
  if (!res.ok) {
    throw new Error(`Không tải được dữ liệu ${relativePath}`);
  }
  return (await res.json()) as T;
}

export async function loadInitialData(
  session: AuthSession | null
): Promise<{ site: SiteSettings; posts: Post[]; authExpired?: boolean }> {
  const [staticSite, staticPosts] = await Promise.all([
    fetchStaticJson<SiteSettings>('./data/site.json'),
    fetchStaticJson<Post[]>('./data/posts.json')
  ]);

  if (session?.mode === 'github' && session.token) {
    try {
      const cfg = repoConfigOf(staticSite);
      const [ghSite, ghPosts] = await Promise.all([
        readJsonFile<SiteSettings>(cfg, session.token, 'docs/data/site.json'),
        readJsonFile<Post[]>(cfg, session.token, 'docs/data/posts.json')
      ]);
      return { site: ghSite.data, posts: ghPosts.data };
    } catch (err) {
      if (err instanceof GitHubAuthError) {
        return { site: staticSite, posts: staticPosts, authExpired: true };
      }
      return { site: staticSite, posts: staticPosts };
    }
  }

  if (session?.mode === 'local') {
    const rawSite = localStorage.getItem(LOCAL_SITE_KEY);
    const rawPosts = localStorage.getItem(LOCAL_POSTS_KEY);
    return {
      site: rawSite ? (JSON.parse(rawSite) as SiteSettings) : staticSite,
      posts: rawPosts ? (JSON.parse(rawPosts) as Post[]) : staticPosts
    };
  }

  return { site: staticSite, posts: staticPosts };
}

export async function createPost(
  input: DraftPostInput,
  site: SiteSettings,
  session: AuthSession,
  onProgress?: (pct: number) => void,
  onPreviewUrl?: (repoRelUrl: string, localPreviewUrl: string) => void
): Promise<Post[]> {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const mediaItems: MediaItem[] = [];
  const totalSteps = Math.max(1, input.files.length + 1);
  let completed = 0;

  const tick = () => {
    completed += 1;
    onProgress?.(Math.min(100, Math.round((completed / totalSteps) * 100)));
  };

  for (const file of input.files) {
    const isVid = isVideoFile(file);
    const itemId = makeId(isVid ? 'vid' : 'img');

    if (session.mode === 'github' && session.token) {
      const cfg = repoConfigOf(site);
      let uploadBlob: Blob;
      let ext: string;

      if (isVid) {
        ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : 'mp4';
        uploadBlob = file;
      } else {
        const compressed = await compressImageFile(file);
        ext = compressed.ext;
        uploadBlob = compressed.blob;
      }

      const base64 = await blobToBase64(uploadBlob);
      const relPath = `uploads/${ym}/${itemId}.${ext}`;
      await uploadBinaryFile(
        cfg,
        session.token,
        `docs/${relPath}`,
        base64,
        `media: upload ${itemId}.${ext} for Lop ${input.grade}`
      );

      const relUrl = `./${relPath}`;
      const localUrl = await makePreviewUrl(uploadBlob);
      onPreviewUrl?.(relUrl, localUrl);

      mediaItems.push({
        id: itemId,
        type: isVid ? 'video' : 'image',
        url: relUrl,
        alt: input.momentLabel || `Kỷ niệm Lớp ${input.grade}`
      });
    } else {
      const blob = isVid ? file : (await compressImageFile(file, 1080, 0.78)).blob;
      const url = isVid ? await makePreviewUrl(blob) : await blobToDataUrl(blob);
      mediaItems.push({
        id: itemId,
        type: isVid ? 'video' : 'image',
        url,
        alt: input.momentLabel || `Kỷ niệm Lớp ${input.grade}`
      });
    }

    tick();
  }

  const newPost: Post = {
    id: makeId(`post-${input.grade}`),
    grade: input.grade,
    authorName: input.authorName.trim(),
    momentLabel: input.momentLabel?.trim() || undefined,
    tag: input.tag,
    body: input.body.trim(),
    isSpoiler: input.isSpoiler,
    createdAt: now.toISOString(),
    media: mediaItems
  };

  if (session.mode === 'github' && session.token) {
    const updated = await updateJsonFileWithRetry<Post[]>(
      repoConfigOf(site),
      session.token,
      'docs/data/posts.json',
      (list) => [newPost, ...list],
      `feat: add Lop ${input.grade} post by ${newPost.authorName}`
    );
    tick();
    return updated;
  }

  const existingRaw = localStorage.getItem(LOCAL_POSTS_KEY);
  const existing = existingRaw
    ? (JSON.parse(existingRaw) as Post[])
    : await fetchStaticJson<Post[]>('./data/posts.json');
  const next = [newPost, ...existing];
  safeLocalStorageSet(LOCAL_POSTS_KEY, JSON.stringify(next));
  tick();
  return next;
}

export async function updatePostAdmin(
  postId: string,
  patch: Partial<Pick<Post, 'grade' | 'tag' | 'hidden' | 'media' | 'isSpoiler'>>,
  site: SiteSettings,
  session: AuthSession
): Promise<Post[]> {
  if (session.role !== 'admin') {
    throw new Error('Chỉ Admin mới có quyền chỉnh sửa bài viết.');
  }

  const applyPatch = (list: Post[]) =>
    list.map((p) => (p.id === postId ? { ...p, ...patch } : p));

  if (session.mode === 'github' && session.token) {
    return updateJsonFileWithRetry<Post[]>(
      repoConfigOf(site),
      session.token,
      'docs/data/posts.json',
      applyPatch,
      `admin: update post ${postId}`
    );
  }

  const existingRaw = localStorage.getItem(LOCAL_POSTS_KEY);
  const existing = existingRaw
    ? (JSON.parse(existingRaw) as Post[])
    : await fetchStaticJson<Post[]>('./data/posts.json');
  const next = applyPatch(existing);
  safeLocalStorageSet(LOCAL_POSTS_KEY, JSON.stringify(next));
  return next;
}

export async function deletePostAdmin(
  postId: string,
  site: SiteSettings,
  session: AuthSession
): Promise<Post[]> {
  if (session.role !== 'admin') {
    throw new Error('Chỉ Admin mới có quyền xóa bài viết.');
  }

  const remove = (list: Post[]) => list.filter((p) => p.id !== postId);

  if (session.mode === 'github' && session.token) {
    return updateJsonFileWithRetry<Post[]>(
      repoConfigOf(site),
      session.token,
      'docs/data/posts.json',
      remove,
      `admin: delete post ${postId}`
    );
  }

  const existingRaw = localStorage.getItem(LOCAL_POSTS_KEY);
  const existing = existingRaw
    ? (JSON.parse(existingRaw) as Post[])
    : await fetchStaticJson<Post[]>('./data/posts.json');
  const next = remove(existing);
  safeLocalStorageSet(LOCAL_POSTS_KEY, JSON.stringify(next));
  return next;
}

export async function updateSiteSettingsAdmin(
  patch: Partial<Pick<SiteSettings, 'heroImage' | 'heroCaption' | 'adminPasscodeHash'>>,
  site: SiteSettings,
  session: AuthSession,
  heroFile?: File,
  onPreviewUrl?: (repoRelUrl: string, localPreviewUrl: string) => void
): Promise<SiteSettings> {
  if (session.role !== 'admin') {
    throw new Error('Chỉ Admin mới có quyền thay đổi cài đặt trang.');
  }

  let uploadedHeroUrl: string | undefined;

  if (heroFile) {
    const compressed = await compressImageFile(heroFile, 1800, 0.85);
    const heroId = makeId('hero');
    if (session.mode === 'github' && session.token) {
      const relPath = `uploads/hero/${heroId}.${compressed.ext}`;
      const base64 = await blobToBase64(compressed.blob);
      await uploadBinaryFile(
        repoConfigOf(site),
        session.token,
        `docs/${relPath}`,
        base64,
        `admin: upload hero cover ${heroId}`
      );
      uploadedHeroUrl = `./${relPath}`;
      onPreviewUrl?.(uploadedHeroUrl, await makePreviewUrl(compressed.blob));
    } else {
      uploadedHeroUrl = await blobToDataUrl(compressed.blob);
    }
  }

  const applyPatch = (cur: SiteSettings): SiteSettings => ({
    ...cur,
    ...patch,
    heroImage: uploadedHeroUrl ?? patch.heroImage ?? cur.heroImage
  });

  if (session.mode === 'github' && session.token) {
    return updateJsonFileWithRetry<SiteSettings>(
      repoConfigOf(site),
      session.token,
      'docs/data/site.json',
      applyPatch,
      'admin: update site settings'
    );
  }

  const next = applyPatch(site);
  safeLocalStorageSet(LOCAL_SITE_KEY, JSON.stringify(next));
  return next;
}

export function clearLocalPreviewData(): void {
  localStorage.removeItem(LOCAL_POSTS_KEY);
  localStorage.removeItem(LOCAL_SITE_KEY);
}
