/**
 * Barrel for the music theory engine. Prefer `theoryEngine` when you need the full
 * INTERFACES.md contract; submodules (`scales`, `chords`, …) remain available for targeted imports.
 */
export { type TheoryEngine, theoryEngine } from './theoryEngine';
export {
  baseCloseHarmonyMidi,
  bassMidiPat011,
  pat011MotionScore,
  sortedL1Motion,
  voicingWithVoiceLeading,
} from './voicingEngine';
