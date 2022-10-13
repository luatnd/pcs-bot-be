export function round(n: number, decimal: number): number {
  const p = Math.pow(10, decimal);
  return Math.floor(n * p) / p;
}
