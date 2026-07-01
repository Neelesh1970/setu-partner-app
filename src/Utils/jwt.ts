export function getUserIdFromJwt(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) {
      return null;
    }
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const atobFn = (globalThis as { atob?: (data: string) => string }).atob;
    if (!atobFn) {
      return null;
    }
    const payload = JSON.parse(atobFn(padded)) as Record<string, unknown>;
    const id =
      payload.user_id ??
      payload.userId ??
      payload.sub ??
      payload.id;
    return typeof id === 'string' || typeof id === 'number' ? String(id) : null;
  } catch {
    return null;
  }
}
