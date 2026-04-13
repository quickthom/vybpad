import { describe, expect, it } from 'vitest';

import { expectedEditorUrlRegex } from '../e2e/helpers/editorReady';

describe('expectedEditorUrlRegex (TASK-4.3 E2E harness)', () => {
  const sampleId = '550e8400-e29b-41d4-a716-446655440000';

  it('matches /editor/:uuid for known project id (absolute URL, trailing segments, query, hash)', () => {
    const re = expectedEditorUrlRegex(sampleId);
    expect(re.test(`http://127.0.0.1:5173/editor/${sampleId}`)).toBe(true);
    expect(re.test(`http://127.0.0.1:5173/editor/${sampleId}/`)).toBe(true);
    expect(re.test(`http://127.0.0.1:5173/editor/${sampleId}?tab=1`)).toBe(true);
    expect(re.test(`http://127.0.0.1:5173/editor/${sampleId}#x`)).toBe(true);
  });

  it('rejects other routes when project id is fixed', () => {
    const re = expectedEditorUrlRegex(sampleId);
    expect(re.test('http://127.0.0.1:5173/projects')).toBe(false);
    expect(re.test(`http://127.0.0.1:5173/editor/00000000-0000-0000-0000-000000000000`)).toBe(false);
  });

  it('matches generic UUID-shaped editor paths when project id is omitted', () => {
    const re = expectedEditorUrlRegex();
    expect(re.test(`/editor/${sampleId}`)).toBe(true);
    expect(re.test(`/editor/${sampleId}/`)).toBe(true);
    expect(re.test('/editor/not-a-uuid')).toBe(false);
  });
});
