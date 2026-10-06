import { slugify } from './slug.util';

describe('slugify', () => {
  it('lowercases and replaces spaces/symbols with dashes', () => {
    expect(slugify('PT Kerjain Dong!')).toBe('pt-kerjain-dong');
  });

  it('strips diacritics', () => {
    expect(slugify('Café Déjà Vu')).toBe('cafe-deja-vu');
  });

  it('trims leading and trailing dashes', () => {
    expect(slugify('  --Hello--  ')).toBe('hello');
  });

  it('deduplicates consecutive non-alphanumeric characters', () => {
    expect(slugify('a@@b')).toBe('a-b');
  });

  it('returns an empty string when nothing usable is left', () => {
    expect(slugify('!!!')).toBe('');
  });

  it('truncates to maxLength', () => {
    expect(slugify('abcdef', 3)).toBe('abc');
  });
});
