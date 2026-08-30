export function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 0);
}
export async function readJsonFile(file: File): Promise<unknown> { if (file.size > 20_000_000) throw new Error('Bundle is larger than the 20 MB import limit.'); return JSON.parse(await file.text()); }
