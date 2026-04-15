/**
 * TASK-7.4 — async Clipboard API (INTERFACES transport notes).
 * Swallows permission / secure-context failures without surfacing to the user.
 */

export async function writePlainTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export async function readPlainTextFromClipboard(): Promise<string | null> {
  try {
    return await navigator.clipboard.readText();
  } catch {
    return null;
  }
}
