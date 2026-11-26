/**
 * Content for the "Nối từ" sentence-building game: the words of a sentence are
 * shuffled and you tap them in order. Worlds follow grammar topics; inside a
 * world sentences get longer. Levels take consecutive slices (SLICES in
 * engine.ts) and the boss mixes the whole world.
 *
 * `trap` is one extra wrong word added to the word bank from level 3 on (the
 * mistake Vietnamese speakers typically make); `why` explains it if used.
 * A trap must never produce another correct sentence. `alt` lists other word
 * orders that are also correct (compared ignoring case and punctuation).
 */

export interface Sentence {
  s: string;
  vi: string;
  note: string;
  trap?: string;
  why?: string;
  alt?: string[];
}

export interface SentenceWorld {
  id: string;
  title: string;
  vi: string;
  cefr: string;
  tone: string;
  items: Sentence[];
}

export const WORLDS: SentenceWorld[] = [
  {
    id: 'basics',
    title: 'Câu cơ bản: hiện tại',
    vi: 'S + V + O, to be, there is/are, câu hỏi với do/does.',
    cefr: 'A2',
    tone: 'sky',
    items: [
      { s: 'I am a backend developer.', vi: 'Tôi là lập trình viên backend.', note: 'S + am/is/are + danh từ' },
      { s: 'She works from home.', vi: 'Cô ấy làm việc ở nhà.', note: 'Hiện tại đơn: he/she/it + V-s' },
      { s: 'The tests are passing now.', vi: 'Test đang chạy qua rồi.', note: 'Hiện tại tiếp diễn: am/is/are + V-ing', alt: ['Now the tests are passing.'] },
      { s: 'We use Git every day.', vi: 'Chúng tôi dùng Git hằng ngày.', note: 'Hiện tại đơn cho thói quen; trạng từ thời gian thường đứng cuối câu', alt: ['Every day we use Git.'] },

      { s: 'There is a bug in production.', vi: 'Có một lỗi trên production.', note: 'There is + danh từ số ít' },
      { s: 'Does the app support dark mode?', vi: 'App có hỗ trợ chế độ tối không?', note: 'Câu hỏi: Does + S + V nguyên mẫu?', trap: 'supports', why: 'Sau "does" động từ trở về nguyên mẫu: does … support.' },
      { s: "He doesn't write unit tests.", vi: 'Anh ấy không viết unit test.', note: "Phủ định: doesn't + V nguyên mẫu", trap: 'writes', why: 'Sau "doesn\'t" dùng động từ nguyên mẫu: doesn\'t write.' },
      { s: 'My team is building a new API.', vi: 'Team tôi đang xây một API mới.', note: 'Hiện tại tiếp diễn: việc đang làm trong giai đoạn này' },
      { s: 'Our office opens at eight.', vi: 'Văn phòng mở cửa lúc tám giờ.', note: 'Hiện tại đơn cho lịch cố định; at + giờ', trap: 'open', why: '"Our office" là số ít nên động từ thêm -s: opens.' },

      { s: 'There are three open pull requests.', vi: 'Có ba pull request đang mở.', note: 'There are + danh từ số nhiều', trap: 'is', why: '"Three pull requests" số nhiều → There are.' },
      { s: 'I usually check my email first.', vi: 'Tôi thường kiểm tra email trước.', note: 'Trạng từ tần suất (usually, always…) đứng trước động từ thường', trap: 'checks', why: 'Chủ ngữ "I" không thêm -s: I check.' },
      { s: 'What are you working on right now?', vi: 'Bây giờ bạn đang làm gì?', note: 'Wh- + am/is/are + S + V-ing? (giới từ "on" để cuối)', trap: 'do', why: 'Câu tiếp diễn dùng "are" + V-ing, không dùng "do".' },
      { s: 'She is good at writing documentation.', vi: 'Cô ấy giỏi viết tài liệu.', note: 'good at + V-ing', trap: 'in', why: '"Giỏi về" là "good at", không phải "good in".' },
      { s: 'The server runs on Linux.', vi: 'Server chạy trên Linux.', note: 'Chủ ngữ số ít + V-s', trap: 'run', why: '"The server" số ít → runs.' },
      { s: 'How often do you deploy?', vi: 'Bạn deploy bao lâu một lần?', note: 'How often + do/does + S + V?', trap: 'does', why: '"You" đi với "do", không phải "does".' },

      { s: 'Our users always complain about slow pages.', vi: 'Người dùng luôn phàn nàn về trang chậm.', note: 'complain about + N; chủ ngữ số nhiều không thêm -s', trap: 'complains', why: '"Our users" số nhiều → complain (không -s).' },
      { s: 'Is anyone using the staging server today?', vi: 'Hôm nay có ai dùng server staging không?', note: 'anyone là số ít → is', trap: 'are', why: '"Anyone" là số ít nên đi với "is".' },
      { s: "The documentation doesn't explain this error clearly.", vi: 'Tài liệu không giải thích rõ lỗi này.', note: "doesn't + V nguyên mẫu; trạng từ cách thức (clearly) đứng sau tân ngữ", trap: 'explains', why: 'Sau "doesn\'t" dùng nguyên mẫu: doesn\'t explain.' },
      { s: 'Where do you store the API keys?', vi: 'Bạn lưu API key ở đâu?', note: 'Where + do + S + V?', trap: 'does', why: '"You" đi với "do".' },
      { s: 'Each microservice has its own database.', vi: 'Mỗi microservice có database riêng.', note: 'each + danh từ số ít + động từ số ít', trap: 'have', why: '"Each" đi với số ít → has.' },
      { s: 'We are hiring two senior developers this month.', vi: 'Tháng này chúng tôi tuyển hai senior developer.', note: 'two + danh từ số nhiều; tiếp diễn cho kế hoạch đang diễn ra', trap: 'developer', why: 'Sau "two" danh từ phải số nhiều: developers.' },
      { s: 'Nobody on my team likes meetings on Monday.', vi: 'Không ai trong team tôi thích họp thứ Hai.', note: 'Nobody → động từ số ít (likes)', trap: 'like', why: '"Nobody" là số ít nên động từ thêm -s: likes.' },
    ],
  },
  {
    id: 'standup',
    title: 'Daily standup',
    vi: 'Báo cáo hằng ngày: đang làm gì, vướng gì, hôm nay làm gì (hiện tại đơn/tiếp diễn).',
    cefr: 'A2',
    tone: 'sky',
    items: [
      { s: 'I am fixing the login bug.', vi: 'Tôi đang sửa lỗi đăng nhập.', note: 'Hiện tại tiếp diễn: am + V-ing', trap: 'fix', why: 'Sau "am" cần V-ing: am fixing.' },
      { s: 'Sorry, you are on mute.', vi: 'Xin lỗi, bạn đang tắt mic.', note: 'be on mute: đang tắt mic', trap: 'in', why: 'Đang tắt mic là "on mute".' },
      { s: 'The build is green again.', vi: 'Bản build xanh trở lại rồi.', note: 'S + is + tính từ; again cuối câu', trap: 'are', why: '"The build" số ít → is.' },
      { s: 'We have a demo tomorrow.', vi: 'Ngày mai chúng ta có buổi demo.', note: 'have + danh từ; trạng từ thời gian cuối câu', trap: 'has', why: '"We" đi với "have".', alt: ['Tomorrow we have a demo.'] },

      { s: 'I am still waiting for the design.', vi: 'Tôi vẫn đang chờ bản thiết kế.', note: 'wait for + N; still đứng sau am/is/are', trap: 'to', why: '"Chờ cái gì" là "wait for", không phải "wait to".' },
      { s: 'Nothing is blocking me right now.', vi: 'Hiện giờ không có gì cản trở tôi.', note: 'Nothing là số ít → is + V-ing', trap: 'are', why: '"Nothing" là số ít nên đi với "is".', alt: ['Right now nothing is blocking me.'] },
      { s: 'Do you need help with the migration?', vi: 'Bạn có cần giúp phần migration không?', note: 'Do + S + V? ; help with + N', trap: 'does', why: '"You" đi với "do".' },
      { s: 'Our sprint ends on Friday.', vi: 'Sprint của chúng ta kết thúc vào thứ Sáu.', note: 'Hiện tại đơn cho lịch cố định; on + thứ trong tuần', trap: 'in', why: 'Trước thứ trong tuần dùng "on".' },
      { s: 'Lan and Minh are pairing on the payment flow.', vi: 'Lan và Minh đang code cặp phần thanh toán.', note: 'Hai chủ ngữ nối bằng and → are', trap: 'is', why: '"Lan and Minh" là số nhiều → are.' },

      { s: 'There are two bugs left in this ticket.', vi: 'Ticket này còn hai lỗi.', note: 'There are + danh từ số nhiều; left: còn lại', trap: 'is', why: '"Two bugs" số nhiều → There are.' },
      { s: 'I usually start with the code reviews.', vi: 'Tôi thường bắt đầu bằng việc review code.', note: 'usually đứng trước động từ thường; start with: bắt đầu bằng', trap: 'starts', why: 'Chủ ngữ "I" không thêm -s.' },
      { s: 'Who is working on the search feature?', vi: 'Ai đang làm tính năng tìm kiếm?', note: 'Who làm chủ ngữ + is + V-ing (không đảo trợ động từ)', trap: 'does', why: 'Câu tiếp diễn dùng is + V-ing, không dùng "does".' },
      { s: 'The client wants the report by Monday.', vi: 'Khách muốn có báo cáo trước thứ Hai.', note: 'by + thời điểm: hạn chót; the client → wants', trap: 'want', why: '"The client" số ít → wants.' },
      { s: 'My pull request still needs one approval.', vi: 'Pull request của tôi vẫn cần một lượt duyệt.', note: 'still đứng trước động từ thường; chủ ngữ số ít → needs', trap: 'need', why: '"My pull request" số ít → needs.' },
      { s: 'Are we still releasing on Thursday?', vi: 'Chúng ta vẫn release vào thứ Năm chứ?', note: 'Are + S + V-ing? : hỏi về kế hoạch đã định', trap: 'do', why: 'Đi với V-ing dùng "are", không dùng "do".' },

      { s: 'I am writing the unit tests for the cart page.', vi: 'Tôi đang viết unit test cho trang giỏ hàng.', note: 'am + V-ing; for + N: cho cái gì', trap: 'write', why: 'Sau "am" cần V-ing: am writing.' },
      { s: 'The staging server is very slow this morning.', vi: 'Sáng nay server staging chạy rất chậm.', note: 'is + very + tính từ; this morning cuối câu', trap: 'slowly', why: 'Sau "is" dùng tính từ (slow), không dùng trạng từ (slowly).', alt: ['This morning the staging server is very slow.'] },
      { s: "I don't understand the new requirement yet.", vi: 'Tôi chưa hiểu yêu cầu mới.', note: "don't + V nguyên mẫu; yet cuối câu phủ định", trap: 'understands', why: "Sau \"don't\" dùng nguyên mẫu: don't understand." },
      { s: 'Does anyone know why the tests are failing?', vi: 'Có ai biết sao test đang lỗi không?', note: 'Does anyone + V? ; câu hỏi lồng giữ trật tự S + V: why the tests are failing', trap: 'knows', why: 'Sau "does" dùng nguyên mẫu: know.' },
      { s: 'We need more time to test the mobile app.', vi: 'Chúng ta cần thêm thời gian để test app mobile.', note: 'need + more + N + to V: cần thêm … để …', trap: 'testing', why: 'Chỉ mục đích dùng "to + V": to test.' },
      { s: 'She always updates the board before the standup.', vi: 'Cô ấy luôn cập nhật bảng trước buổi standup.', note: 'always đứng trước động từ thường; she → updates', trap: 'update', why: '"She" → updates.' },
      { s: 'The new developer is learning our codebase this week.', vi: 'Tuần này bạn dev mới đang tìm hiểu code của chúng ta.', note: 'Tiếp diễn cho việc trong giai đoạn hiện tại', trap: 'learns', why: 'Sau "is" cần V-ing: is learning.', alt: ['This week the new developer is learning our codebase.'] },
    ],
  },
  {
    id: 'past',
    title: 'Quá khứ & hiện tại hoàn thành',
    vi: 'Did, was/were, have/has + V3, for/since, already/yet.',
    cefr: 'A2–B1',
    tone: 'teal',
    items: [
      { s: 'I fixed the bug yesterday.', vi: 'Hôm qua tôi đã sửa lỗi.', note: 'Quá khứ đơn: V-ed + mốc quá khứ', alt: ['Yesterday I fixed the bug.'] },
      { s: 'We had a meeting this morning.', vi: 'Sáng nay chúng tôi có cuộc họp.', note: 'have → had (bất quy tắc)', alt: ['This morning we had a meeting.'] },
      { s: 'She has finished the report.', vi: 'Cô ấy đã làm xong báo cáo.', note: 'Hiện tại hoàn thành: has/have + V3' },
      { s: 'The build failed again.', vi: 'Build lại lỗi nữa rồi.', note: 'Quá khứ đơn có quy tắc: fail → failed' },

      { s: 'Did you push your changes?', vi: 'Bạn đã push thay đổi chưa?', note: 'Did + S + V nguyên mẫu?', trap: 'pushed', why: 'Sau "did" động từ về nguyên mẫu: Did you push?' },
      { s: "I didn't see your message.", vi: 'Tôi không thấy tin nhắn của bạn.', note: "didn't + V nguyên mẫu", trap: 'saw', why: 'Sau "didn\'t" dùng nguyên mẫu: didn\'t see.' },
      { s: 'They have just released version two.', vi: 'Họ vừa phát hành phiên bản hai.', note: 'just đứng giữa have và V3' },
      { s: 'I have never used Kubernetes before.', vi: 'Tôi chưa từng dùng Kubernetes.', note: 'have + never + V3' },
      { s: 'He was reading the logs when it crashed.', vi: 'Anh ấy đang đọc log thì nó sập.', note: 'Quá khứ tiếp diễn + when + quá khứ đơn', alt: ['When it crashed he was reading the logs.'] },

      { s: 'I have worked here for three years.', vi: 'Tôi đã làm ở đây ba năm.', note: 'for + khoảng thời gian; since + mốc', trap: 'since', why: '"Three years" là khoảng thời gian → for (since đi với mốc: since 2021).' },
      { s: 'Have you ever worked with React?', vi: 'Bạn từng làm với React chưa?', note: 'Have you ever + V3?', trap: 'work', why: 'Sau "have" dùng V3: worked.' },
      { s: "We haven't decided on the deadline yet.", vi: 'Chúng tôi vẫn chưa chốt deadline.', note: 'Phủ định / câu hỏi dùng yet ở cuối', trap: 'already', why: 'Câu phủ định dùng "yet"; "already" dùng trong câu khẳng định.' },
      { s: 'The client called while I was coding.', vi: 'Khách gọi trong lúc tôi đang code.', note: 'while + quá khứ tiếp diễn', trap: 'were', why: '"I" đi với "was".', alt: ['While I was coding the client called.'] },
      { s: 'How long have you been learning English?', vi: 'Bạn học tiếng Anh được bao lâu rồi?', note: 'How long + have + S + been + V-ing?', trap: 'did', why: 'Hỏi việc kéo dài đến hiện tại dùng hiện tại hoàn thành tiếp diễn, không dùng "did".' },
      { s: 'She left the company two months ago.', vi: 'Cô ấy nghỉ việc hai tháng trước.', note: '… ago → quá khứ đơn', trap: 'has', why: 'Có "ago" thì dùng quá khứ đơn, không dùng "has left".' },

      { s: 'I have already reviewed all of your pull requests.', vi: 'Tôi đã review hết các pull request của bạn rồi.', note: 'already đứng giữa have và V3', trap: 'yet', why: 'Câu khẳng định dùng "already"; "yet" dùng cho phủ định / câu hỏi.' },
      { s: 'When did you start working on this feature?', vi: 'Bạn bắt đầu làm tính năng này khi nào?', note: 'When + did + S + V?; start + V-ing', trap: 'started', why: 'Sau "did" dùng nguyên mẫu: did you start.' },
      { s: 'We had already deployed when they found the bug.', vi: 'Chúng tôi đã deploy xong thì họ mới phát hiện lỗi.', note: 'Quá khứ hoàn thành (had + V3): việc xảy ra trước một việc quá khứ khác', trap: 'have', why: 'Việc xảy ra trước một mốc quá khứ dùng "had", không dùng "have".', alt: ['When they found the bug we had already deployed.'] },
      { s: 'The site has been down since this morning.', vi: 'Trang web sập từ sáng đến giờ.', note: 'has been + since + mốc thời gian', trap: 'for', why: '"This morning" là mốc → since.' },
      { s: 'I used to work as a QA tester.', vi: 'Tôi từng làm QA tester.', note: 'used to + V nguyên mẫu: từng (giờ không còn)', trap: 'working', why: '"Used to" + nguyên mẫu. ("Be used to + V-ing" là "quen với", nghĩa khác.)' },
      { s: 'Nobody had told me about the new process.', vi: 'Chưa ai nói với tôi về quy trình mới.', note: 'had + V3', trap: 'tell', why: 'Sau "had" dùng V3: told.' },
      { s: 'Have you heard back from the client yet?', vi: 'Khách đã phản hồi lại chưa?', note: 'hear back from sb = nhận phản hồi; câu hỏi dùng yet', trap: 'hear', why: 'Sau "have" dùng V3: heard.' },
    ],
  },
  {
    id: 'incidents',
    title: 'Sự cố & báo cáo lỗi',
    vi: 'Kể lại sự cố: quá khứ đơn/tiếp diễn, hiện tại hoàn thành, since/for, had V3.',
    cefr: 'A2–B1',
    tone: 'teal',
    items: [
      { s: 'The site went down.', vi: 'Trang web bị sập.', note: 'Quá khứ bất quy tắc: go → went', trap: 'goed', why: '"go" là động từ bất quy tắc: went.' },
      { s: 'We rolled back the release.', vi: 'Chúng tôi đã rollback bản release.', note: 'Quá khứ đơn V-ed; cụm động từ roll back', alt: ['We rolled the release back.'] },
      { s: 'Have you restarted the server?', vi: 'Bạn đã khởi động lại server chưa?', note: 'Have + S + V3? : đã … chưa', trap: 'did', why: 'Đi với V3 (restarted) dùng "have", không dùng "did".' },
      { s: 'The fix is already live.', vi: 'Bản sửa đã lên production rồi.', note: 'already đứng sau to be', trap: 'are', why: '"The fix" số ít → is.', alt: ['The fix is live already.'] },

      { s: 'The database ran out of disk space.', vi: 'Database bị hết dung lượng ổ đĩa.', note: 'run out of + N: hết; run → ran', trap: 'runned', why: '"run" bất quy tắc: ran.' },
      { s: 'I was sleeping when the alert came.', vi: 'Tôi đang ngủ thì cảnh báo đến.', note: 'Quá khứ tiếp diễn (was V-ing) + when + quá khứ đơn', trap: 'were', why: '"I" đi với "was".', alt: ['When the alert came I was sleeping.'] },
      { s: "We haven't found the root cause yet.", vi: 'Chúng tôi chưa tìm ra nguyên nhân gốc.', note: "haven't + V3 … yet", trap: 'find', why: "Sau \"haven't\" dùng V3: found." },
      { s: 'How long did the outage last?', vi: 'Sự cố kéo dài bao lâu?', note: 'How long + did + S + V nguyên mẫu?', trap: 'lasted', why: 'Sau "did" dùng nguyên mẫu: last.' },
      { s: 'Payments failed for about twenty minutes.', vi: 'Thanh toán bị lỗi khoảng hai mươi phút.', note: 'for + khoảng thời gian', trap: 'during', why: 'Trước một khoảng thời gian có số (twenty minutes) dùng "for".' },

      { s: "The service has been down since nine o'clock.", vi: 'Dịch vụ sập từ chín giờ đến giờ.', note: 'has been + since + mốc thời gian', trap: 'for', why: 'Trước mốc thời gian dùng "since"; "for" đi với khoảng thời gian.' },
      { s: 'A customer reported the problem yesterday.', vi: 'Hôm qua một khách hàng báo lỗi.', note: 'Có mốc đã qua (yesterday) → quá khứ đơn', trap: 'has', why: 'Có "yesterday" thì dùng quá khứ đơn, không dùng hiện tại hoàn thành.', alt: ['Yesterday a customer reported the problem.'] },
      { s: 'While we were deploying, the cache stopped working.', vi: 'Trong lúc chúng tôi đang deploy thì cache ngừng hoạt động.', note: 'While + quá khứ tiếp diễn, quá khứ đơn; stop + V-ing: ngừng làm gì', trap: 'was', why: '"We" đi với "were".', alt: ['The cache stopped working while we were deploying.'] },
      { s: 'Has anyone checked the error logs?', vi: 'Đã có ai xem log lỗi chưa?', note: 'Has + anyone + V3?', trap: 'have', why: '"Anyone" số ít → has.' },
      { s: 'We have already informed the affected users.', vi: 'Chúng tôi đã thông báo cho người dùng bị ảnh hưởng.', note: 'have + already + V3', trap: 'did', why: 'Đi với V3 và "already" dùng "have".' },
      { s: 'The memory usage was growing all night.', vi: 'Bộ nhớ cứ tăng suốt đêm.', note: 'Quá khứ tiếp diễn nhấn mạnh việc kéo dài', trap: 'were', why: '"The memory usage" số ít → was.' },

      { s: 'It took us three hours to find the bug.', vi: 'Chúng tôi mất ba tiếng để tìm ra lỗi.', note: 'It took + người + thời gian + to V', trap: 'finding', why: 'Cấu trúc "It took … to V": to find.' },
      { s: 'The last deploy changed the database connection settings.', vi: 'Lần deploy trước đã đổi cấu hình kết nối database.', note: 'Quá khứ đơn; danh từ ghép: database connection settings', trap: 'change', why: 'Việc đã xảy ra → quá khứ đơn: changed.' },
      { s: "We didn't notice the problem until the next morning.", vi: 'Mãi đến sáng hôm sau chúng tôi mới nhận ra vấn đề.', note: "didn't … until: mãi đến … mới", trap: 'noticed', why: "Sau \"didn't\" dùng nguyên mẫu: notice." },
      { s: 'This is the second time the job has failed this week.', vi: 'Đây là lần thứ hai job bị lỗi trong tuần này.', note: 'This is the first/second time + hiện tại hoàn thành', trap: 'fails', why: 'Sau "This is the second time" dùng hiện tại hoàn thành: has failed.' },
      { s: 'Someone deleted the config file by mistake.', vi: 'Có người lỡ tay xoá file cấu hình.', note: 'by mistake: do nhầm, lỡ tay', trap: 'on', why: '"Lỡ tay" là "by mistake".' },
      { s: 'We have added an alert so it does not happen again.', vi: 'Chúng tôi đã thêm cảnh báo để chuyện này không lặp lại.', note: 'so + mệnh đề: để; does not + V nguyên mẫu', trap: 'happens', why: 'Sau "does not" dùng nguyên mẫu: happen.' },
      { s: 'By the time I logged in, the team had fixed the issue.', vi: 'Lúc tôi đăng nhập thì team đã sửa xong lỗi.', note: 'By the time + quá khứ đơn, quá khứ hoàn thành (had V3)', trap: 'has', why: 'Việc xong trước một mốc quá khứ dùng "had", không dùng "has".', alt: ['The team had fixed the issue by the time I logged in.'] },
    ],
  },
  {
    id: 'modals',
    title: 'Tương lai, khuyết thiếu & câu hỏi',
    vi: 'will, going to, can/should/must, câu hỏi gián tiếp.',
    cefr: 'B1',
    tone: 'violet',
    items: [
      { s: 'I will call you later.', vi: 'Lát nữa tôi sẽ gọi bạn.', note: 'will + V nguyên mẫu' },
      { s: 'You should restart the server.', vi: 'Bạn nên khởi động lại server.', note: 'should + V nguyên mẫu: lời khuyên' },
      { s: 'Can you share your screen?', vi: 'Bạn chia sẻ màn hình được không?', note: 'Can + S + V?: nhờ vả' },
      { s: 'I am going to refactor this.', vi: 'Tôi định refactor chỗ này.', note: 'be going to + V: dự định có sẵn' },

      { s: 'We must not share passwords.', vi: 'Chúng ta không được chia sẻ mật khẩu.', note: 'must not = cấm', trap: 'to', why: '"Must" + nguyên mẫu, không có "to".' },
      { s: 'Could you send me the link?', vi: 'Bạn gửi tôi link được không?', note: 'Could you + V?: nhờ lịch sự', trap: 'sending', why: 'Sau "could" dùng nguyên mẫu: send.' },
      { s: 'What time does the demo start?', vi: 'Mấy giờ demo bắt đầu?', note: 'What time + does + S + V?', trap: 'starts', why: 'Sau "does" dùng nguyên mẫu: start.' },
      { s: "You don't have to join the call.", vi: 'Bạn không cần tham gia cuộc gọi.', note: "don't have to = không cần (khác must not = cấm)" },
      { s: "I'll let you know tomorrow.", vi: 'Mai tôi báo bạn.', note: 'let sb know = báo cho ai biết', alt: ["Tomorrow I'll let you know."] },

      { s: 'Which framework should we use for this project?', vi: 'Dự án này nên dùng framework nào?', note: 'Which + N + should + S + V?', trap: 'using', why: 'Sau "should" dùng nguyên mẫu: use.' },
      { s: 'The meeting will probably take an hour.', vi: 'Cuộc họp chắc mất khoảng một tiếng.', note: 'probably đứng sau will', trap: 'takes', why: 'Sau "will" dùng nguyên mẫu: take.' },
      { s: 'Who is going to review this pull request?', vi: 'Ai sẽ review pull request này?', note: 'Who + is going to + V?', trap: 'reviewing', why: '"Going to" + nguyên mẫu: going to review.' },
      { s: 'You had better back up the database first.', vi: 'Tốt nhất bạn nên backup database trước.', note: 'had better + V nguyên mẫu', trap: 'to', why: '"Had better" + nguyên mẫu, không có "to".' },
      { s: 'May I ask a quick question?', vi: 'Tôi hỏi nhanh một câu được không?', note: 'May I + V?: xin phép lịch sự', trap: 'asking', why: 'Sau "may" dùng nguyên mẫu: ask.' },
      { s: 'We might need more time for testing.', vi: 'Có thể chúng ta cần thêm thời gian để test.', note: 'might + V: có thể (không chắc)', trap: 'to', why: '"Might" + nguyên mẫu, không có "to".' },

      { s: 'How long will it take to fix this issue?', vi: 'Sửa lỗi này mất bao lâu?', note: 'It takes + thời gian + to V', trap: 'fixing', why: '"Take (thời gian)" + to V: take to fix.' },
      { s: "I won't be able to attend the meeting tomorrow.", vi: 'Mai tôi không dự họp được.', note: "won't be able to + V (không dùng won't can)", trap: 'can', why: 'Không đặt hai động từ khuyết thiếu cạnh nhau: dùng "won\'t be able to".', alt: ["Tomorrow I won't be able to attend the meeting."] },
      { s: 'Do you know where the config file is?', vi: 'Bạn có biết file config ở đâu không?', note: 'Câu hỏi gián tiếp: không đảo ngữ (where the file is)' },
      { s: 'Could you tell me what time it starts?', vi: 'Bạn cho tôi biết mấy giờ bắt đầu được không?', note: 'Câu hỏi gián tiếp: what time + S + V (không dùng does)', trap: 'does', why: 'Câu hỏi gián tiếp không dùng trợ động từ: what time it starts.' },
      { s: 'We should have tested it more carefully.', vi: 'Lẽ ra chúng ta nên test kỹ hơn.', note: 'should have + V3: lẽ ra nên (nhưng đã không)', trap: 'test', why: 'Sau "have" dùng V3: tested.' },
      { s: 'Shall we take a short break now?', vi: 'Mình nghỉ một chút nhé?', note: 'Shall we + V?: rủ, đề nghị', trap: 'taking', why: 'Sau "shall" dùng nguyên mẫu: take.' },
      { s: 'By Friday we will have finished the first version.', vi: 'Đến thứ Sáu chúng tôi sẽ xong bản đầu tiên.', note: 'by + mốc tương lai → will have + V3', trap: 'finish', why: 'Tương lai hoàn thành: will have + V3 (finished).', alt: ['We will have finished the first version by Friday.'] },
    ],
  },
  {
    id: 'meetings',
    title: 'Họp hành',
    vi: 'Mở, điều phối, đề xuất và chốt việc trong cuộc họp: will, going to, shall, could, let me.',
    cefr: 'B1',
    tone: 'violet',
    items: [
      { s: 'Shall we start the meeting?', vi: 'Chúng ta bắt đầu họp nhé?', note: 'Shall we + V? : rủ, đề nghị', trap: 'starting', why: 'Sau "shall" dùng nguyên mẫu.' },
      { s: 'Can everyone see my screen?', vi: 'Mọi người có thấy màn hình của tôi không?', note: 'Can + S + V? ; everyone là số ít', trap: 'seeing', why: 'Sau "can" dùng nguyên mẫu: see.' },
      { s: "Let's move to the next item.", vi: 'Chuyển sang mục tiếp theo nhé.', note: "Let's + V nguyên mẫu", trap: 'moving', why: "Sau \"let's\" dùng nguyên mẫu." },
      { s: "I'll send the notes after the call.", vi: 'Tôi sẽ gửi biên bản sau cuộc gọi.', note: 'will + V: quyết định ngay lúc nói', trap: 'sending', why: 'Sau "will" dùng nguyên mẫu.', alt: ["After the call I'll send the notes."] },

      { s: 'We should keep this meeting short.', vi: 'Chúng ta nên giữ buổi họp này ngắn gọn.', note: 'keep + N + tính từ', trap: 'shortly', why: '"keep + N + tính từ": keep it short.' },
      { s: 'Could you repeat the last point, please?', vi: 'Bạn nhắc lại ý cuối được không?', note: 'Could you + V …, please? : nhờ lịch sự', trap: 'repeating', why: 'Sau "could" dùng nguyên mẫu.', alt: ['Could you please repeat the last point?'] },
      { s: 'I am going to present the roadmap.', vi: 'Tôi sẽ trình bày lộ trình.', note: 'be going to + V: kế hoạch đã định', trap: 'presenting', why: '"going to" + nguyên mẫu: going to present.' },
      { s: 'Who will take care of the documentation?', vi: 'Ai sẽ phụ trách tài liệu?', note: 'take care of + N: phụ trách, lo', trap: 'for', why: '"Phụ trách, lo việc gì" là "take care of".' },
      { s: "I don't think we need another meeting.", vi: 'Tôi nghĩ chúng ta không cần thêm buổi họp nào.', note: "Tiếng Anh phủ định ở \"think\": I don't think + khẳng định", trap: 'needs', why: '"We" không thêm -s.' },

      { s: 'We might have to postpone the launch.', vi: 'Có thể chúng ta phải lùi ngày ra mắt.', note: 'might have to + V: có thể phải', trap: 'postponing', why: '"have to" + nguyên mẫu.' },
      { s: 'Would it be possible to move the deadline?', vi: 'Có thể dời hạn chót được không?', note: 'Would it be possible to + V? : hỏi rất lịch sự', trap: 'moving', why: '"possible to" + nguyên mẫu.' },
      { s: 'Let me know if you have any questions.', vi: 'Có câu hỏi gì thì báo tôi nhé.', note: 'Let me know if … ; let + O + V nguyên mẫu', trap: 'to', why: 'Sau "let me" dùng nguyên mẫu không "to": let me know.', alt: ['If you have any questions let me know.'] },
      { s: 'I suggest that we split the task into two.', vi: 'Tôi đề xuất chia task làm hai.', note: 'suggest (that) + S + V nguyên mẫu; split into', trap: 'splitting', why: 'Sau "suggest that we" dùng nguyên mẫu: split.' },
      { s: 'We will discuss this in more detail tomorrow.', vi: 'Ngày mai chúng ta sẽ bàn chi tiết hơn.', note: 'discuss + N (không có giới từ); in more detail: chi tiết hơn', trap: 'about', why: '"discuss" đi thẳng với tân ngữ, không dùng "discuss about".', alt: ['Tomorrow we will discuss this in more detail.'] },
      { s: 'Do you mind if I record this meeting?', vi: 'Bạn có phiền nếu tôi ghi hình buổi họp không?', note: 'Do you mind if + S + V? : xin phép', trap: 'does', why: '"You" đi với "do".' },

      { s: "I have to leave early for a doctor's appointment.", vi: 'Tôi phải về sớm vì có lịch khám bác sĩ.', note: 'have to + V: phải (do hoàn cảnh)', trap: 'leaving', why: '"have to" + nguyên mẫu.' },
      { s: 'We are meeting the client at three this afternoon.', vi: 'Ba giờ chiều nay chúng ta gặp khách.', note: 'Hiện tại tiếp diễn cho lịch hẹn tương lai; meet + người', trap: 'with', why: '"Gặp ai" là "meet + người", không cần "with".' },
      { s: 'You must not share these numbers outside the company.', vi: 'Bạn không được chia sẻ các con số này ra ngoài công ty.', note: 'must not + V: cấm', trap: 'to', why: 'Sau "must not" dùng nguyên mẫu không "to".' },
      { s: 'Could we go back to the previous slide for a moment?', vi: 'Mình quay lại slide trước một chút được không?', note: 'go back to + N; for a moment: một lát', trap: 'went', why: 'Sau "could" dùng nguyên mẫu: go.' },
      { s: 'I will probably be late for the planning session.', vi: 'Có lẽ tôi sẽ đến muộn buổi planning.', note: 'probably đứng sau will; late for + N', trap: 'to', why: '"Muộn (buổi gì)" là "late for".' },
      { s: 'If nobody has anything else, we can finish early.', vi: 'Nếu không ai còn gì nữa, chúng ta có thể kết thúc sớm.', note: 'nobody + has (số ít); can + V', trap: 'have', why: '"Nobody" là số ít → has.', alt: ['We can finish early if nobody has anything else.'] },
      { s: 'Before we finish, let me sum up what we agreed.', vi: 'Trước khi kết thúc, để tôi tóm tắt những gì đã thống nhất.', note: 'let me + V; what + S + V làm tân ngữ', trap: 'summing', why: 'Sau "let me" dùng nguyên mẫu: sum up.', alt: ['Let me sum up what we agreed before we finish.'] },
    ],
  },
  {
    id: 'conditionals',
    title: 'Câu điều kiện & bị động',
    vi: 'If loại 0–3, unless, bị động ở mọi thì.',
    cefr: 'B1',
    tone: 'amber',
    items: [
      { s: 'The bug was fixed yesterday.', vi: 'Lỗi đã được sửa hôm qua.', note: 'Bị động quá khứ: was/were + V3', alt: ['Yesterday the bug was fixed.'] },
      { s: 'If the tests pass, we deploy.', vi: 'Nếu test qua thì chúng tôi deploy.', note: 'Điều kiện loại 0: If + hiện tại, hiện tại', alt: ['We deploy if the tests pass.'] },
      { s: 'This app is used by many companies.', vi: 'App này được nhiều công ty sử dụng.', note: 'Bị động hiện tại: is/are + V3 (+ by …)' },
      { s: 'If you need help, ask me.', vi: 'Cần giúp thì hỏi tôi.', note: 'If + hiện tại, mệnh lệnh', alt: ['Ask me if you need help.'] },

      { s: 'The report will be sent tomorrow.', vi: 'Báo cáo sẽ được gửi vào ngày mai.', note: 'Bị động tương lai: will be + V3', trap: 'send', why: 'Bị động cần V3: will be sent.', alt: ['Tomorrow the report will be sent.'] },
      { s: 'If it breaks again, I will fix it.', vi: 'Nếu nó hỏng nữa, tôi sẽ sửa.', note: 'Loại 1: If + hiện tại, will + V', trap: 'would', why: 'Vế If ở hiện tại (breaks) là loại 1 → will.', alt: ['I will fix it if it breaks again.'] },
      { s: 'All tickets must be closed before Friday.', vi: 'Mọi ticket phải được đóng trước thứ Sáu.', note: 'must be + V3', trap: 'close', why: 'Sau "must be" dùng V3: closed.' },
      { s: 'The data is stored in the cloud.', vi: 'Dữ liệu được lưu trên cloud.', note: 'is + V3', trap: 'store', why: 'Bị động: is stored.' },
      { s: 'Unless you hurry, you will miss the deadline.', vi: 'Không nhanh lên là trễ hạn đấy.', note: 'Unless = If … not', alt: ['You will miss the deadline unless you hurry.'] },

      { s: 'If I were you, I would ask for help.', vi: 'Nếu là bạn, tôi sẽ nhờ giúp đỡ.', note: 'Loại 2: If I were you, would + V', trap: 'will', why: '"If I were you" là giả định (loại 2) → would.', alt: ['I would ask for help if I were you.'] },
      { s: 'The new feature is being tested right now.', vi: 'Tính năng mới đang được test.', note: 'Bị động tiếp diễn: is being + V3', trap: 'testing', why: 'Bị động: being tested (V3).' },
      { s: 'If we had more time, we would refactor everything.', vi: 'Nếu có thêm thời gian, chúng tôi sẽ refactor hết.', note: 'Loại 2: If + quá khứ, would + V', trap: 'will', why: 'Vế If dùng "had" (giả định) → would.', alt: ['We would refactor everything if we had more time.'] },
      { s: 'My laptop was stolen at the airport.', vi: 'Laptop của tôi bị trộm ở sân bay.', note: 'was + V3 (steal → stolen)', trap: 'stole', why: 'Bị động dùng V3: stolen (stole là V2).' },
      { s: 'The meeting has been moved to Thursday.', vi: 'Cuộc họp đã được dời sang thứ Năm.', note: 'Bị động hoàn thành: has been + V3', trap: 'move', why: 'has been + V3: moved.' },
      { s: 'What would you do if the server crashed?', vi: 'Bạn sẽ làm gì nếu server sập?', note: 'Loại 2 dạng câu hỏi', trap: 'will', why: 'Vế If dùng quá khứ (crashed) → would.', alt: ['If the server crashed what would you do?'] },

      { s: 'If I had known, I would have told you.', vi: 'Nếu tôi biết thì tôi đã nói với bạn rồi.', note: 'Loại 3: If + had V3, would have V3', trap: 'will', why: 'Loại 3 (quá khứ): would have told.', alt: ['I would have told you if I had known.'] },
      { s: 'The system should have been updated last week.', vi: 'Lẽ ra hệ thống phải được cập nhật tuần trước.', note: 'should have been + V3', trap: 'update', why: 'Bị động: been updated.' },
      { s: 'These logs are automatically deleted after thirty days.', vi: 'Log này tự động bị xoá sau 30 ngày.', note: 'are + (trạng từ) + V3', trap: 'delete', why: 'Bị động: are deleted.', alt: ['These logs are deleted automatically after thirty days.'] },
      { s: "If you hadn't warned me, I would have deployed it.", vi: 'Nếu bạn không cảnh báo, tôi đã deploy rồi.', note: "Loại 3 phủ định: If + hadn't V3", trap: "didn't", why: 'Loại 3 dùng "hadn\'t + V3", không dùng "didn\'t".', alt: ["I would have deployed it if you hadn't warned me."] },
      { s: 'The bug was reported by one of our biggest clients.', vi: 'Lỗi được một khách hàng lớn nhất của chúng tôi báo.', note: 'was + V3 + by …; one of + số nhiều', trap: 'report', why: 'Bị động: was reported.' },
      { s: 'Our passwords are being reset by the IT team.', vi: 'Mật khẩu của chúng tôi đang được team IT đặt lại.', note: 'are being + V3', trap: 'resetting', why: 'Bị động tiếp diễn: being reset (V3).' },
      { s: 'If the API were faster, users would be happier.', vi: 'Nếu API nhanh hơn thì người dùng sẽ vui hơn.', note: 'Loại 2: If + were, would + V', trap: 'will', why: 'Giả định (were) → would.', alt: ['Users would be happier if the API were faster.'] },
    ],
  },
  {
    id: 'codereview',
    title: 'Code review',
    vi: 'Góp ý code: bị động (is/was/should be/has been + V3) và câu điều kiện.',
    cefr: 'B1',
    tone: 'amber',
    items: [
      { s: 'This function is never called.', vi: 'Hàm này không bao giờ được gọi.', note: 'Bị động: is + V3; never đứng sau to be', trap: 'calls', why: 'Bị động cần V3: called.' },
      { s: 'The tests were updated.', vi: 'Test đã được cập nhật.', note: 'Bị động quá khứ: were + V3', trap: 'was', why: '"The tests" số nhiều → were.' },
      { s: 'Please rename this variable.', vi: 'Vui lòng đổi tên biến này.', note: 'Please + V nguyên mẫu', trap: 'renaming', why: 'Câu đề nghị với please dùng nguyên mẫu.' },
      { s: 'This looks good to me.', vi: 'Cái này ổn với tôi (LGTM).', note: 'look + tính từ: trông có vẻ', trap: 'well', why: '"look" (trông có vẻ) + tính từ: good, không dùng well.' },

      { s: 'This value should be stored in the config.', vi: 'Giá trị này nên được lưu trong config.', note: 'Bị động với modal: should be + V3', trap: 'store', why: 'Bị động cần V3: stored.' },
      { s: 'If you add a test, I will approve it.', vi: 'Nếu bạn thêm test, tôi sẽ duyệt.', note: 'Điều kiện loại 1: If + hiện tại, will + V', trap: 'adds', why: '"You" không thêm -s.', alt: ['I will approve it if you add a test.'] },
      { s: 'Why is this check needed here?', vi: 'Sao chỗ này lại cần kiểm tra này?', note: 'Câu hỏi bị động: Why + is + S + V3?', trap: 'need', why: 'Bị động cần V3: needed.' },
      { s: 'The error is not handled properly.', vi: 'Lỗi chưa được xử lý đúng cách.', note: 'Bị động phủ định: is not + V3; trạng từ cuối câu', trap: 'proper', why: 'Bổ nghĩa cho động từ dùng trạng từ: properly.' },
      { s: 'This code was written two years ago.', vi: 'Code này được viết từ hai năm trước.', note: 'Bị động quá khứ: was + V3 (write → written)', trap: 'wrote', why: 'Bị động dùng V3: written.' },

      { s: 'If the list is empty, this line will crash.', vi: 'Nếu danh sách rỗng, dòng này sẽ crash.', note: 'Điều kiện loại 1', trap: 'crashes', why: 'Sau "will" dùng nguyên mẫu: crash.', alt: ['This line will crash if the list is empty.'] },
      { s: 'The password must be hashed before saving.', vi: 'Mật khẩu phải được băm trước khi lưu.', note: 'must be + V3; before + V-ing', trap: 'save', why: 'Sau giới từ "before" dùng V-ing: saving.' },
      { s: 'I would split this into smaller functions.', vi: 'Tôi sẽ tách phần này thành các hàm nhỏ hơn.', note: 'would + V: góp ý nhẹ nhàng; split into', trap: 'small', why: '"Nhỏ hơn" là so sánh hơn: smaller.' },
      { s: 'Has this change been tested on mobile?', vi: 'Thay đổi này đã được test trên mobile chưa?', note: 'Bị động hoàn thành: has been + V3', trap: 'being', why: 'Hoàn thành bị động: has been tested.' },
      { s: 'If I were you, I would use a map here.', vi: 'Nếu là bạn, tôi sẽ dùng map ở đây.', note: 'Điều kiện loại 2: If I were you, I would …', trap: 'will', why: 'Điều kiện loại 2 (If I were) đi với "would".', alt: ['I would use a map here if I were you.'] },
      { s: 'All the open comments have been resolved.', vi: 'Tất cả comment đang mở đã được xử lý.', note: 'Bị động hoàn thành: have been + V3', trap: 'has', why: '"All the open comments" số nhiều → have.' },

      { s: 'This query will be slow if the table gets big.', vi: 'Truy vấn này sẽ chậm nếu bảng to lên.', note: 'Điều kiện loại 1; get + tính từ: trở nên', trap: 'slowly', why: 'Sau "be" dùng tính từ: slow.', alt: ['If the table gets big this query will be slow.'] },
      { s: 'The API key should not be committed to the repository.', vi: 'API key không nên bị commit lên repo.', note: 'should not be + V3', trap: 'commit', why: 'Bị động cần V3: committed.' },
      { s: 'If we cached the result, the page would load much faster.', vi: 'Nếu cache kết quả thì trang sẽ tải nhanh hơn nhiều.', note: 'Điều kiện loại 2: If + quá khứ, would + V; much + so sánh hơn', trap: 'will', why: 'Vế If dùng quá khứ (cached) → vế kia dùng "would".', alt: ['The page would load much faster if we cached the result.'] },
      { s: 'This bug would not have happened if we had added validation.', vi: 'Lỗi này đã không xảy ra nếu chúng ta kiểm tra dữ liệu đầu vào.', note: 'Điều kiện loại 3: would not have V3 … if + had V3', trap: 'has', why: 'Điều kiện loại 3 dùng "had" + V3.', alt: ['If we had added validation this bug would not have happened.'] },
      { s: 'The old endpoint is still being used by the mobile app.', vi: 'Endpoint cũ vẫn đang được app mobile dùng.', note: 'Bị động tiếp diễn: is being + V3; by + tác nhân', trap: 'been', why: 'Bị động tiếp diễn: is being used.' },
      { s: 'Unless this is fixed, the release will be delayed.', vi: 'Nếu chưa sửa cái này, bản release sẽ bị hoãn.', note: 'Unless = If … not; will be + V3', trap: 'not', why: '"Unless" đã mang nghĩa phủ định, không thêm "not".', alt: ['The release will be delayed unless this is fixed.'] },
      { s: 'I left a few comments, but overall it looks great.', vi: 'Tôi để lại vài comment, nhưng nhìn chung rất tốt.', note: 'a few + danh từ đếm được số nhiều; overall: nhìn chung', trap: 'little', why: '"Comments" đếm được → a few, không dùng a little.' },
    ],
  },
  {
    id: 'clauses',
    title: 'Mệnh đề, tường thuật, V-ing/to V',
    vi: 'who/which/that, câu tường thuật, enjoy doing, want to do.',
    cefr: 'B1–B2',
    tone: 'green',
    items: [
      { s: 'I enjoy solving hard problems.', vi: 'Tôi thích giải những bài toán khó.', note: 'enjoy + V-ing', trap: 'to', why: '"Enjoy" + V-ing, không dùng "to".' },
      { s: 'She wants to learn Python.', vi: 'Cô ấy muốn học Python.', note: 'want + to V', trap: 'learning', why: '"Want" + to V.' },
      { s: 'He said he was busy.', vi: 'Anh ấy nói anh ấy bận.', note: 'Tường thuật: lùi thì (is → was)' },
      { s: 'This is the bug I found.', vi: 'Đây là lỗi tôi tìm ra.', note: 'Lược bỏ that/which khi nó là tân ngữ' },

      { s: 'The person who called you is my manager.', vi: 'Người gọi bạn là quản lý của tôi.', note: 'who cho người', trap: 'which', why: '"Which" dùng cho vật; người dùng "who".' },
      { s: 'Stop pushing directly to the main branch.', vi: 'Đừng push thẳng lên nhánh main nữa.', note: 'stop + V-ing = ngừng làm gì', alt: ['Stop pushing to the main branch directly.'] },
      { s: 'I forgot to update the documentation.', vi: 'Tôi quên cập nhật tài liệu.', note: 'forget + to V = quên làm (việc cần làm)' },
      { s: 'He told me that the server was down.', vi: 'Anh ấy bảo tôi server bị sập.', note: 'tell + người + that …', trap: 'said', why: '"Say" không đi trực tiếp với người (said me ✗); dùng "told me".' },
      { s: 'Thanks for helping me with the review.', vi: 'Cảm ơn đã giúp tôi review.', note: 'thanks for + V-ing', trap: 'help', why: 'Sau giới từ "for" dùng V-ing: helping.' },

      { s: 'The library that we use is no longer maintained.', vi: 'Thư viện chúng ta dùng không còn được bảo trì.', note: 'that/which cho vật', trap: 'who', why: 'Thư viện là vật → that/which, không dùng "who".' },
      { s: 'She asked me if I had finished the task.', vi: 'Cô ấy hỏi tôi đã xong task chưa.', note: 'Tường thuật câu hỏi Yes/No: if/whether + lùi thì', trap: 'have', why: 'Câu tường thuật lùi thì: have finished → had finished.' },
      { s: "I'm looking forward to meeting the new team.", vi: 'Tôi mong được gặp team mới.', note: 'look forward to + V-ing', trap: 'meet', why: '"To" ở đây là giới từ → meeting.' },
      { s: 'Do you mind explaining that again?', vi: 'Phiền bạn giải thích lại được không?', note: 'mind + V-ing', trap: 'to', why: '"Mind" + V-ing, không dùng "to".' },
      { s: 'He suggested using a different database.', vi: 'Anh ấy đề xuất dùng database khác.', note: 'suggest + V-ing', trap: 'to', why: '"Suggest" + V-ing, không dùng "to".' },
      { s: "That's the developer whose code broke the build.", vi: 'Đó là người có code làm hỏng build.', note: 'whose + danh từ = của người đó', trap: "who's", why: '"Who\'s" = who is; sở hữu phải dùng "whose".' },

      { s: 'The feature which we released last week has a bug.', vi: 'Tính năng chúng tôi ra tuần trước có lỗi.', note: 'which cho vật; động từ chính (has) chia theo "the feature"', trap: 'who', why: 'Tính năng là vật → which/that.' },
      { s: 'My manager asked me why I had missed the meeting.', vi: 'Sếp hỏi tôi tại sao bỏ lỡ cuộc họp.', note: 'Tường thuật câu hỏi Wh: why + S + V (không đảo ngữ)', trap: 'did', why: 'Câu hỏi tường thuật không dùng "did" và không đảo ngữ: why I had missed.' },
      { s: 'I remember sending you the file on Monday.', vi: 'Tôi nhớ là đã gửi bạn file hôm thứ Hai.', note: 'remember + V-ing = nhớ đã làm', trap: 'to', why: '"Remember to do" là nhớ để làm (chưa làm); nhớ đã làm là "remember doing".' },
      { s: "It's not worth spending more time on this bug.", vi: 'Không đáng để tốn thêm thời gian cho lỗi này.', note: 'worth + V-ing', trap: 'to', why: '"Worth" + V-ing.' },
      { s: 'She is used to working late before a release.', vi: 'Cô ấy quen làm muộn trước mỗi đợt release.', note: 'be used to + V-ing = quen với', trap: 'work', why: '"Be used to" + V-ing (to là giới từ).' },
      { s: 'He promised that he would fix it by Friday.', vi: 'Anh ấy hứa sẽ sửa xong trước thứ Sáu.', note: 'Tường thuật: will → would', trap: 'will', why: 'Câu tường thuật lùi thì: will → would.' },
      { s: 'Avoid making changes on the production server directly.', vi: 'Tránh sửa trực tiếp trên server production.', note: 'avoid + V-ing', trap: 'to', why: '"Avoid" + V-ing.', alt: ['Avoid making changes directly on the production server.'] },
    ],
  },
  {
    id: 'emails',
    title: 'Email & làm việc với khách',
    vi: 'Viết email: mệnh đề quan hệ, câu tường thuật, câu hỏi lồng, V-ing/to V.',
    cefr: 'B1–B2',
    tone: 'green',
    items: [
      { s: 'Thank you for your quick reply.', vi: 'Cảm ơn bạn đã trả lời nhanh.', note: 'Thank you for + N/V-ing', trap: 'to', why: '"Thank you for" + N, không dùng "to".' },
      { s: 'Please find the report attached.', vi: 'Báo cáo được đính kèm theo email này.', note: 'Please find + N + attached: mẫu câu email', trap: 'attach', why: 'Dùng V3 "attached" (được đính kèm).' },
      { s: 'I look forward to hearing from you.', vi: 'Mong sớm nhận được phản hồi từ bạn.', note: 'look forward to + V-ing', trap: 'hear', why: 'Sau "look forward to" dùng V-ing (to là giới từ).' },
      { s: 'Sorry for the late reply.', vi: 'Xin lỗi vì trả lời muộn.', note: 'Sorry for + N; late (tính từ) đứng trước danh từ', trap: 'lately', why: 'Trước danh từ dùng tính từ "late"; "lately" nghĩa là gần đây.' },

      { s: 'I am writing to ask about the invoice.', vi: 'Tôi viết thư này để hỏi về hoá đơn.', note: 'I am writing to + V: mở đầu email', trap: 'asking', why: 'Chỉ mục đích dùng "to + V": to ask.' },
      { s: 'The client who called yesterday wants a refund.', vi: 'Vị khách gọi hôm qua muốn hoàn tiền.', note: 'Mệnh đề quan hệ: who chỉ người', trap: 'which', why: 'Chỉ người dùng "who".' },
      { s: 'He said that the server was down.', vi: 'Anh ấy nói server bị sập.', note: 'Câu tường thuật: lùi thì is → was', trap: 'told', why: '"told" phải có người nghe (told me); ở đây dùng "said".' },
      { s: 'Could you let me know when you are free?', vi: 'Bạn cho tôi biết khi nào bạn rảnh nhé?', note: 'Câu hỏi lồng: when + S + V (không đảo)', trap: 'to', why: 'Sau "let me" dùng nguyên mẫu không "to".' },
      { s: 'I would appreciate it if you could check this.', vi: 'Tôi rất cảm kích nếu bạn kiểm tra giúp việc này.', note: 'I would appreciate it if you could …: nhờ rất lịch sự', trap: 'checking', why: 'Sau "could" dùng nguyên mẫu: check.' },

      { s: 'She asked me whether the bug had been fixed.', vi: 'Cô ấy hỏi tôi lỗi đã được sửa chưa.', note: 'Tường thuật câu hỏi Yes/No: asked + whether + lùi thì', trap: 'has', why: 'Tường thuật lùi thì: had been fixed.' },
      { s: 'The file that you sent me is corrupted.', vi: 'File bạn gửi tôi bị hỏng.', note: 'Mệnh đề quan hệ: that chỉ vật', trap: 'it', why: 'Mệnh đề quan hệ không lặp lại tân ngữ "it".' },
      { s: 'We decided to move the meeting to Friday.', vi: 'Chúng tôi quyết định dời buổi họp sang thứ Sáu.', note: 'decide + to V; move … to + ngày', trap: 'moving', why: '"decide" + to V.' },
      { s: 'Please avoid sending large files by email.', vi: 'Vui lòng tránh gửi file lớn qua email.', note: 'avoid + V-ing; by email: qua email', trap: 'send', why: '"avoid" + V-ing: avoid sending.' },
      { s: 'Do you know when the contract will be signed?', vi: 'Bạn có biết khi nào hợp đồng được ký không?', note: 'Câu hỏi lồng: when + S + will be V3 (không đảo)', trap: 'does', why: '"You" đi với "do".' },
      { s: 'The person I spoke to was very helpful.', vi: 'Người tôi đã nói chuyện rất nhiệt tình.', note: 'Mệnh đề quan hệ rút gọn (bỏ who); giới từ "to" để cuối', trap: 'him', why: 'Không lặp đại từ "him" trong mệnh đề quan hệ.' },

      { s: 'I have attached the document you asked for.', vi: 'Tôi đã đính kèm tài liệu bạn yêu cầu.', note: 'Mệnh đề quan hệ rút gọn; ask for + N, giới từ để cuối', trap: 'it', why: 'Không lặp "it" trong mệnh đề quan hệ.' },
      { s: 'He told us not to change the deadline again.', vi: 'Anh ấy dặn chúng tôi đừng đổi hạn chót nữa.', note: 'tell + người + not to V', trap: 'said', why: '"say" không đi thẳng với người (said us sai); dùng tell + người.' },
      { s: 'Is there anything else that you need from us?', vi: 'Bạn còn cần gì thêm từ chúng tôi không?', note: 'anything else + that + S + V', trap: 'are', why: '"Anything" số ít → Is there.' },
      { s: 'They are considering moving the servers to another region.', vi: 'Họ đang cân nhắc chuyển server sang region khác.', note: 'consider + V-ing', trap: 'move', why: '"consider" + V-ing: considering moving.' },
      { s: 'The manager, whose team built the app, will join the call.', vi: 'Người quản lý, mà team của anh ấy làm ra app, sẽ tham gia cuộc gọi.', note: 'whose + N: chỉ sở hữu', trap: 'who', why: 'Chỉ sở hữu (team của ai) dùng "whose".' },
      { s: 'I am sorry to hear that you had problems with the update.', vi: 'Rất tiếc khi biết bạn gặp vấn đề với bản cập nhật.', note: 'sorry to hear that …; have problems with + N', trap: 'hearing', why: '"sorry" + to V: sorry to hear.' },
      { s: 'We would like to remind you that the payment is due next week.', vi: 'Chúng tôi xin nhắc rằng khoản thanh toán đến hạn vào tuần tới.', note: 'would like to + V; be due: đến hạn', trap: 'reminding', why: '"would like" + to V.' },
    ],
  },
  {
    id: 'advanced',
    title: 'Liên từ, đảo ngữ, câu chẻ',
    vi: 'although, despite, the more… the more…, đảo ngữ, It was … who.',
    cefr: 'B2',
    tone: 'pink',
    items: [
      { s: 'Although it was late, we kept working.', vi: 'Dù đã muộn, chúng tôi vẫn làm tiếp.', note: 'Although + mệnh đề (không kèm but)', trap: 'but', why: '"Although" không đi cùng "but" trong một câu.', alt: ['We kept working although it was late.'] },
      { s: 'I stayed late because of the release.', vi: 'Tôi ở lại muộn vì đợt release.', note: 'because of + danh từ', alt: ['Because of the release I stayed late.'] },
      { s: 'We write tests so that bugs are caught early.', vi: 'Chúng tôi viết test để bắt lỗi sớm.', note: 'so that + mệnh đề: để mà' },
      { s: 'Unless you object, I will merge it.', vi: 'Nếu bạn không phản đối, tôi sẽ merge.', note: 'Unless = If … not', alt: ['I will merge it unless you object.'] },

      { s: 'Despite the bugs, the launch was successful.', vi: 'Dù có lỗi, buổi ra mắt vẫn thành công.', note: 'Despite + danh từ', trap: 'although', why: '"Although" cần cả mệnh đề (S + V); trước danh từ dùng "despite".', alt: ['The launch was successful despite the bugs.'] },
      { s: 'The more you practice, the better you get.', vi: 'Càng luyện càng giỏi.', note: 'The + so sánh hơn …, the + so sánh hơn …', trap: 'best', why: 'Cấu trúc "càng… càng…" dùng so sánh hơn: better, không phải best.' },
      { s: 'Not only is it fast, but it is also cheap.', vi: 'Nó không chỉ nhanh mà còn rẻ.', note: 'Not only + đảo ngữ (is it), but … also' },
      { s: 'In case the server fails, we keep a backup.', vi: 'Phòng khi server hỏng, chúng tôi giữ bản backup.', note: 'In case + hiện tại: phòng khi', alt: ['We keep a backup in case the server fails.'] },
      { s: 'Whether you like it or not, we must upgrade.', vi: 'Dù bạn thích hay không, chúng ta phải nâng cấp.', note: 'Whether … or not', trap: 'if', why: 'Đi với "or not" ở đầu câu dùng "whether".', alt: ['We must upgrade whether you like it or not.'] },

      { s: 'Had I known about it, I would have helped.', vi: 'Nếu biết chuyện đó, tôi đã giúp rồi.', note: 'Đảo ngữ loại 3: Had + S + V3', trap: 'if', why: 'Đảo ngữ "Had I known" đã thay cho "If I had known", không thêm "if".', alt: ['I would have helped had I known about it.'] },
      { s: 'Never have I seen such clean code.', vi: 'Chưa bao giờ tôi thấy code sạch như vậy.', note: 'Never + have + S + V3 (đảo ngữ)', trap: 'did', why: 'Đi với V3 (seen) nên trợ động từ là "have": Never have I seen.' },
      { s: 'It was Minh who found the security hole.', vi: 'Chính Minh là người phát hiện lỗ hổng bảo mật.', note: 'Câu chẻ: It was + người + who …', trap: 'which', why: 'Nhấn mạnh người dùng "who".' },
      { s: 'What we need is a better test strategy.', vi: 'Thứ chúng ta cần là chiến lược test tốt hơn.', note: 'Câu chẻ: What + S + V + is …', trap: 'are', why: 'Mệnh đề What làm chủ ngữ số ít → is.' },
      { s: 'Should you have any questions, please contact me.', vi: 'Nếu có thắc mắc, vui lòng liên hệ tôi.', note: 'Đảo ngữ loại 1 trang trọng: Should + S + V', alt: ['Please contact me should you have any questions.'] },
      { s: 'No sooner had we launched than the site crashed.', vi: 'Vừa ra mắt xong thì trang web sập.', note: 'No sooner had + S + V3 … than', trap: 'then', why: '"No sooner" đi với "than", không phải "then".' },

      { s: 'Only after the outage did we add proper monitoring.', vi: 'Chỉ sau sự cố chúng tôi mới thêm giám sát tử tế.', note: 'Only after + N + did + S + V', trap: 'added', why: 'Đảo ngữ với "did" thì động từ chính về nguyên mẫu: did we add.' },
      { s: 'Hardly had the meeting started when the power went out.', vi: 'Cuộc họp vừa bắt đầu thì mất điện.', note: 'Hardly had + S + V3 … when', trap: 'than', why: '"Hardly" đi với "when"; "than" là của "No sooner".' },
      { s: 'Rarely do we get such clear requirements from clients.', vi: 'Hiếm khi khách đưa yêu cầu rõ ràng như vậy.', note: 'Rarely + do + S + V', trap: 'does', why: '"We" đi với "do".' },
      { s: 'She talks as if she were the project manager.', vi: 'Cô ấy nói như thể mình là quản lý dự án.', note: 'as if + were: giả định trái thực tế' },
      { s: "I'd rather you didn't share this outside the team.", vi: 'Tôi mong bạn đừng chia sẻ chuyện này ra ngoài team.', note: "would rather + S + quá khứ đơn", trap: "don't", why: '"I\'d rather + người khác" thì động từ lùi về quá khứ: didn\'t share.' },
      { s: 'Little did we know that the bug was in our code.', vi: 'Chúng tôi đâu ngờ lỗi nằm trong code của mình.', note: 'Little did + S + V nguyên mẫu', trap: 'knew', why: 'Đảo ngữ với "did" → know (nguyên mẫu).' },
      { s: 'Not until the client complained did we notice the issue.', vi: 'Mãi đến khi khách phàn nàn chúng tôi mới thấy lỗi.', note: 'Not until … + did + S + V', trap: 'noticed', why: 'Sau "did" dùng nguyên mẫu: notice.' },
    ],
  },
  {
    id: 'interview',
    title: 'Phỏng vấn & thuyết trình',
    vi: 'Nói về bản thân và dự án: V-ing/to V, câu chẻ, đảo ngữ, điều kiện loại 3, Having V3.',
    cefr: 'B2',
    tone: 'pink',
    items: [
      { s: 'I enjoy solving difficult problems.', vi: 'Tôi thích giải các bài toán khó.', note: 'enjoy + V-ing', trap: 'to', why: '"enjoy" + V-ing, không dùng "to".' },
      { s: 'What are your biggest strengths?', vi: 'Điểm mạnh lớn nhất của bạn là gì?', note: 'So sánh nhất: your biggest + N', trap: 'is', why: '"Strengths" số nhiều → are.' },
      { s: "I'm used to working under pressure.", vi: 'Tôi quen làm việc dưới áp lực.', note: 'be used to + V-ing: quen với', trap: 'work', why: '"be used to" + V-ing (to là giới từ).' },
      { s: 'Why do you want to join us?', vi: 'Sao bạn muốn về đội chúng tôi?', note: 'want + to V', trap: 'joining', why: '"want" + to V.' },

      { s: 'I led a team of five engineers.', vi: 'Tôi từng dẫn dắt một team năm kỹ sư.', note: 'lead → led (bất quy tắc)', trap: 'leaded', why: '"lead" bất quy tắc: led.' },
      { s: 'How do you handle conflicts within a team?', vi: 'Bạn xử lý mâu thuẫn trong team thế nào?', note: 'How + do + S + V?', trap: 'handling', why: 'Sau "do" dùng nguyên mẫu: handle.' },
      { s: 'Where do you see yourself in five years?', vi: 'Năm năm nữa bạn thấy mình ở đâu?', note: 'in + khoảng thời gian: sau … nữa (tương lai)', trap: 'does', why: '"You" đi với "do".' },
      { s: 'I would describe myself as a fast learner.', vi: 'Tôi tự nhận mình là người học nhanh.', note: 'describe + O + as + N', trap: 'like', why: '"Mô tả là" dùng describe … as, không dùng like.' },
      { s: 'Could you walk me through your last project?', vi: 'Bạn kể chi tiết về dự án gần nhất được không?', note: 'walk sb through sth: trình bày từng bước', trap: 'walking', why: 'Sau "could" dùng nguyên mẫu: walk.' },

      { s: 'I am looking for a role where I can grow.', vi: 'Tôi đang tìm một vị trí có thể phát triển.', note: 'where + mệnh đề đầy đủ (I can grow) chỉ hoàn cảnh', trap: 'which', why: 'Vế sau đã đủ S + V nên dùng "where", không dùng "which".' },
      { s: 'What I enjoy most is learning new technologies.', vi: 'Điều tôi thích nhất là học công nghệ mới.', note: 'Câu chẻ: What + S + V + is …', trap: 'are', why: 'Mệnh đề What làm chủ ngữ số ít → is.' },
      { s: 'Thank you for taking the time to meet me.', vi: 'Cảm ơn bạn đã dành thời gian gặp tôi.', note: 'take the time to V; meet + người', trap: 'with', why: '"Gặp ai" là "meet + người", không cần "with".' },
      { s: 'I have been working as a developer for six years.', vi: 'Tôi làm lập trình viên được sáu năm rồi.', note: 'Hiện tại hoàn thành tiếp diễn + for + khoảng thời gian', trap: 'since', why: 'Trước khoảng thời gian (six years) dùng "for".', alt: ['For six years I have been working as a developer.'] },
      { s: 'Despite having little experience, she got the job.', vi: 'Dù ít kinh nghiệm, cô ấy vẫn được nhận.', note: 'Despite + V-ing', trap: 'although', why: '"Although" cần mệnh đề (S + V); trước V-ing dùng "despite".', alt: ['She got the job despite having little experience.'] },
      { s: 'It is the people that make this company special.', vi: 'Chính con người làm nên sự đặc biệt của công ty này.', note: 'Câu chẻ: It is … that …; make + O + tính từ', trap: 'makes', why: '"The people" số nhiều → make.' },

      { s: 'Having worked at a startup, I can adapt quickly.', vi: 'Từng làm ở startup nên tôi thích nghi nhanh.', note: 'Having + V3: rút gọn mệnh đề (vì đã từng)', trap: 'quick', why: 'Bổ nghĩa cho động từ dùng trạng từ: quickly.' },
      { s: 'Rarely have I met such a supportive manager.', vi: 'Hiếm khi tôi gặp người quản lý tận tâm như vậy.', note: 'Rarely + have + S + V3 (đảo ngữ)', trap: 'did', why: 'Đi với V3 (met) dùng "have": Rarely have I met.' },
      { s: 'So complex was the system that nobody understood it.', vi: 'Hệ thống phức tạp đến mức không ai hiểu nổi.', note: 'So + tính từ + be + S + that: đảo ngữ nhấn mạnh', trap: 'such', why: 'Trước tính từ đứng một mình dùng "so".', alt: ['The system was so complex that nobody understood it.'] },
      { s: 'The reason I left was the lack of growth.', vi: 'Lý do tôi nghỉ là không có cơ hội phát triển.', note: 'The reason (why) + S + V + was + N', trap: 'because', why: 'Đã có "The reason … was" thì không thêm "because".' },
      { s: 'Not only did I build the API, but I also designed the database.', vi: 'Tôi không chỉ xây API mà còn thiết kế database.', note: 'Not only + did + S + V, but … also', trap: 'built', why: 'Sau "did" dùng nguyên mẫu: build.' },
      { s: 'If I had not changed jobs, I would not have learned so much.', vi: 'Nếu không đổi việc, tôi đã không học được nhiều đến thế.', note: 'Điều kiện loại 3: If + had V3, would have V3', trap: 'will', why: 'Điều kiện loại 3 dùng "would have".', alt: ['I would not have learned so much if I had not changed jobs.'] },
      { s: 'It was not until I joined this team that I understood testing.', vi: 'Mãi đến khi vào team này tôi mới hiểu về test.', note: 'It was not until … that + S + V (không đảo)', trap: 'did', why: 'Cấu trúc "It was not until … that" không đảo ngữ.' },
    ],
  },
];

export const sentenceKey = (w: number, i: number) => `${WORLDS[w].id}:${i}`;

export function sentenceByKey(key: string): { w: number; i: number; item: Sentence } | null {
  const [id, idx] = key.split(':');
  const w = WORLDS.findIndex((x) => x.id === id);
  const i = Number(idx);
  if (w < 0 || !WORLDS[w].items[i]) return null;
  return { w, i, item: WORLDS[w].items[i] };
}
