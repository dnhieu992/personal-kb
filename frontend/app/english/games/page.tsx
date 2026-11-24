'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from '../../components/icons';
import { PageHeader, ProgressBar } from '../../components/ui';
import { WORLDS } from './match/data';
import { LEVELS_PER_WORLD, loadProgress, mistakeKeys, Progress, worldStars } from './match/engine';

/** English games hub. Each game teaches through play; progress lives in this browser. */
export default function GamesPage() {
  const [p, setP] = useState<Progress | null>(null);
  useEffect(() => setP(loadProgress()), []);

  const max = WORLDS.length * LEVELS_PER_WORLD * 3;
  const stars = p ? WORLDS.reduce((a, _, w) => a + worldStars(p, w), 0) : 0;
  const mistakes = p ? mistakeKeys(p).length : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Games"
        description="Học tiếng Anh bằng trò chơi: lên level, gom sao, mỗi lần chơi là một lần ôn từ và cấu trúc câu."
        back={{ href: '/english', label: 'English for IT' }}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/english/games/match" className="card card-interactive flex flex-col gap-3 p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-accent-text">
              <Icon name="link" className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold text-fg">Nối từ</h2>
              <p className="text-xs text-fg-muted">{WORLDS.length} thế giới · {WORLDS.length * LEVELS_PER_WORLD} màn · A2 → B2</p>
            </div>
          </div>
          <p className="text-[13px] text-fg-secondary">
            Ghép từ với nghĩa, động từ với danh từ, nửa câu với nửa câu. Có thẻ bẫy là những lỗi người Việt hay mắc, càng lên càng nhiều cặp và có đồng hồ.
          </p>
          <div className="mt-auto space-y-1.5">
            <div className="flex justify-between text-xs text-fg-muted">
              <span>
                <Icon name="star" className="mr-1 inline h-3 w-3 fill-current text-warning" />
                {stars}/{max} sao
              </span>
              {mistakes > 0 && <span className="chip tone-red">{mistakes} lỗi cần ôn</span>}
            </div>
            <ProgressBar value={stars / max} />
          </div>
        </Link>

        {[
          { icon: 'list' as const, name: 'Xếp câu', desc: 'Kéo các từ vào đúng thứ tự để thành câu hoàn chỉnh.' },
          { icon: 'volume' as const, name: 'Nghe & chọn', desc: 'Nghe một câu nói ở công sở, chọn đúng nghĩa trước khi hết giờ.' },
        ].map((g) => (
          <div key={g.name} className="card flex flex-col gap-3 p-5 opacity-60">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-fg-muted">
                <Icon name={g.icon} className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-[15px] font-semibold text-fg">{g.name}</h2>
                <p className="text-xs text-fg-muted">Sắp có</p>
              </div>
            </div>
            <p className="text-[13px] text-fg-secondary">{g.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
