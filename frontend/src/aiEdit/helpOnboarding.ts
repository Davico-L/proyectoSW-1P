/**
 * Utilidades para persistir si el usuario ya vio la ayuda inicial (onboarding).
 */

const getKey = (username: string): string =>
  `help_onboarding_seen_${username.trim().toLowerCase()}`;

export function hasSeenHelpOnboarding(username: string): boolean {
  const normalized = username?.trim();
  if (!normalized) {
    return true;
  }

  try {
    const value = localStorage.getItem(getKey(normalized));
    return value === "true" || value === "1";
  } catch {
    // Si falla el acceso al almacenamiento local, devuelve true para no molestar
    return true;
  }
}

export function markHelpOnboardingSeen(username: string): void {
  const normalized = username?.trim();
  if (!normalized) {
    return;
  }

  try {
    localStorage.setItem(getKey(normalized), "true");
  } catch {
    // Ignorar fallos de almacenamiento
  }
}
