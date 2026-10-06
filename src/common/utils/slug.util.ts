/**
 * Ubah teks bebas menjadi slug URL-friendly:
 * huruf kecil, tanpa diakritik, hanya [a-z0-9-].
 */
export function slugify(input: string, maxLength = 200): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength);
}
