export interface RepoConfig {
  owner: string;
  repo: string;
  branch: string;
}

export class GitHubAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GitHubAuthError';
  }
}

export function encodeUtf8Base64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

export function decodeUtf8Base64(base64: string): string {
  const cleaned = base64.replace(/\s+/g, '');
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function githubHeaders(token: string): HeadersInit {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token.trim()}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json'
  };
}

export async function verifyRepoToken(
  cfg: RepoConfig,
  token: string
): Promise<{ ok: boolean; login?: string; error?: string }> {
  const trimmed = token.trim();
  if (!trimmed) {
    return { ok: false, error: 'Vui lòng nhập GitHub Token của kho lưu trữ.' };
  }

  const res = await fetch(`https://api.github.com/repos/${cfg.owner}/${cfg.repo}`, {
    headers: githubHeaders(trimmed),
    cache: 'no-store'
  });

  if (res.status === 401) {
    return { ok: false, error: 'Token GitHub không hợp lệ hoặc đã bị thu hồi.' };
  }
  if (res.status === 403 || res.status === 404) {
    return { ok: false, error: 'Token không có quyền truy cập kho lưu trữ Khu vườn hóa đá.' };
  }
  if (!res.ok) {
    return { ok: false, error: `Không thể xác thực Token (mã lỗi ${res.status}).` };
  }

  const repoInfo = (await res.json()) as {
    permissions?: { push?: boolean; admin?: boolean };
  };
  if (!repoInfo.permissions?.push && !repoInfo.permissions?.admin) {
    return {
      ok: false,
      error: 'Token chưa có quyền ghi (Contents: Read and Write) cho kho lưu trữ này.'
    };
  }

  let login: string | undefined;
  try {
    const userRes = await fetch('https://api.github.com/user', {
      headers: githubHeaders(trimmed),
      cache: 'no-store'
    });
    if (userRes.ok) {
      const userData = (await userRes.json()) as { login?: string };
      login = userData.login;
    }
  } catch {
    // Fine-grained repo-only tokens may not allow /user; ignore cleanly.
  }

  return { ok: true, login };
}

export async function readJsonFile<T>(
  cfg: RepoConfig,
  token: string,
  repoPath: string
): Promise<{ sha: string; data: T }> {
  const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${repoPath}?ref=${encodeURIComponent(cfg.branch)}`;
  const res = await fetch(url, {
    headers: githubHeaders(token),
    cache: 'no-store'
  });

  if (res.status === 401 || res.status === 403) {
    throw new GitHubAuthError('Phiên Token GitHub đã hết hạn hoặc bị thu hồi.');
  }
  if (!res.ok) {
    throw new Error(`Không đọc được tệp ${repoPath} từ GitHub (mã ${res.status}).`);
  }

  const payload = (await res.json()) as { sha: string; content: string };
  const decoded = decodeUtf8Base64(payload.content);
  return { sha: payload.sha, data: JSON.parse(decoded) as T };
}

export async function uploadBinaryFile(
  cfg: RepoConfig,
  token: string,
  repoPath: string,
  base64: string,
  message: string,
  maxRetries = 3
): Promise<void> {
  const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${repoPath}`;

  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    const res = await fetch(url, {
      method: 'PUT',
      headers: githubHeaders(token),
      body: JSON.stringify({
        message,
        content: base64,
        branch: cfg.branch
      })
    });

    if (res.ok) {
      return;
    }

    if (res.status === 409 && attempt < maxRetries - 1) {
      continue;
    }

    if (res.status === 401 || res.status === 403) {
      throw new GitHubAuthError('Token GitHub không đủ quyền tải tệp lên kho lưu trữ.');
    }

    if (res.status === 409) {
      throw new Error('Kho đang có người khác đăng tệp cùng lúc, vui lòng thử lại.');
    }

    throw new Error(`Tải tệp ${repoPath} thất bại (mã ${res.status}).`);
  }
}

export async function updateJsonFileWithRetry<T>(
  cfg: RepoConfig,
  token: string,
  repoPath: string,
  mutator: (current: T) => T,
  message: string,
  maxRetries = 3
): Promise<T> {
  const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${repoPath}`;

  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    const { sha, data } = await readJsonFile<T>(cfg, token, repoPath);
    const nextData = mutator(data);
    const serialized = JSON.stringify(nextData, null, 2) + '\n';

    const putRes = await fetch(url, {
      method: 'PUT',
      headers: githubHeaders(token),
      body: JSON.stringify({
        message,
        content: encodeUtf8Base64(serialized),
        sha,
        branch: cfg.branch
      })
    });

    if (putRes.ok) {
      return nextData;
    }

    if (putRes.status === 409 || putRes.status === 422) {
      if (attempt < maxRetries - 1) {
        continue;
      }
      throw new Error('Dữ liệu đang được người khác cập nhật cùng lúc, vui lòng thử lại.');
    }

    if (putRes.status === 401 || putRes.status === 403) {
      throw new GitHubAuthError('Token GitHub không hợp lệ hoặc đã bị thu hồi.');
    }

    throw new Error(`Không lưu được ${repoPath} lên GitHub (mã ${putRes.status}).`);
  }

  throw new Error('Dữ liệu đang được người khác cập nhật cùng lúc, vui lòng thử lại.');
}
