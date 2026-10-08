/** Inline line-art emblems (currentColor) for ages, abilities and the restart button. */
const svg = (body: string) =>
  `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const AGE_EMBLEMS: readonly string[] = [
  // Stone age: hand axe
  svg('<path d="M14 36 34 12"/><path d="M30 8c6 0 10 4 10 10-5 1-9-1-12-4z" fill="currentColor" fill-opacity=".35"/><path d="M12 38l-3 3"/>'),
  // Bronze age: round shield
  svg('<circle cx="24" cy="24" r="15"/><circle cx="24" cy="24" r="5" fill="currentColor" fill-opacity=".35"/><path d="M24 9v6M24 33v6M9 24h6M33 24h6"/>'),
  // Middle ages: castle
  svg('<path d="M8 40V18h6v4h4v-4h4v4h4v-4h4v4h4v-4h6v22z" fill="currentColor" fill-opacity=".25"/><path d="M20 40v-9a4 4 0 0 1 8 0v9"/>'),
  // Gunpowder: cannon
  svg('<path d="M8 28 34 16l4 8-26 12z" fill="currentColor" fill-opacity=".3"/><circle cx="14" cy="36" r="6"/><path d="M40 14l3-4M42 20l4-1"/>'),
  // Modern: skyscraper
  svg('<path d="M14 42V14l10-6 10 6v28z" fill="currentColor" fill-opacity=".25"/><path d="M19 20h2M27 20h2M19 27h2M27 27h2M19 34h2M27 34h2M24 8V3"/>'),
];

export const ABILITY_EMBLEMS: Record<string, string> = {
  // Scout: eye
  scout: svg('<path d="M4 24C10 14 17 10 24 10s14 4 20 14c-6 10-13 14-20 14S10 34 4 24z"/><circle cx="24" cy="24" r="6" fill="currentColor" fill-opacity=".35"/>'),
  // Wall: crenellated rampart
  wall: svg('<path d="M6 40V14h6v5h5v-5h6v5h5v-5h6v5h5v-5h3v26z" fill="currentColor" fill-opacity=".25"/><path d="M6 28h36M18 28v12M30 28v12"/>'),
  // Engineer: pickaxe and shovel
  engineer: svg('<path d="M10 40 34 16"/><path d="M24 10c8-2 14 2 16 8-5-3-10-3-16-2z" fill="currentColor" fill-opacity=".3"/><path d="M38 40 22 24"/>'),
  // Radar: sweep
  radar: svg('<circle cx="24" cy="24" r="16"/><circle cx="24" cy="24" r="8"/><path d="M24 24 38 14"/><circle cx="31" cy="30" r="2" fill="currentColor"/>'),
};

export const RESTART_ICON = svg('<path d="M38 24a14 14 0 1 1-4.1-9.9"/><path d="M38 8v8h-8"/>');
export const LAUREL = svg('<path d="M24 40C12 36 8 26 10 14M24 40c12-4 16-14 14-26"/><path d="M10 14c4 0 6 3 6 6M13 22c4 0 6 3 6 6M38 14c-4 0-6 3-6 6M35 22c-4 0-6 3-6 6"/>');
