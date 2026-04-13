/**
 * QA / legacy entry name — identical to {@link getPlaybackEngine} (INTERFACES.md `AudioEngine`).
 */
export {
  getPlaybackEngine as getAudioEngine,
  resetPlaybackEngineForTests as resetAudioEngineForTests,
} from './playbackEngineSingleton';
