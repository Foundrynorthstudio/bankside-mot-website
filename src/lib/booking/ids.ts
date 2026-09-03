import { randomInt } from 'node:crypto';

export function nextId(prefix: string) {
  return `${prefix}-${randomInt(100000, 1000000)}`;
}
