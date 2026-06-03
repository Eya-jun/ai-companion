// Vélin · 尺素 — Character theme palette
// Maps character names to the data-theme attribute used by CSS variables.
// 'user' is the only theme that is not a character — it's the human's avatar.

export type ThemeKey = 'a' | 'b' | 'c' | 'd' | 'user';

export const CHARACTER_THEMES: Record<string, ThemeKey> = {
  '林默': 'a',     // forest green
  '顾夜寒': 'b',   // ice blue
  '玄清': 'c',     // deep purple
  '空白角色': 'd', // warm cream
  '苏晚': 'd',     // warm cream (示例)
};

export const USER_THEME: ThemeKey = 'user';

export function themeFor(name: string): ThemeKey {
  return CHARACTER_THEMES[name] ?? 'd';
}
