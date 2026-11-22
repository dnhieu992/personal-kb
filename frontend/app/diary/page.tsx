'use client';

import Notebook from '../components/notebook/Notebook';
import { api } from '../lib/api';

export default function DiaryPage() {
  return (
    <Notebook
      title="Diary"
      description="Viết Markdown bên trái, xem kết quả bên phải. Mỗi ghi chép lưu nội dung và thời điểm viết."
      store={api.diary}
      draftKey="diary.draft"
      noun="ghi chép"
      placeholder={'Hôm nay thế nào?\n\n## Tiêu đề\n- việc đã làm\n**chữ đậm**, *nghiêng*, [link](https://…)'}
    />
  );
}
