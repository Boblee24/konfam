/**
 * A scanned receipt QR is a URL `<any origin>/r#<payload>`. The payload is self-contained and verified
 * client-side, so we keep ONLY the fragment and open it on THIS app's /r page. A QR can never send the
 * customer to another site. Returns "/r#…" or null.
 */
export function receiptPathFromScan(raw: string, origin: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim(), origin);
  } catch {
    return null;
  }
  if (url.pathname !== "/r" || !/^#[A-Za-z0-9_-]{16,}$/.test(url.hash)) return null;
  return `/r${url.hash}`;
}
