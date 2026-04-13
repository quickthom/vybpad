/**
 * Tracks POST /projects → /editor/:id hydration so we do not issue a duplicate GET after React 18
 * Strict Mode remounts (instance refs reset; Zustand song state persists). A late GET would call
 * `loadSong` with stale server JSON and wipe in-progress edits + `isDirty`, breaking debounced
 * autosave (TASK-4.2 E2E).
 *
 * Clear when leaving the editor or when opening a project from the list so a later visit may GET.
 */
const postBootstrapProjectIds = new Set<string>();

export function markEditorPostBootstrapFromNavigate(projectId: string): void {
  postBootstrapProjectIds.add(projectId);
}

export function shouldSkipDuplicateGetAfterPostBootstrap(projectId: string): boolean {
  return postBootstrapProjectIds.has(projectId);
}

export function clearEditorPostBootstrap(projectId: string): void {
  postBootstrapProjectIds.delete(projectId);
}

export function clearAllEditorPostBootstrap(): void {
  postBootstrapProjectIds.clear();
}
