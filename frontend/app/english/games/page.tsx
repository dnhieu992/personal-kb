'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from '../../components/icons';
import { PageHeader, ProgressBar } from '../../components/ui';
import { WORLDS as MATCH_WORLDS } from './match/data';
import * as match from './match/engine';
import { WORLDS as SENTENCE_WORLDS } from './sentence/data';
import * as sentence from './sentence/engine';
import { Progress } from './progress';
import { IconName } from '../../components/icons';

/** English games hub. Each game teaches through play; progress lives in this browser. */
interface GameCard {
  href: string;
  icon: IconName;
  name: string;
  meta: string;
  desc: string;
  max: number;
  load: () => Progress;
  stars: (p: Progress) => number;
  mistakes: (p: Progress) => number;
}

const GAMES: GameCard[] = [
  {
    href: '/english/games/sentence',
    icon: 'list',
    name: 'Nối từ',
    meta: `${SENTENCE_WORLDS.length} thế giới · ${SENTENCE_WORLDS.length * sentence.LEVELS_PER_WORLD} màn · A2 → B2`,
    desc: 'Đọc nghĩa tiếng Việt, chọn từng từ theo đúng thứ tự để thành câu tiếng Anh đúng ngữ pháp. Càng lên câu càng dài, bớt gợi ý, có từ bẫy và đồng hồ.',
    max: SENTENCE_WORLDS.length * sentence.LEVELS_PER_WORLD * 3,
    load: sentence.loadProgress,
    stars: (p) => SENTENCE_WORLDS.reduce((a, _, w) => a + sentence.worldStars(p, w), 0),
    mistakes: (p) => sentence.mistakeKeys(p).length,
  },
  {
    href: '/english/games/match',
    icon: 'link',
    name: 'Ghép cặp',
    meta: `${MATCH_WORLDS.length} thế giới · ${MATCH_WORLDS.length * match.LEVELS_PER_WORLD} màn · A2 → B2`,
    desc: 'Ghép từ với nghĩa, động từ với danh từ, nửa câu với nửa câu. Có thẻ bẫy là lỗi người Việt hay mắc.',
    max: MATCH_WORLDS.length * match.LEVELS_PER_WORLD * 3,
    load: match.loadProgress,
    stars: (p) => MATCH_WORLDS.reduce((a, _, w) => a + match.worldStars(p, w), 0),
    mistakes: (p) => match.mistakeKeys(p).length,
  },
];

/** English games hub. Each game teaches through play; progress lives in this browser. */
export default function GamesPage() {
  const [progress, setProgress] = useState<Progress[] | null>(null);
  useEffect(() => setProgress(GAMES.map((g) => g.load())), []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Games"
        description="Học tiếng Anh bằng trò chơi: lên level, gom sao, mỗi lần chơi là một lần ôn từ và cấu trúc câu."
        back={{ href: '/english', label: 'English for IT' }}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {GAMES.map((g, i) => {
          const p = progress?.[i];
          const stars = p ? g.stars(p) : 0;
          const mistakes = p ? g.mistakes(p) : 0;
          return (
            <Link key={g.href} href={g.href} className="card card-interactive flex flex-col gap-3 p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-accent-text">
                  <Icon name={g.icon} className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-[15px] font-semibold text-fg">{g.name}</h2>
                  <p className="text-xs text-fg-muted">{g.meta}</p>
                </div>
              </div>
              <p className="text-[13px] text-fg-secondary">{g.desc}</p>
              <div className="mt-auto space-y-1.5">
                <div className="flex justify-between text-xs text-fg-muted">
                  <span>
                    <Icon name="star" className="mr-1 inline h-3 w-3 fill-current text-warning" />
                    {stars}/{g.max} sao
                  </span>
                  {mistakes > 0 && <span className="chip tone-red">{mistakes} cần ôn</span>}
                </div>
                <ProgressBar value={stars / g.max} />
              </div>
            </Link>
          );
        })}
        <div className="card flex flex-col gap-3 p-5 opacity-60">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-fg-muted">
              <Icon name="volume" className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold text-fg">Nghe & chọn</h2>
              <p className="text-xs text-fg-muted">Sắp có</p>
            </div>
          </div>
          <p className="text-[13px] text-fg-secondary">Nghe một câu nói ở công sở, chọn đúng nghĩa trước khi hết giờ.</p>
        </div>
      </div>
    </div>
  );
}
