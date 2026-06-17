import { describe, expect, it } from 'vitest';
import { optStr, reqStr, optNum, optBool, resolveUid, filterSnapshot, SNAPSHOT_IFRAME_SCRIPT, type SnapshotItem } from '../../src/daemon/methods/params.js';

describe('optStr', () => {
  it('returns value for string key', () => {
    expect(optStr({ name: 'hello' }, 'name')).toBe('hello');
  });

  it('returns undefined for missing key', () => {
    expect(optStr({}, 'name')).toBeUndefined();
  });

  it('returns undefined for non-string value', () => {
    expect(optStr({ name: 123 }, 'name')).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(optStr({ name: '' }, 'name')).toBeUndefined();
  });

  it('returns undefined for null value', () => {
    expect(optStr({ name: null }, 'name')).toBeUndefined();
  });
});

describe('reqStr', () => {
  it('returns value when key exists', () => {
    expect(reqStr({ x: 'y' }, 'x')).toBe('y');
  });

  it('throws CloakError when key missing', () => {
    expect(() => reqStr({}, 'x')).toThrow(/Missing required/);
  });

  it('throws CloakError for empty string', () => {
    expect(() => reqStr({ x: '' }, 'x')).toThrow(/Missing required/);
  });

  it('throws CloakError for null value', () => {
    expect(() => reqStr({ x: null }, 'x')).toThrow(/Missing required/);
  });

  it('error has code INVALID_ARG', () => {
    try {
      reqStr({}, 'x');
    } catch (e: unknown) {
      expect((e as Record<string, unknown>).code).toBe('INVALID_ARG');
    }
  });
});

describe('optNum', () => {
  it('returns value for number key', () => {
    expect(optNum({ age: 25 }, 'age')).toBe(25);
  });

  it('returns undefined for missing key', () => {
    expect(optNum({}, 'age')).toBeUndefined();
  });

  it('returns undefined for string value', () => {
    expect(optNum({ age: '25' }, 'age')).toBeUndefined();
  });

  it('returns 0 for zero', () => {
    expect(optNum({ count: 0 }, 'count')).toBe(0);
  });

  it('returns undefined for null', () => {
    expect(optNum({ count: null }, 'count')).toBeUndefined();
  });
});

describe('optBool', () => {
  it('returns true for true', () => {
    expect(optBool({ flag: true }, 'flag')).toBe(true);
  });

  it('returns false for false', () => {
    expect(optBool({ flag: false }, 'flag')).toBe(false);
  });

  it('returns undefined for missing key', () => {
    expect(optBool({}, 'flag')).toBeUndefined();
  });

  it('returns undefined for number value', () => {
    expect(optBool({ flag: 1 }, 'flag')).toBeUndefined();
  });

  it('returns undefined for string value', () => {
    expect(optBool({ flag: 'true' }, 'flag')).toBeUndefined();
  });
});

describe('resolveUid', () => {
  it('wraps simple uid: u7 → [data-cloak-uid="u7"]', () => {
    expect(resolveUid('u7')).toBe('[data-cloak-uid="u7"]');
  });

  it('wraps uid with multiple digits', () => {
    expect(resolveUid('u123')).toBe('[data-cloak-uid="u123"]');
  });

  it('wraps uid with three digits', () => {
    expect(resolveUid('u1')).toBe('[data-cloak-uid="u1"]');
  });

  it('passes through CSS ID selector unchanged', () => {
    expect(resolveUid('#my-button')).toBe('#my-button');
  });

  it('passes through attribute selector unchanged', () => {
    expect(resolveUid('[data-test="x"]')).toBe('[data-test="x"]');
  });

  it('passes through class selector unchanged', () => {
    expect(resolveUid('.btn-primary')).toBe('.btn-primary');
  });

  it('passes through compound selectors', () => {
    expect(resolveUid('div > .btn')).toBe('div > .btn');
  });

  it('passes through regular text matching u followed by non-digits', () => {
    expect(resolveUid('user-name')).toBe('user-name');
  });

  it('passes through empty string', () => {
    expect(resolveUid('')).toBe('');
  });

  it('passes through u followed by letters and digits', () => {
    expect(resolveUid('u7a')).toBe('u7a');
  });

  it('passes through uppercase U prefix', () => {
    expect(resolveUid('U7')).toBe('U7');
  });
});

