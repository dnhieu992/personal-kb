import type { IconName } from './icons';

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  /** Extra words the command palette matches on. */
  keywords?: string;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

/** The app's information architecture: one place, used by the sidebar and ⌘K. */
export const NAV: NavGroup[] = [
  { items: [{ href: '/', label: 'Home', icon: 'home', keywords: 'dashboard overview today' }] },
  {
    label: 'Projects',
    items: [
      { href: '/planner', label: 'List', icon: 'folder', keywords: 'projects tasks todo kanban board planner goals' },
      { href: '/planner/report', label: 'Report', icon: 'chart', keywords: 'projects progress status report' },
    ],
  },
  {
    label: 'Knowledge',
    items: [
      { href: '/knowledge', label: 'Entries', icon: 'book', keywords: 'knowledge notes search' },
      { href: '/projects', label: 'Projects', icon: 'folder' },
      { href: '/chat', label: 'Ask AI', icon: 'sparkles', keywords: 'chat rag question claude' },
    ],
  },
  {
    label: 'English',
    items: [
      { href: '/english', label: 'Course', icon: 'graduation', keywords: 'english for it lesson bài học khóa học tiến độ' },
      { href: '/english/placement', label: 'Placement test', icon: 'target', keywords: 'test xếp lớp trình độ cefr ef set placement' },
      { href: '/english/journal', label: 'Journal', icon: 'pen', keywords: 'english diary nhật ký' },
      { href: '/english/review', label: 'Review', icon: 'cards', keywords: 'flashcards ôn tập srs' },
      { href: '/english/games', label: 'Games', icon: 'gamepad', keywords: 'game trò chơi nối từ xếp câu sắp xếp ghép cặp match vocabulary từ vựng' },
      { href: '/phrases', label: 'Phrases', icon: 'quote', keywords: 'telegram cụm từ' },
    ],
  },
  {
    label: 'Personal',
    items: [
      { href: '/diary', label: 'Diary', icon: 'note', keywords: 'nhật ký diary ghi chép hàng ngày' },
      { href: '/tech-notes', label: 'Technical notes', icon: 'code', keywords: 'tech notes ghi chú kỹ thuật technical' },
    ],
  },
];

export const ALL_NAV: NavItem[] = NAV.flatMap((g) => g.items);

/** The nav item a path belongs to: the longest href that is the path or a parent of it. */
export function activeHref(path: string): string | null {
  let best: string | null = null;
  for (const { href } of ALL_NAV) {
    const hit = href === '/' ? path === '/' : path === href || path.startsWith(href + '/');
    if (hit && (!best || href.length > best.length)) best = href;
  }
  return best;
}
