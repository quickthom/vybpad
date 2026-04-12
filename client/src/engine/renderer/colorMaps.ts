import type { ScaleDegree } from '@vybpad/shared';

/**
 * PAT-010 Diatonic-centric: scale degrees I–VII in the current mode (Hookpad-style rows).
 * Index `degree - 1` maps degree 1–7 → hex.
 */
export const PAT010_DIATONIC_DEGREE_HEX: readonly string[] = [
  '#E74C3C', // I
  '#E67E22', // II
  '#F1C40F', // III
  '#2ECC71', // IV
  '#1ABC9C', // V
  '#3498DB', // VI
  '#9B59B6', // VII
];

/**
 * PAT-010 Major-centric: **chromatic position 0–11** = semitone offset from the **major-key reference tonic**
 * (relative major in minor / harmonic minor; parallel Ionian otherwise — see `referenceMajorTonicPitchClass` in noteBlocks
 * and `ionianTonicPcForMajorCentric` in chordBlocks).
 *
 * Indices 0, 2, 4, 5, 7, 9, 11 are the seven PAT-010 diatonic hues (I–VII). Indices 1, 3, 6, 8, 10 are **chromatic**
 * tones (non-major-scale PCs); each is a 50% RGB blend between the two neighboring diatonic PAT-010 colors so
 * non-diatonic roots still read as “between” the same functional colors (PAT-010 non-diatonic guidance).
 */
export const PAT010_MAJOR_CENTRIC_RELATIVE_SEMITONE_HEX: readonly string[] = [
  '#E74C3C', // 0 — I
  '#E7652F', // 1 — between I & II
  '#E67E22', // 2 — II
  '#ECA119', // 3 — between II & III
  '#F1C40F', // 4 — III
  '#2ECC71', // 5 — IV
  '#24C486', // 6 — between IV & V
  '#1ABC9C', // 7 — V
  '#27AABB', // 8 — between V & VI
  '#3498DB', // 9 — VI
  '#6879C8', // 10 — between VI & VII
  '#9B59B6', // 11 — VII
];

export function pat010DiatonicHex(degree: ScaleDegree): string {
  return PAT010_DIATONIC_DEGREE_HEX[degree - 1] ?? PAT010_DIATONIC_DEGREE_HEX[0];
}

/** `relativeSemitone` is taken mod 12 (pitch class offset from major reference tonic). */
export function pat010MajorCentricHex(relativeSemitone: number): string {
  const i = ((relativeSemitone % 12) + 12) % 12;
  return PAT010_MAJOR_CENTRIC_RELATIVE_SEMITONE_HEX[i] ?? PAT010_DIATONIC_DEGREE_HEX[0];
}
