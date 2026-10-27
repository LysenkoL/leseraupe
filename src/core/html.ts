const MAP: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function esc(s: string | number): string {
  return String(s).replace(/[&<>"']/g, (c) => MAP[c]);
}
