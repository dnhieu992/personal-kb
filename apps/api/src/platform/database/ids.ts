import { v7 } from 'uuid';

/** All primary keys are UUID v7: time-ordered, so inserts stay index-friendly. */
export function newId(): string {
  return v7();
}
