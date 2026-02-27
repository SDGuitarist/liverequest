/** Progressive-enhancement haptic feedback — silently ignored on iOS */

export function hapticSuccess() {
  if ("vibrate" in navigator) navigator.vibrate(50);
}

export function hapticError() {
  if ("vibrate" in navigator) navigator.vibrate([50, 100, 50]);
}

export function hapticDismiss() {
  if ("vibrate" in navigator) navigator.vibrate(80);
}
