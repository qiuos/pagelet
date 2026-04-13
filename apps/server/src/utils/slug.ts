import { randomBytes } from 'crypto';
import { SLUG_CHARS, SLUG_LENGTH } from '@pagelet/shared';

/**
 * 生成随机 slug（用于分享链接）
 */
export function generateSlug(length: number = SLUG_LENGTH): string {
  let result = '';
  const chars = SLUG_CHARS;
  const charsLength = chars.length;

  const randomValues = randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % charsLength];
  }

  return result;
}

/**
 * 生成 UUID v4
 */
export function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}