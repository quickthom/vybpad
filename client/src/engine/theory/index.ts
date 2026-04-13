/**
 * Barrel for the music theory engine. Prefer `theoryEngine` when you need the full
 * INTERFACES.md contract; submodules (`scales`, `chords`, …) remain available for targeted imports.
 */
export { type TheoryEngine, theoryEngine } from './theoryEngine';
export { bassMidiPat011, voicingWithVoiceLeading } from './voicingEngine';
