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
// Tab completion: the typed letter, then the suggestion still in ghost ink.
export const tabCompletionGlyph: IconifyIcon = {
  body: '<text x="0" y="12" fill="currentColor" font-size="17" font-weight="700" style="font-family:inherit">a</text><text x="10" y="12" fill="currentColor" fill-opacity=".38" font-size="17" font-weight="700" style="font-family:inherit">bc</text>',
  width: 28,
  height: 13,
};
export const settingsGlyph = glyph('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>');

// ---- Overview gauges --------------------------------------------
export const activeDaysGlyph = glyph('<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 9.5h16M8.5 3.5v3M15.5 3.5v3M9 14.5l2 2 4-4"/>');
// A speech bubble with two lines of talk.
export const conversationsGlyph = glyph('<path d="M5.5 5h13a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H11l-4.5 3.5V17h-1a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/><path d="M8 9.5h8M8 12.5h5"/>');
// The models cube with a spark on its corner.
export const favoriteModelGlyph = glyph('<path d="M11 4.5l6.5 3.75v7.5L11 19.5l-6.5-3.75v-7.5z"/><path d="M4.5 8.25L11 12l6.5-3.75M11 12v7.5"/><path d="M19.5 2.5v4M17.5 4.5h4"/>');
// A clock face, hands near four.
export const peakHourGlyph = glyph('<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2.5"/>');
// ---- Actions ----------------------------------------------------
// Three dots in a row: more actions.
export const moreGlyph = glyph('<circle cx="5.5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.4" fill="currentColor" stroke="none"/>');
export const rangeGlyph = glyph('<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 9.5h16M8.5 3.5v3M15.5 3.5v3M8 14h8"/>');

