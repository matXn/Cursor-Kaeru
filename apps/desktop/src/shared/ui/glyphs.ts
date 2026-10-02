import type { IconifyIcon } from "@iconify/react";

// Cursor Kaeru's own line glyphs: 24px grid, 1.75 stroke, round caps and joins to match
// the Outfit titles. Monochrome via currentColor; rendered through <Icon>.
const glyph = (body: string): IconifyIcon => ({
  body: `<g fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${body}</g>`,
  width: 24,
  height: 24,
});

// ---- Pages ------------------------------------------------------
// A tiny activity wall: three quiet cells, one lit.
export const overviewGlyph = glyph('<rect x="4" y="4" width="6.5" height="6.5" rx="2"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="2"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="2"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="2" fill="currentColor"/>');
// Roadmap lanes, the newest call still running.
export const callsGlyph = glyph('<path d="M4 7h8M9 12h11M6 17h7"/><circle cx="16" cy="7" r="1.6" fill="currentColor" stroke="none"/>');
export const modelsGlyph = glyph('<path d="M12 3.5l7.5 4.25v8.5L12 20.5l-7.5-4.25v-8.5z"/><path d="M4.5 7.75L12 12l7.5-4.25M12 12v8.5"/>');
export const pluginsGlyph = glyph('<path d="M9 3.5v4M15 3.5v4"/><path d="M6.5 7.5h11v3a5.5 5.5 0 0 1-11 0z"/><path d="M12 16v4.5"/>');
export const settingsGlyph = glyph('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>');

// ---- Overview gauges --------------------------------------------
export const activeDaysGlyph = glyph('<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 9.5h16M8.5 3.5v3M15.5 3.5v3M9 14.5l2 2 4-4"/>');
export const peakGlyph = glyph('<path d="M3.5 19.5l6-10 3.5 5.5 2.5-3.5 5 8z"/><path d="M9.5 9.5v-5l3 1.5-3 1.5"/>');
export const callCountGlyph = glyph('<path d="M7 19.5v-15M4 7.5l3-3 3 3M17 4.5v15M14 16.5l3 3 3-3"/>');
export const tokensGlyph = glyph('<path d="M12 4l8 4-8 4-8-4z"/><path d="M4 12l8 4 8-4M4 16l8 4 8-4"/>');
export const rangeGlyph = glyph('<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 9.5h16M8.5 3.5v3M15.5 3.5v3M8 14h8"/>');

