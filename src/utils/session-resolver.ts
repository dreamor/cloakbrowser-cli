import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { paths } from './paths.js';
import { CloakError } from '../errors.js';

const aliasesPath = join(paths.root, 'aliases.json');
const lastSessionPath = join(paths.root, 'last-session.txt');

type AliasMap = Record<string, string>;

/** Load all saved session aliases from disk */
export function loadAliases(): AliasMap {
  try {
    if (!existsSync(aliasesPath)) return {};
    const raw = readFileSync(aliasesPath, 'utf8');
    return JSON.parse(raw) as AliasMap;
  } catch {
    return {};
  }
}

/** Persist an alias mapping to disk */
export function saveAlias(name: string, sessionId: string): void {
  try {
    mkdirSync(paths.root, { recursive: true });
  } catch { /* ignore */ }
  const aliases = loadAliases();
  aliases[name] = sessionId;
  writeFileSync(aliasesPath, JSON.stringify(aliases, null, 2));
}

/** Remove an alias mapping from disk */
export function removeAlias(name: string): void {
  try {
    const aliases = loadAliases();
    if (!(name in aliases)) return;
    delete aliases[name];
    writeFileSync(aliasesPath, JSON.stringify(aliases, null, 2));
  } catch { /* ignore */ }
}

/**
 * Resolve a session identifier to a concrete session ID.
 *
 * - Plain IDs like `s-abc123` pass through unchanged.
 * - `@name` looks up the alias file (throws if not found).
 * - `-` reads the last-used session (throws if none available).
 */
export function resolveSid(sid: string): string {
  // Alias lookup
  if (sid.startsWith('@')) {
    const name = sid.slice(1);
    const aliases = loadAliases();
    const resolved = aliases[name];
    if (!resolved) {
      throw new CloakError(
        'SESSION_NOT_FOUND',
        `Session alias "@${name}" not found. Use \`cloak session alias\` to list saved aliases.`
      );
    }
    return resolved;
  }

  // Last session
  if (sid === '-') {
    const last = readLastSession();
    if (!last) {
      throw new CloakError(
        'SESSION_NOT_FOUND',
        'No previous session found. Create one with `cloak session new`.'
      );
    }
    return last;
  }

  // Pass through
  return sid;
}

/** Save a session ID as the "last used" session */
export function saveLastSession(sessionId: string): void {
  try {
    mkdirSync(paths.root, { recursive: true });
  } catch { /* ignore */ }
  writeFileSync(lastSessionPath, sessionId, 'utf8');
}

/** Read the last-used session ID, or undefined */
export function readLastSession(): string | undefined {
  try {
    if (!existsSync(lastSessionPath)) return undefined;
    return readFileSync(lastSessionPath, 'utf8').trim() || undefined;
  } catch {
    return undefined;
  }
}