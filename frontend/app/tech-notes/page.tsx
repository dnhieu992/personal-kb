'use client';

import Notebook from '../components/notebook/Notebook';
import { api } from '../lib/api';

export default function TechNotesPage() {
  return (
    <Notebook
      title="Technical notes"
      description="Ghi chú kỹ thuật bằng Markdown: viết bên trái, xem kết quả bên phải. Mỗi note lưu nội dung và thời điểm viết. Viết xong bấm Check English để AI sửa tiếng Anh và gom từ mới vào phần ôn tập."
      store={api.techNotes}
      englishCheck={api.techNotes}
      draftKey="tech-notes.draft"
      noun="note"
      placeholder={'## Vấn đề\nMô tả ngắn…\n\n## Cách giải quyết\n```ts\nconst x = 1;\n```\n- [ ] việc cần làm tiếp'}
    />
  );
}
