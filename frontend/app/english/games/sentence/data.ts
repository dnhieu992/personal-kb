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
];

export const sentenceKey = (w: number, i: number) => `${WORLDS[w].id}:${i}`;

export function sentenceByKey(key: string): { w: number; i: number; item: Sentence } | null {
  const [id, idx] = key.split(':');
  const w = WORLDS.findIndex((x) => x.id === id);
  const i = Number(idx);
  if (w < 0 || !WORLDS[w].items[i]) return null;
  return { w, i, item: WORLDS[w].items[i] };
}
