# ARCHITECT STATE — vYbpad

> Periodically updated cache of the Architect's current state. Review on session resume.

**Last updated:** 2026-04-12 00:45 AM

---

## Current Phase

**Phase 2 (Write Canonical Documents) — COMPLETE.**

All four canonical documents have been written and are ready for the team:
- `ARCHITECTURE.md` — stack decisions, data model, auth, infrastructure, constraints, testing strategy
- `INTERFACES.md` — all API endpoints, database schema, song data model (TypeScript), component props, store shapes, engine interfaces
- `ROADMAP.md` — 9-phase build plan with dependency graph, parallelism map, task-level breakdown
- `PATTERNS.md` — 17 pre-authorized patterns covering error handling, naming, ticks, colors, voicing, git workflow, and more

## Next Actions

1. **Initialize git repo** with `.gitignore` and commit canonical docs
2. **Hand off to the PM** to begin task assignment per ROADMAP.md Phase 0
3. **Designer** should produce `UX_GUIDELINES.md` (Phase 0, task 0.7) — this runs in parallel with scaffolding
4. **Remain available for escalations** as the build begins

## Key Decisions Made

| Decision | Rationale |
|---|---|
| Scale-degree-first data model | Matches Hookpad's core design; enables free transposition |
| 48 TPQN timing | Clean division for all note values including triplets; scales to 480 PPQN for MIDI |
| Canvas for editor, React for chrome | Performance for dense grid + real-time cursor; React for everything else |
| Tone.js + smplr for audio | Transport scheduling + SoundFont piano samples; avoid building audio from scratch |
| `tonal` for music theory | TypeScript, active, Roman numerals, keys, modes — exactly what we need |
| MIDI Type 1 for StudioOne export | No programmatic chord track API in S1; text events carry chord names |
| JWT auth (access + refresh) | Stateless, standard, supports the "robust auth framework" requirement |
| PostgreSQL + JSONB for songs | Relational for users/auth; document storage for complex hierarchical song data |
| Zustand + Immer for state | Lightweight, immutable updates, undo/redo via patches or snapshots |

## Open Questions

1. **StudioOne chord track auto-population** — needs validation during Phase 6. If MIDI text events don't populate S1's Chord Track, we may need to encode chords as note data. Flag to HITL if this fails.
2. **Piano sample quality** — `smplr` SoundFont may not match Hookpad's piano quality. May need to evaluate alternative sample sets during Phase 4.
3. **Drum track** — out of scope per requirements exception, but the data model supports it. PM should confirm with HITL if any drum capability is expected.

## Research Summary

Three research briefs were completed:
1. **Hookpad features/UI** — comprehensive feature list from official User Guide v2.1.0, keyboard shortcuts, playback architecture
2. **Tech stack** — compared Tone.js/Howler/Web Audio, tonal/teoria, canvas approaches, MidiWriterJS, Studio One MIDI
3. **Hookpad internals** — React 17 + Ionic SPA, clipboard JSON uses `sd`/`beat`/`duration` fields, no full schema published, HoLST project provides partial reverse-engineering
