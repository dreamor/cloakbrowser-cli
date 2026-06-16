import { CloakError } from '../../errors.js';

/** Extract optional string param or return undefined */
export const optStr = (p: Record<string, unknown>, k: string): string | undefined =>
  typeof p[k] === 'string' && p[k] ? (p[k] as string) : undefined;

/** Extract optional number param or return undefined */
export const optNum = (p: Record<string, unknown>, k: string): number | undefined =>
  typeof p[k] === 'number' ? (p[k] as number) : undefined;

/** Extract optional boolean param or return undefined */
export const optBool = (p: Record<string, unknown>, k: string): boolean | undefined =>
  typeof p[k] === 'boolean' ? (p[k] as boolean) : undefined;

/** Extract required string param or throw INVALID_ARG */
export function reqStr(p: Record<string, unknown>, k: string): string {
  const v = p[k];
  if (typeof v !== 'string' || !v) throw new CloakError('INVALID_ARG', `Missing required: ${k}`);
  return v;
}

/**
 * If the given string looks like a cloak uid (e.g. "u7", "u123"), convert it
 * to a CSS selector targeting the `data-cloak-uid` attribute so it can be
 * passed directly to Playwright locators. Otherwise pass through unchanged.
 */
export function resolveUid(sel: string): string {
  if (/^u\d+$/.test(sel)) return `[data-cloak-uid="${sel}"]`;
  return sel;
}