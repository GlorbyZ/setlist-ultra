# Setlist Ultra — gig-parity implementation plan

**As of:** working tree on `local/next-iteration` (installed on device; **not tagged**)  
**Last tagged ship:** `v4.0.0` (`1fdda90` on `main`, app version still `4.0.0`)  
**HEAD commit:** `fbbb2f7` — Verdana charts, swipe settle, library manage  
**On the phone since then (uncommitted):** keyed Live pager, chord `onTextLayout` + positioned Views, Section jump, pill Live controls, hamburger with no outline.

Steal Songbook Pro **jobs**, not Settings density. UI canvas: `sbp-vs-ultra-ui` in Cursor. SBP docs: [navigation](https://songbook-pro.com/docs/getting-started/basic-navigation/), [sets](https://songbook-pro.com/docs/getting-started/using-sets/), [song display](https://songbook-pro.com/docs/manual/settings/song-display/), [live buttons](https://songbook-pro.com/docs/manual/live-buttons/).

Do **not** start the next phase until you say go. First PR is still **P0 gig shell**.

---

## Already on the phone (do not rebuild / do not regress)

| Job | Where |
|---|---|
| Catalog tabs Songs / Sets / Live / Settings | `apps/mobile/app/(tabs)/_layout.tsx` |
| UG search in Songs + Add songs | `useUgOnlineSearch.ts`, `UgImportSheet` |
| Last song/set restore when Live focuses | `useLiveQueue.ts` → `appState.currentSongId` / `currentSetlistId` |
| Empty Live only if the library is empty | `live.tsx` |
| Key vs Capo as different jobs; persist on Live | `liveKeyCapo.ts`, `LiveChrome.tsx`; `displayChord` = `keyShift - capo` |
| Chord X from `onTextLayout` of NBSP prefixes; chords in absolute **Views** (never `left` on `Text`) | `ChordLyricLine.tsx` |
| Live gallery swipe keyed by song id; UI-thread settle; neighbors stay mounted | `SwipePager.tsx` |
| New song starts at top; swipe-back one song keeps scroll | same pager + `SongViewer` instance |
| Warm prev/next parse | `songChartCache.ts` |
| Section jump (Verse/Chorus or header lines) | `chartJumpTargets.ts`, `SongViewer` ref, Live **Section** chip |
| Pill Live tools (Section / Live / toolbox); hamburger **no outline** | `LiveChrome.tsx` |
| Setlist overlay **only while a set is active** | `SetlistQuickAccess.tsx`; hamburger gated on `hasSetContext` |
| Songs/Sets bulk delete; clean duplicate songs and sets | `index.tsx`, `sets.tsx`, `settings.tsx` |
| Appearance chips Light / Dark / Stage / System | `settings.tsx` |
| Notes + timers **addable** on a set | `setlist/[id].tsx` |
| Reorder / rename / date / per-item key·capo **in the repository** | `reorderSetlistItems`, `updateSetlist`, `updateSetlistItem` — **no UI callers** |
| Auth + optional Supabase; SBP/ChordPro import | `settings.tsx`, `hosted.ts`, `import.tsx` |

---

## Still the real gaps

1. **Catalog-first shell.** Initial tab is Songs. Live tab bar is always shown. Hamburger exists only in a set. `SongsDrawer` is All / Recents / Favorites / Unfiled — not a song picker, not on Live.
2. **Sets don’t play like SBP.** No drag-reorder / rename / date UI. `useLiveQueue` drops notes and timers. Item `keyOffset` / `overrideCapo` unused in Live.
3. **Stage chrome is still a labeled toolbox.** Pills are bigger, but still Key − / Capo + text, not icon Live Buttons. Zoom is local `useState(18)`, not a pref.
4. **No Look & Stage.** Settings Appearance is four chips.
5. **Editor is a form.** Label still “Key (0 = A)”. No Live preview.
6. **Media.** Scan writes `contentKind: 'image'`; `SongViewer` never shows it.
7. **Wrapped lyrics vs chord X.** Prefix width is the unwrapped line. A chord in the middle of a wrapping lyric still sits on the first visual row. Separate from the old “all stacked at x=0” bug.

---

## P0 — Gig shell

**Goal:** Live is the gig surface. Library and sets come to the chart; the tab bar does not eat the stage.

Last-song restore, keyed swipe, Section, and chord layout are **already done**. Do not rebuild them.

### Work

1. Hide the tab bar on the Live route only. Keep Songs / Sets / Settings for browse.
2. Always show the Live hamburger (not only `hasSetContext`). Keep it outline-free.
3. Grow **`SetlistQuickAccess` into a stage drawer** — do not reuse `SongsDrawer`:
   - Mode strip: **Songs | Sets | Settings**
   - Songs: searchable library → stay on Live
   - Sets: set list + current set songs (today’s overlay)
   - Settings: `router.push('/settings')`
4. Empty Live: pickers inside the drawer **and** the empty-state buttons (tab bar will be gone).

### Files

- `apps/mobile/app/(tabs)/_layout.tsx`
- `apps/mobile/app/(tabs)/live.tsx`
- `apps/mobile/src/components/LiveChrome.tsx`
- `apps/mobile/src/components/SetlistQuickAccess.tsx`
- `apps/mobile/app/song/[id].tsx` (still duplicates Live)

### Done when

- Chart is full-bleed on Live; no bottom tabs.
- Hamburger opens Songs or Sets without leaving Live.
- Songs tab still exists for catalog / UG.
- Section chip, keyed swipe, and chord Views still work.

---

## P1 — Sets that play

Do not reimplement `reorderSetlistItems` / `updateSetlist` / `updateSetlistItem`.

**P1a** — `setlist/[id].tsx`: drag-reorder, rename, event date, per-item key/capo.  
**P1b** — `useLiveQueue` union song | note | timer; note/timer Live pages; apply item key/capo.

---

## P2 — Look & Stage

After P0. `DisplayPrefs` + Settings hub (presets, mini chart, layout scroll first, live-tool checklist). Theme chips stay. No SBP per-section Verse/Chorus style matrix.

---

## P3 — Stage tools + editor + media

Real metronome. Pedal learn UI. Autoscroll duration in Live. Editor sounding key + capo + optional preview. Image/PDF in `SongViewer` or hide scan. Optional: wrap-aware chord X.

---

## P4 — Later

Folders · e-chords / WT · Manager web editor · chord diagrams · Groups · MIDI events · Nashville/German.

Skip: SBP license walls, ads, Settings encyclopedia.

---

## Suggested PR order

1. **P0** hide Live tab bar + always-on stage drawer  
2. **P1a** set reorder/rename/date  
3. **P1b** notes/timers in the Live queue  
4. **P2** DisplayPrefs  
5. **P3** metronome, editor key copy, media; wrap-aware chords if still wrong on device  

---

## First files to touch (P0)

1. `apps/mobile/app/(tabs)/_layout.tsx` — hide tab bar on Live  
2. `apps/mobile/src/components/LiveChrome.tsx` — hamburger always, still no outline  
3. `apps/mobile/src/components/SetlistQuickAccess.tsx` — Songs | Sets | Settings  
4. `apps/mobile/app/(tabs)/live.tsx` — drawer for library + sets, not only `hasSetContext`
