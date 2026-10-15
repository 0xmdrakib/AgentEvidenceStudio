export function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
export async function readJsonFile(
  file: File,
  maximumBytes = 20_000_000,
): Promise<unknown> {
  if (file.size > maximumBytes)
    throw new Error(
      'The selected file exceeds the import size limit. Account bundles must be 512 KB or smaller.',
    );
  try {
    return JSON.parse(await file.text());
  } catch {
    throw new Error(
      'The selected file is not valid JSON. Choose an encrypted .aesrun bundle.',
    );
  }
}
