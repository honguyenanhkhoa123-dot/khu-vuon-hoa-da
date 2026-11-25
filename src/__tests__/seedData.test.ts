import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const EMOJI_RE = /\p{Extended_Pictographic}/u;

describe('seed data & zero-emoji invariant', () => {
  it('validates site.json has exact brand name and admin hash', () => {
    const site = JSON.parse(fs.readFileSync(path.resolve('public/data/site.json'), 'utf8'));
    expect(site.title).toBe('Khu vườn hóa đá');
    expect(site.adminPasscodeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(EMOJI_RE.test(JSON.stringify(site))).toBe(false);
  });

  it('validates posts.json covers grades 10-12 cleanly with zero emojis', () => {
    const posts = JSON.parse(fs.readFileSync(path.resolve('public/data/posts.json'), 'utf8'));
    expect(Array.isArray(posts)).toBe(true);
    expect(posts.some((p: { grade: number }) => p.grade === 12)).toBe(true);
    expect(posts.every((p: { grade: number }) => [10, 11, 12].includes(p.grade))).toBe(true);
    expect(EMOJI_RE.test(JSON.stringify(posts))).toBe(false);
  });
});
