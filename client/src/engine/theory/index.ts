/**
 * Barrel for the music theory engine. Prefer `theoryEngine` for INTERFACES.md `TheoryEngine`.
 * App and components should import from this module (single façade path); engine internals may
 * still import submodules directly.
 */
export { type TheoryEngine, theoryEngine } from './theoryEngine';
export { getBorrowedChords, type BorrowedChordInfo } from './borrowedChords';
export {
  applyKeyChange,
  applyScaleChange,
  findScaleTypeWithPitchClassSet,
  findTonicsForScaleAndPitchClassSet,
  pitchClassSetForKeyScale,
} from './keyScaleTranspose';
export {
  chordEventFieldsForSecondary,
  chordRootPitchClassFromEvent,
  diatonicChordFieldsFromRootPitchClass,
  getAvailableSecondaryChords,
  getSecondaryChordMidi,
  getSecondaryCycleSequence,
  resolveSecondaryTarget,
} from './secondaryChords';
export {
  baseCloseHarmonyMidi,
  bassMidiPat011,
  pat011MotionScore,
  sortedL1Motion,
  voicingWithVoiceLeading,
} from './voicingEngine';
