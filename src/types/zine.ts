export type Grade = 10 | 11 | 12;

export type PostTag =
  | 'Ảnh lớp'
  | 'Sự kiện'
  | 'Điểm đồ'
  | 'Nghịch phá'
  | 'Kỷ niệm';

export type MediaType = 'image' | 'video';

export interface MediaItem {
  id: string;
  type: MediaType;
  url: string;
  alt?: string;
  durationSec?: number;
}

export interface Post {
  id: string;
  grade: Grade;
  authorName: string;
  momentLabel?: string;
  tag: PostTag;
  body: string;
  isSpoiler: boolean;
  createdAt: string;
  hidden?: boolean;
  media: MediaItem[];
}

export interface SiteSettings {
  title: string;
  subtitle: string;
  cohort: string;
  heroImage: string;
  heroCaption: string;
  repoOwner: string;
  repoName: string;
  repoBranch: string;
  adminPasscodeHash: string;
}

export type AuthRole = 'public' | 'editor' | 'admin';

export type StorageMode = 'github' | 'local';

export interface AuthSession {
  role: Exclude<AuthRole, 'public'>;
  mode: StorageMode;
  token?: string;
  githubLogin?: string;
}

export interface DraftPostInput {
  grade: Grade;
  authorName: string;
  momentLabel?: string;
  tag: PostTag;
  body: string;
  isSpoiler: boolean;
  files: File[];
}
