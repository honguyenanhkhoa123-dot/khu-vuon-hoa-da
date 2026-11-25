export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyPasscode(plain: string, expectedHash: string): Promise<boolean> {
  if (!plain || !expectedHash) return false;
  const actual = await sha256Hex(plain);
  const target = expectedHash.trim().toLowerCase();
  if (actual.length !== target.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i += 1) {
    diff |= actual.charCodeAt(i) ^ target.charCodeAt(i);
  }
  return diff === 0;
}
