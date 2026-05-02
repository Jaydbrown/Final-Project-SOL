export const PROFILE_AVATAR_STORAGE_PREFIX = "localdao_profile_avatar_v1:";

/** Fired on this tab after upload/remove — detail: `{ wallet: string }` lowercased. */
export const PROFILE_AVATAR_CHANGED_EVENT = "localdao:profile-avatar-changed";

export function profileAvatarStorageKey(walletAddress: string): string {
  return `${PROFILE_AVATAR_STORAGE_PREFIX}${walletAddress.trim().toLowerCase()}`;
}

export function getStoredProfileAvatarUrl(walletAddress: string): string | null {
  if (typeof window === "undefined" || !walletAddress.trim()) return null;
  try {
    const v = localStorage.getItem(profileAvatarStorageKey(walletAddress))?.trim();
    return v || null;
  } catch {
    return null;
  }
}

export function setStoredProfileAvatarUrl(walletAddress: string, url: string): void {
  if (typeof window === "undefined" || !walletAddress.trim()) return;
  try {
    localStorage.setItem(profileAvatarStorageKey(walletAddress), url.trim());
    window.dispatchEvent(
      new CustomEvent(PROFILE_AVATAR_CHANGED_EVENT, {
        detail: { wallet: walletAddress.trim().toLowerCase() },
      }),
    );
  } catch {
    /* quota / private mode */
  }
}

export function clearStoredProfileAvatarUrl(walletAddress: string): void {
  if (typeof window === "undefined" || !walletAddress.trim()) return;
  try {
    localStorage.removeItem(profileAvatarStorageKey(walletAddress));
    window.dispatchEvent(
      new CustomEvent(PROFILE_AVATAR_CHANGED_EVENT, {
        detail: { wallet: walletAddress.trim().toLowerCase() },
      }),
    );
  } catch {
    /* */
  }
}
