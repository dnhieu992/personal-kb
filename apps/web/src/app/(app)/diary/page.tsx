'use client';

import Notebook from '@/features/diary/notebook/Notebook';
import { diaryApi } from '@/features/diary/api';

export default function DiaryPage() {
  return (
    <Notebook
      title="Diary"
      description="Viết Markdown bên trái, xem kết quả bên phải. Mỗi ghi chép lưu nội dung và thời điểm viết."
      store={diaryApi}
      draftKey="diary.draft"
      noun="ghi chép"
      placeholder={'Hôm nay thế nào?\n\n## Tiêu đề\n- việc đã làm\n**chữ đậm**, *nghiêng*, [link](https://…)'}
    />
  );
}
