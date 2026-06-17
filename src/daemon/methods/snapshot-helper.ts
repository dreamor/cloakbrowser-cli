import type { PageRef } from '../registry.js';
import { SNAPSHOT_TAGGER_SCRIPT, filterSnapshot, type SnapshotItem, type SnapshotFilterOpts } from './params.js';

/**
 * If the caller requested an after-action snapshot, run the snapshot
 * and attach it to the result. Returns the result augmented with
 * `snapshot` if requested, or the result unchanged otherwise.
 *
 * Supports compact (strips bbox/selector) and limit (max elements) filters
 * via the params object.
 */
export async function maybeSnapshot<T extends Record<string, unknown>>(
  result: T,
  ref: PageRef,
  params: Record<string, unknown>,
): Promise<T & { snapshot?: unknown }> {
  if (!params.want_snapshot) return result;

  try {
    const tagged = (await ref.page.evaluate(
      SNAPSHOT_TAGGER_SCRIPT
    )) as { items: Record<string, unknown>[]; url: string; title: string };

    const filterOpts: SnapshotFilterOpts = {};
    if (params.compact === true) filterOpts.compact = true;
    if (typeof params.limit === 'number') filterOpts.limit = params.limit;

    const filtered = filterSnapshot(
      { items: tagged.items as SnapshotItem[], url: tagged.url, title: tagged.title },
      filterOpts,
    );

    return { ...result, snapshot: { ...tagged, items: filtered, total: tagged.items.length } };
  } catch {
    // Snapshot is best-effort; don't fail the operation
    return result;
  }
}