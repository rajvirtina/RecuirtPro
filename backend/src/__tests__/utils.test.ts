import { clampPagination } from '../../utils/response';
import { encrypt, decrypt } from '../../utils/encryption';

describe('clampPagination', () => {
  it('returns defaults for NaN inputs', () => {
    const { pageNum, limitNum } = clampPagination('abc', 'xyz');
    expect(pageNum).toBe(1);
    expect(limitNum).toBe(10);
  });

  it('clamps negative page to 1', () => {
    const { pageNum } = clampPagination('-5', '10');
    expect(pageNum).toBe(1);
  });

  it('clamps page=0 to 1', () => {
    const { pageNum } = clampPagination('0', '10');
    expect(pageNum).toBe(1);
  });

  it('clamps limit above 100 to 100', () => {
    const { limitNum } = clampPagination('1', '999999');
    expect(limitNum).toBe(100);
  });

  it('clamps limit below 1 to 10', () => {
    const { limitNum } = clampPagination('1', '-1');
    expect(limitNum).toBe(10);
  });

  it('passes through valid values unchanged', () => {
    const { pageNum, limitNum } = clampPagination('3', '25');
    expect(pageNum).toBe(3);
    expect(limitNum).toBe(25);
  });
});

describe('encrypt / decrypt', () => {
  it('round-trips a simple string', () => {
    const original = 'my-oauth-access-token-abc123';
    const encrypted = encrypt(original);
    expect(encrypted).not.toBe(original);
    expect(encrypted).toContain(':');
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(original);
  });

  it('produces different ciphertext for same input (random IV)', () => {
    const text = 'same-value';
    const a = encrypt(text);
    const b = encrypt(text);
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe(text);
    expect(decrypt(b)).toBe(text);
  });

  it('throws on tampered ciphertext', () => {
    const encrypted = encrypt('test-value');
    const parts = encrypted.split(':');
    parts[1] = 'AAAA' + parts[1].slice(4); // Corrupt ciphertext
    expect(() => decrypt(parts.join(':'))).toThrow();
  });

  it('throws on invalid format', () => {
    expect(() => decrypt('not-valid-format')).toThrow('Invalid encrypted data format');
  });
});
