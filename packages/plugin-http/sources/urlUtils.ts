export const TARBALL_REGEXP = /^\/([^/?#](?:\.tar\.gz|\.tgz)|[^/?#])$/;

export const PROTOCOL_REGEXP = /^https?:/;

export function isTgzUrl(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== `http:` && parsed.protocol !== `https:`)
    return false;

  if (!parsed.pathname.match(/(\.tar\.gz|\.tgz|\/[^.]+)$/))
    return false;

  return true;
}
