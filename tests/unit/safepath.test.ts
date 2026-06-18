import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { validateWritePath, validateReadPath } from '../../src/utils/safepath.js';

describe('validateWritePath', () => {
  describe('blocks sensitive system directories', () => {
    it('blocks /etc/passwd', () => {
      expect(() => validateWritePath('/etc/passwd')).toThrow(/Refusing to write.*sensitive/);
    });

    it('blocks /etc/shadow', () => {
      expect(() => validateWritePath('/etc/shadow')).toThrow(/Refusing to write.*sensitive/);
    });

    it('blocks /etc directly', () => {
      expect(() => validateWritePath('/etc')).toThrow(/Refusing to write.*sensitive/);
    });

    it('blocks nested paths under /etc', () => {
      expect(() => validateWritePath('/etc/nginx/nginx.conf')).toThrow(/Refusing to write.*sensitive/);
    });

    it('blocks /proc paths', () => {
      expect(() => validateWritePath('/proc/1/cmdline')).toThrow(/Refusing to write.*sensitive/);
    });

    it('blocks /sys paths', () => {
      expect(() => validateWritePath('/sys/class/net')).toThrow(/Refusing to write.*sensitive/);
    });

    it('blocks /dev paths', () => {
      expect(() => validateWritePath('/dev/null')).toThrow(/Refusing to write.*sensitive/);
    });

    it('blocks /boot paths', () => {
      expect(() => validateWritePath('/boot/vmlinuz')).toThrow(/Refusing to write.*sensitive/);
    });

    it('blocks /sbin paths', () => {
      expect(() => validateWritePath('/sbin/init')).toThrow(/Refusing to write.*sensitive/);
    });

    it('blocks /usr/sbin paths', () => {
      expect(() => validateWritePath('/usr/sbin/sshd')).toThrow(/Refusing to write.*sensitive/);
    });
  });

  describe('blocks sensitive home directories', () => {
    const originalHome = process.env.HOME;

    beforeEach(() => {
      process.env.HOME = '/home/testuser';
    });

    it('blocks ~/.ssh/authorized_keys', () => {
      expect(() => validateWritePath('/home/testuser/.ssh/authorized_keys')).toThrow(/Refusing to write.*sensitive home/);
    });

    it('blocks ~/.ssh directly', () => {
      expect(() => validateWritePath('/home/testuser/.ssh')).toThrow(/Refusing to write.*sensitive home/);
    });

    it('blocks ~/.gnupg', () => {
      expect(() => validateWritePath('/home/testuser/.gnupg/private-keys-v1.d/key.asc')).toThrow(/Refusing to write.*sensitive home/);
    });

    it('blocks ~/.config/systemd', () => {
      expect(() => validateWritePath('/home/testuser/.config/systemd/user/test.service')).toThrow(/Refusing to write.*sensitive home/);
    });

    // Restore original HOME
    afterEach(() => {
      if (originalHome !== undefined) process.env.HOME = originalHome;
    });
  });

  describe('allows safe paths', () => {
    it('allows /tmp/screenshot.png', () => {
      const result = validateWritePath('/tmp/screenshot.png');
      expect(result).toBe('/tmp/screenshot.png');
    });

    it('allows relative paths (resolves to absolute)', () => {
      const result = validateWritePath('output.png');
      expect(result).toContain('/output.png');
      // Should be an absolute path
      expect(result.startsWith('/')).toBe(true);
    });

    it('allows home directory non-sensitive paths', () => {
      const home = process.env.HOME;
      if (home) {
        const result = validateWritePath(`${home}/Downloads/test.pdf`);
        expect(result).toBe(`${home}/Downloads/test.pdf`);
      }
    });

    it('normalizes path traversal attempts', () => {
      // /tmp/../etc/passwd should resolve to /etc/passwd and be blocked
      expect(() => validateWritePath('/tmp/../etc/passwd')).toThrow(/Refusing to write.*sensitive/);
    });

    it('normalizes double slashes', () => {
      expect(() => validateWritePath('/etc//passwd')).toThrow(/Refusing to write.*sensitive/);
    });
  });

  describe('returns resolved absolute path', () => {
    it('returns absolute path for absolute input', () => {
      const result = validateWritePath('/tmp/test.bin');
      expect(result).toBe('/tmp/test.bin');
    });
  });
});

describe('validateReadPath', () => {
  describe('blocks sensitive system directories', () => {
    it('blocks /proc paths', () => {
      expect(() => validateReadPath('/proc/self/environ')).toThrow(/Refusing to read.*system/);
    });

    it('blocks /sys paths', () => {
      expect(() => validateReadPath('/sys/kernel/version')).toThrow(/Refusing to read.*system/);
    });

    it('blocks /dev paths', () => {
      expect(() => validateReadPath('/dev/random')).toThrow(/Refusing to read.*system/);
    });
  });

  describe('blocks sensitive home directories', () => {
    const originalHome = process.env.HOME;

    beforeEach(() => {
      process.env.HOME = '/home/testuser';
    });

    it('blocks ~/.ssh/id_rsa', () => {
      expect(() => validateReadPath('/home/testuser/.ssh/id_rsa')).toThrow(/Refusing to read.*sensitive home/);
    });

    it('blocks ~/.gnupg/private-keys', () => {
      expect(() => validateReadPath('/home/testuser/.gnupg/private-keys-v1.d/key')).toThrow(/Refusing to read.*sensitive home/);
    });

    afterEach(() => {
      if (originalHome !== undefined) process.env.HOME = originalHome;
    });
  });

  describe('allows safe read paths', () => {
    it('allows /tmp/script.js', () => {
      const result = validateReadPath('/tmp/script.js');
      expect(result).toBe('/tmp/script.js');
    });

    it('allows /etc/hosts (not blocked for reads)', () => {
      // /etc is NOT blocked for reads (only /proc, /sys, /dev are blocked)
      const result = validateReadPath('/etc/hosts');
      expect(result).toBe('/etc/hosts');
    });

    it('normalizes traversal: /tmp/../proc/1/cmdline is blocked', () => {
      expect(() => validateReadPath('/tmp/../proc/1/cmdline')).toThrow(/Refusing to read.*system/);
    });
  });

  describe('returns resolved absolute path', () => {
    it('returns absolute path', () => {
      const result = validateReadPath('/home/user/script.js');
      expect(result).toBe('/home/user/script.js');
    });
  });
});
