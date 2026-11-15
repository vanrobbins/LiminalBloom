// What a person pastes on /welcome to accept an invitation: the whole link they were
// sent (any host, the path is /invite/<id>) or just the id. This only finds the id; the
// accept flow at /invite/<id> is what decides whether it works. The id is also the
// secret (spec 0.7, 4.9), so nothing here logs or lists it. The character set and the
// length cap are the invitation page's: ids are base64url or a UUID, and the page
// treats anything longer than 200 as not an invitation.

const ID = /^[A-Za-z0-9_-]{1,200}$/;
const INVITE_PATH = /^\/invite\/([A-Za-z0-9_-]{1,200})\/?$/;

/** The invitation id in `pasted` (a link, a path or a bare id), or null when it isn't one. */
export function parseInviteLink(pasted: string): string | null {
  const text = pasted.trim();
  if (ID.test(text)) return text;
  // A link copied without its "https://" still works; a path alone does too.
  const address = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : text.startsWith("/") ? `https://placeholder.invalid${text}` : `https://${text}`;
  let url: URL;
  try {
    url = new URL(address);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  return INVITE_PATH.exec(url.pathname)?.[1] ?? null;
}