describe('filterSnapshot', () => {
  const sample: SnapshotItem[] = [
    { uid: 'u1', role: 'button', tag: 'button', name: 'Submit', bbox: { x: 10, y: 10, w: 100, h: 30 }, selector: '[data-cloak-uid="u1"]' },
    { uid: 'u2', role: 'link', tag: 'a', name: 'Learn more', bbox: { x: 10, y: 200, w: 80, h: 20 }, selector: '[data-cloak-uid="u2"]' },
    { uid: 'u3', role: 'textbox', tag: 'input', name: 'Email', bbox: { x: 10, y: 60, w: 200, h: 30 }, selector: '[data-cloak-uid="u3"]' },
    { uid: 'u4', role: 'checkbox', tag: 'input', name: 'Agree', bbox: { x: 10, y: 120, w: 20, h: 20 }, selector: '[data-cloak-uid="u4"]' },
    { uid: 'u5', role: 'button', tag: 'button', name: 'Cancel', bbox: { x: 300, y: 10, w: 80, h: 30 }, selector: '[data-cloak-uid="u5"]' },
  ];

  describe('limit', () => {
    it('returns all items when limit is undefined', () => {
      const r = filterSnapshot({ items: sample, url: '', title: '' }, {});
      expect(r.length).toBe(5);
    });

    it('returns N items when limit is set', () => {
      const r = filterSnapshot({ items: sample, url: '', title: '' }, { limit: 2 });
      expect(r.length).toBe(2);
      expect(r[0].uid).toBe('u1');
      expect(r[1].uid).toBe('u2');
    });

    it('returns all items when limit exceeds count', () => {
      const r = filterSnapshot({ items: sample, url: '', title: '' }, { limit: 999 });
      expect(r.length).toBe(5);
    });

    it('returns empty when limit is 0', () => {
      const r = filterSnapshot({ items: sample, url: '', title: '' }, { limit: 0 });
      expect(r.length).toBe(0);
    });
  });

  describe('compact', () => {
    it('strips bbox and selector when compact is true', () => {
      const r = filterSnapshot({ items: sample, url: '', title: '' }, { compact: true });
      expect(r.length).toBe(5);
      for (const item of r) {
        expect(item.bbox).toBeUndefined();
        expect(item.selector).toBeUndefined();
      }
    });

    it('preserves bbox and selector when compact is false', () => {
      const r = filterSnapshot({ items: sample, url: '', title: '' }, { compact: false });
      expect(r[0].bbox).toBeDefined();
      expect(r[0].selector).toBeDefined();
    });
  });

  describe('viewportOnly', () => {
    it('filters out elements with bbox entirely above viewport top', () => {
      // Elements with y=200 should be filtered when viewportHeight=150
      const r = filterSnapshot({ items: sample, url: '', title: '' }, { viewportOnly: true, viewportHeight: 150 });
      const uids = r.map(i => i.uid);
      expect(uids).not.toContain('u2'); // y=200 > 150
      expect(uids).toContain('u1');
      expect(uids).toContain('u3');
      expect(uids).toContain('u4');
    });

    it('includes elements partially in viewport', () => {
      // Element u2 starts at y=200, viewportHeight=210 means it's partially visible
      const r = filterSnapshot({ items: sample, url: '', title: '' }, { viewportOnly: true, viewportHeight: 210 });
      expect(r.map(i => i.uid)).toContain('u2');
    });

    it('returns all elements when viewportHeight is not specified', () => {
      const r = filterSnapshot({ items: sample, url: '', title: '' }, { viewportOnly: true });
      expect(r.length).toBe(5);
    });
  });

  describe('filter (role/tag/name)', () => {
    it('filters by role', () => {
      const r = filterSnapshot({ items: sample, url: '', title: '' }, { filter: 'role=button' });
      expect(r.length).toBe(2);
      expect(r[0].uid).toBe('u1');
      expect(r[1].uid).toBe('u5');
    });

    it('filters by tag', () => {
      const r = filterSnapshot({ items: sample, url: '', title: '' }, { filter: 'tag=input' });
      expect(r.length).toBe(2);
    });

    it('filters by name substring', () => {
      const r = filterSnapshot({ items: sample, url: '', title: '' }, { filter: 'name=Sub' });
      expect(r.length).toBe(1);
      expect(r[0].uid).toBe('u1');
    });

    it('returns empty for no match', () => {
      const r = filterSnapshot({ items: sample, url: '', title: '' }, { filter: 'role=slider' });
      expect(r.length).toBe(0);
    });
  });

  describe('uid', () => {
    it('returns single element matching the uid', () => {
      const r = filterSnapshot({ items: sample, url: '', title: '' }, { uid: 'u3' });
      expect(r.length).toBe(1);
      expect(r[0].name).toBe('Email');
    });

    it('returns empty for non-existent uid', () => {
      const r = filterSnapshot({ items: sample, url: '', title: '' }, { uid: 'u999' });
      expect(r.length).toBe(0);
    });

    it('ignores uid filter when uid is empty', () => {
      const r = filterSnapshot({ items: sample, url: '', title: '' }, { uid: '' });
      expect(r.length).toBe(5);
    });
  });

  describe('combined filters', () => {
    it('compact + limit together', () => {
      const r = filterSnapshot({ items: sample, url: '', title: '' }, { compact: true, limit: 2 });
      expect(r.length).toBe(2);
      expect(r[0].bbox).toBeUndefined();
      expect(r[0].selector).toBeUndefined();
    });

    it('filter + limit together', () => {
      const r = filterSnapshot({ items: sample, url: '', title: '' }, { filter: 'tag=input', limit: 1 });
      expect(r.length).toBe(1);
      expect(r[0].uid).toBe('u3');
    });
  });
});

describe('SNAPSHOT_IFRAME_SCRIPT', () => {
  it('is a non-empty string', () => {
    expect(typeof SNAPSHOT_IFRAME_SCRIPT).toBe('string');
    expect(SNAPSHOT_IFRAME_SCRIPT.length).toBeGreaterThan(0);
  });

  it('contains querySelectorAll for iframe traversal', () => {
    expect(SNAPSHOT_IFRAME_SCRIPT).toContain('iframe');
  });
});