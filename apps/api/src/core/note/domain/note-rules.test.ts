import { describe, expect, it } from 'vitest';
import { excerpt, normalizeTags, NoteRuleError, resolveParent } from './note-rules';

const none = { projectId: null, taskId: null };

describe('resolveParent', () => {
  it('rejects task AND project', () => {
    expect(() => resolveParent(none, { projectId: 'p', taskId: 't' })).toThrow(NoteRuleError);
  });
  it('filing under a task clears the project and vice versa', () => {
    expect(resolveParent({ projectId: 'p', taskId: null }, { taskId: 't' })).toEqual({ projectId: null, taskId: 't' });
    expect(resolveParent({ projectId: null, taskId: 't' }, { projectId: 'p' })).toEqual({ projectId: 'p', taskId: null });
  });
  it('null unfiles; omitted keeps', () => {
    expect(resolveParent({ projectId: 'p', taskId: null }, { projectId: null })).toEqual(none);
    expect(resolveParent({ projectId: 'p', taskId: null }, {})).toEqual({ projectId: 'p', taskId: null });
  });
  it('allows explicit null on the other side', () => {
    expect(resolveParent(none, { projectId: 'p', taskId: null })).toEqual({ projectId: 'p', taskId: null });
  });
});

describe('normalizeTags', () => {
  it('lowercases, trims, dedupes', () => {
    expect(normalizeTags([' Bug-Fix ', 'bug-fix', 'Architecture', 'daily  log'])).toEqual(['bug-fix', 'architecture', 'daily log']);
  });
});

describe('excerpt', () => {
  it('strips markdown', () => {
    expect(excerpt('# Title\n\nSome **bold** [link](http://x) ![img](a.png)\n```js\ncode\n```')).toBe('Title Some bold link');
  });
});
