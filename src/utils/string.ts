export function centerEllipsis(s: string, left: number, right: number) {
  if (!s) {
    return '';
  }

  const l = s.length;
  if (l <= left) {
    return s;
  }

  return s.substring(0, left) + '...' + s.substring(Math.max(l - right, left + 3));
}
