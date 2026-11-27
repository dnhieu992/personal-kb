import { redirect } from 'next/navigation';

/** Old address of My Notes. */
export default function DiaryRedirect() {
  redirect('/my-notes');
}
