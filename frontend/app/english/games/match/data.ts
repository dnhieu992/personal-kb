/**
 * Content for the "Nối từ" (match) game. Each world teaches one kind of pairing,
 * from single words up to advanced sentence structures. Pairs are ordered: the
 * levels of a world take consecutive slices (see SLICES in levels.ts), the boss
 * mixes all of them.
 *
 * `trap` is a tempting WRONG right-hand side — usually a mistake Vietnamese
 * speakers make — shown as a decoy from level 3 on; `why` explains it when picked.
 * A trap must not be a correct match for any other left side in its world.
 */

export type Kind = 'vocab' | 'sentence' | 'qa';

export interface Pair {
  l: string;
  r: string;
  /** Vietnamese meaning of the whole pair (sentence worlds). */
  vi?: string;
  /** Example sentence (vocab world) — what gets read aloud. */
  ex?: string;
  /** The structure / rule this pair teaches. */
  note?: string;
  trap?: string;
  why?: string;
}

export interface World {
  id: string;
  title: string;
  vi: string;
  cefr: string;
  kind: Kind;
  /** Decoys whose first word equals another answer's first word are skipped (prepositions). */
  strictTraps?: boolean;
  tone: string;
  pairs: Pair[];
}

export const WORLDS: World[] = [
  {
    id: 'vocab',
    title: 'Từ vựng IT',
    vi: 'Nối từ tiếng Anh với nghĩa — nền móng cho mọi câu.',
    cefr: 'A2',
    kind: 'vocab',
    tone: 'sky',
    pairs: [
      { l: 'deploy', r: 'triển khai lên môi trường chạy', ex: 'We deploy to production every Friday.' },
      { l: 'bug', r: 'lỗi trong phần mềm', ex: 'I found a bug in the login form.' },
      { l: 'release', r: 'bản phát hành', ex: 'The next release ships on Monday.' },
      { l: 'requirement', r: 'yêu cầu chức năng', ex: "Let's clarify the requirements first." },

      { l: 'deadline', r: 'hạn chót', ex: 'The deadline is next Friday.' },
      { l: 'feature', r: 'tính năng', ex: 'This feature is still in beta.' },
      { l: 'rollback', r: 'quay về bản trước đó', ex: 'We did a rollback after the outage.' },
      { l: 'outage', r: 'sự cố ngừng dịch vụ', ex: 'The outage lasted two hours.' },
      { l: 'estimate', r: 'ước lượng thời gian, công sức', ex: 'Can you estimate this task?' },

      {
        l: 'deprecated',
        r: 'không nên dùng nữa, sắp bị bỏ',
        ex: 'This endpoint is deprecated. Use v2 instead.',
        trap: 'đã bị xoá khỏi hệ thống',
        why: '"Deprecated" vẫn còn chạy được, chỉ là không nên dùng nữa vì sẽ bị bỏ sau. Đã xoá rồi thì là "removed".',
      },
      { l: 'bottleneck', r: 'điểm nghẽn hiệu năng', ex: 'The database is the bottleneck.' },
      {
        l: 'workaround',
        r: 'cách xử lý tạm thời',
        ex: "It's only a workaround, not a real fix.",
        trap: 'bản sửa lỗi triệt để',
        why: '"Workaround" là đi đường vòng cho qua chuyện. Sửa tận gốc là "a proper fix" / "a permanent fix".',
      },
      { l: 'backlog', r: 'danh sách việc chờ làm', ex: 'Add it to the backlog.' },
      { l: 'stakeholder', r: 'bên liên quan, có quyền lợi', ex: 'We need approval from all stakeholders.' },
      { l: 'scalable', r: 'mở rộng quy mô được', ex: 'Is this design scalable?' },

      { l: 'maintainable', r: 'dễ bảo trì', ex: 'Keep the code clean and maintainable.' },
      { l: 'legacy code', r: 'code cũ để lại', ex: 'Nobody wants to touch the legacy code.' },
      {
        l: 'edge case',
        r: 'trường hợp biên, hiếm gặp',
        ex: 'Did you handle the edge cases?',
        trap: 'trường hợp thường gặp nhất',
        why: '"Edge case" nằm ở rìa: input rỗng, số âm, dữ liệu cực lớn. Trường hợp phổ biến là "the common case" / "the happy path".',
      },
      { l: 'trade-off', r: 'sự đánh đổi', ex: 'Every design has trade-offs.' },
      { l: 'root cause', r: 'nguyên nhân gốc rễ', ex: "We still don't know the root cause." },
      { l: 'sign-off', r: 'sự phê duyệt chính thức', ex: 'We got sign-off from the product owner.' },
      {
        l: 'throughput',
        r: 'số việc xử lý được mỗi giây',
        ex: 'Throughput doubled after the fix.',
        trap: 'độ trễ của mỗi request',
        why: 'Độ trễ là "latency". "Throughput" là lưu lượng: hệ thống xử lý được bao nhiêu request mỗi giây.',
      },
    ],
  },
  {
    id: 'collocations',
    title: 'Cụm từ đi liền',
    vi: 'Động từ nào đi với danh từ nào: make a decision chứ không phải do a decision.',
    cefr: 'A2–B1',
    kind: 'sentence',
    tone: 'teal',
    pairs: [
      { l: 'make', r: 'a decision', vi: 'đưa ra quyết định', note: 'make + decision / plan / mistake / progress' },
      { l: 'take', r: 'a break', vi: 'nghỉ giải lao', note: 'take + a break / a look / notes' },
      { l: 'fix', r: 'a bug', vi: 'sửa một lỗi', note: 'fix + bug / issue / problem' },
      { l: 'attend', r: 'a meeting', vi: 'tham dự cuộc họp', note: 'attend + meeting (không có "to": attend to = xử lý)' },

      { l: 'do', r: 'a code review', vi: 'review code', note: 'do + công việc / nhiệm vụ: do a review, do research', trap: 'some researches', why: '"Research" không đếm được: do some research, không có "researches".' },
      { l: 'raise', r: 'a concern', vi: 'nêu lên mối lo ngại', note: 'raise + a concern / a question / an issue' },
      { l: 'meet', r: 'the deadline', vi: 'kịp hạn chót', note: 'meet / miss the deadline' },
      { l: 'run', r: 'the tests', vi: 'chạy test', note: 'run + tests / a script / a query' },
      { l: 'push', r: 'your changes to the branch', vi: 'đẩy thay đổi lên nhánh', note: 'push / commit / revert + changes' },

      {
        l: 'give',
        r: 'some feedback',
        vi: 'góp ý',
        note: 'feedback không đếm được: some feedback / a piece of feedback',
        trap: 'a feedback',
        why: '"Feedback" không đếm được nên không đi với "a". Nói "some feedback" hoặc "a piece of feedback".',
      },
      {
        l: 'gain',
        r: 'experience',
        vi: 'tích luỹ kinh nghiệm',
        note: 'experience (kinh nghiệm chung) không đếm được',
        trap: 'many experiences in Java',
        why: 'Nói về kinh nghiệm làm việc thì "experience" không đếm được: "a lot of experience in Java". "Experiences" là những trải nghiệm, sự kiện.',
      },
      { l: 'set up', r: 'a new environment', vi: 'thiết lập môi trường mới', note: 'set up (động từ) ↔ setup (danh từ)' },
      { l: 'reach', r: 'an agreement', vi: 'đạt được thoả thuận', note: 'reach + an agreement / a decision / a goal' },
      { l: 'turn on', r: 'your camera', vi: 'bật camera', note: 'turn on / turn off + thiết bị' },
      { l: 'handle', r: 'the request', vi: 'xử lý request', note: 'handle + request / error / traffic' },

      { l: 'conduct', r: 'an interview', vi: 'tiến hành phỏng vấn', note: 'conduct (trang trọng) + interview / survey / audit' },
      { l: 'address', r: 'the root cause', vi: 'xử lý nguyên nhân gốc', note: 'address (động từ) = giải quyết, xử lý' },
      { l: 'hit', r: 'the rate limit', vi: 'chạm giới hạn số request', note: 'hit + a limit / a wall / a bug' },
      { l: 'pay', r: 'attention to details', vi: 'chú ý đến chi tiết', note: 'pay attention to + N' },
      { l: 'draw', r: 'a conclusion', vi: 'rút ra kết luận', note: 'draw a conclusion (không dùng make)' },
      {
        l: 'provide',
        r: 'more information',
        vi: 'cung cấp thêm thông tin',
        note: 'information không đếm được',
        trap: 'more informations',
        why: '"Information" không đếm được, không bao giờ thêm "s".',
      },
      {
        l: 'make',
        r: 'progress',
        vi: 'có tiến triển',
        note: 'make progress, progress không đếm được',
        trap: 'a progress',
        why: '"Progress" không đếm được: "make progress" / "make good progress", không có "a progress".',
      },
    ],
  },
  {
    id: 'prepositions',
    title: 'Giới từ & cụm động từ',
    vi: 'depend on, good at, look into… nhầm một giới từ là sai cả câu.',
    cefr: 'B1',
    kind: 'sentence',
    strictTraps: true,
    tone: 'violet',
    pairs: [
      { l: 'It depends', r: 'on the network.', vi: 'Còn tuỳ vào mạng.', note: 'depend on + N', trap: 'of the network.', why: 'Luôn là "depend on", không dùng "of".' },
      { l: 'She is good', r: 'at debugging.', vi: 'Cô ấy giỏi debug.', note: 'good at + V-ing / N', trap: 'in debugging.', why: '"Good at" chứ không phải "good in" (dịch thẳng từ "giỏi trong" là sai).' },
      { l: "I'm interested", r: 'in machine learning.', vi: 'Tôi quan tâm đến machine learning.', note: 'interested in + N / V-ing', trap: 'about machine learning.', why: '"Interested in", không dùng "about" hay "with".' },
      { l: 'Who is responsible', r: 'for the release?', vi: 'Ai chịu trách nhiệm bản phát hành?', note: 'responsible for + N', trap: 'of the release?', why: '"Responsible for", không dùng "of".' },

      { l: "I'll look", r: 'into the issue.', vi: 'Tôi sẽ điều tra vấn đề.', note: 'look into = điều tra, tìm hiểu' },
      { l: "We're waiting", r: 'for the build to finish.', vi: 'Chúng tôi đang chờ build xong.', note: 'wait for + N', trap: 'the build to finish.', why: '"Wait" cần "for" trước tân ngữ: wait for something.' },
      { l: 'I agree', r: 'with your suggestion.', vi: 'Tôi đồng ý với đề xuất của bạn.', note: 'agree with + người / ý kiến' },
      { l: 'Please reply', r: "to the client's email.", vi: 'Hãy trả lời email của khách.', note: 'reply to + N (answer thì không cần "to")', trap: "the client's email.", why: '"Reply" phải có "to": reply to an email. Bỏ "to" thì dùng "answer the email".' },
      { l: 'The system consists', r: 'of three microservices.', vi: 'Hệ thống gồm ba microservice.', note: 'consist of = gồm có (không dùng bị động)' },

      { l: 'We finally figured', r: 'out the problem.', vi: 'Cuối cùng chúng tôi đã tìm ra vấn đề.', note: 'figure out = tìm ra, hiểu ra' },
      { l: 'Can you set', r: 'up the CI pipeline?', vi: 'Bạn thiết lập CI pipeline được không?', note: 'set up = thiết lập' },
      { l: "Let's roll", r: 'back to the previous version.', vi: 'Hãy quay về phiên bản trước.', note: 'roll back = khôi phục bản cũ' },
      { l: 'She came', r: 'up with a better solution.', vi: 'Cô ấy đã nghĩ ra giải pháp tốt hơn.', note: 'come up with = nghĩ ra' },
      { l: 'The server ran', r: 'out of disk space.', vi: 'Server đã hết dung lượng ổ đĩa.', note: 'run out of + N = hết', trap: 'out disk space.', why: 'Phải có "of": run out of something.' },
      { l: 'Are you familiar', r: 'with Docker?', vi: 'Bạn có quen với Docker không?', note: 'familiar with + N', trap: 'about Docker?', why: '"Familiar with", không dùng "about".' },

      { l: 'I can’t log', r: 'into the admin dashboard.', vi: 'Tôi không đăng nhập được trang quản trị.', note: 'log into / log in to + hệ thống', trap: 'in the admin dashboard.', why: 'Đăng nhập VÀO hệ thống: "log into" hoặc "log in to", không phải "log in the".' },
      { l: "Let's carry", r: 'on with the migration.', vi: 'Hãy tiếp tục việc migrate.', note: 'carry on with + N = tiếp tục' },
      { l: 'Break', r: 'down the task into smaller tickets.', vi: 'Chia nhỏ task thành các ticket nhỏ hơn.', note: 'break down = chia nhỏ' },
      { l: 'He pointed', r: 'out a mistake in my PR.', vi: 'Anh ấy chỉ ra một lỗi trong PR của tôi.', note: 'point out = chỉ ra' },
      { l: 'I need to catch', r: 'up on the latest changes.', vi: 'Tôi cần cập nhật những thay đổi mới nhất.', note: 'catch up on + N = cập nhật cái đã bỏ lỡ', trap: 'up the latest changes.', why: '"Catch up" cần giới từ trước tân ngữ: catch up on / catch up with.' },
      { l: "Let's put", r: 'off the meeting until Friday.', vi: 'Hãy hoãn cuộc họp đến thứ Sáu.', note: 'put off = hoãn lại' },
      { l: 'We should get', r: 'rid of unused dependencies.', vi: 'Chúng ta nên bỏ các dependency không dùng.', note: 'get rid of = loại bỏ' },
    ],
  },
  {
    id: 'structures',
    title: 'Ghép nửa câu: ngữ pháp',
    vi: 'Thì, câu điều kiện, bị động, mệnh đề quan hệ: ghép đúng là hiểu cấu trúc.',
    cefr: 'B1',
    kind: 'sentence',
    tone: 'amber',
    pairs: [
      { l: 'I have worked here', r: 'since 2021.', vi: 'Tôi làm ở đây từ năm 2021.', note: 'Hiện tại hoàn thành + since + mốc thời gian', trap: 'since three years.', why: '"Since" đi với mốc (since 2021), "for" đi với khoảng thời gian (for three years).' },
      { l: 'She is fixing the login bug', r: "right now, so don't disturb her.", vi: 'Cô ấy đang sửa lỗi đăng nhập, đừng làm phiền.', note: 'Hiện tại tiếp diễn: việc đang diễn ra lúc nói' },
      { l: 'We released version 2.0', r: 'last Monday.', vi: 'Chúng tôi phát hành bản 2.0 thứ Hai tuần trước.', note: 'Quá khứ đơn + mốc thời gian đã qua (last…, ago, yesterday)' },
      { l: 'The server usually restarts', r: 'at 2 a.m. every night.', vi: 'Server thường khởi động lại lúc 2 giờ sáng mỗi đêm.', note: 'Hiện tại đơn + trạng từ tần suất: thói quen, lịch cố định' },

      { l: 'If the tests fail,', r: 'the pipeline stops automatically.', vi: 'Nếu test lỗi, pipeline tự dừng.', note: 'Điều kiện loại 0 (luôn đúng): If + HTĐ, HTĐ' },
      { l: 'If you push before noon,', r: 'I will review it today.', vi: 'Nếu bạn push trước trưa, tôi sẽ review hôm nay.', note: 'Điều kiện loại 1: If + HTĐ, will + V', trap: 'I would have reviewed it today.', why: '"Push" ở hiện tại đơn là loại 1 (có thể xảy ra), vế sau dùng "will + V".' },
      { l: "I'm going to refactor this module", r: "because it's hard to test.", vi: 'Tôi định refactor module này vì nó khó test.', note: 'be going to + V: dự định đã có từ trước' },
      { l: "Don't merge the PR", r: 'until the CI is green.', vi: 'Đừng merge PR cho đến khi CI xanh.', note: 'until / when / after + HTĐ (không dùng will)', trap: 'until the CI will be green.', why: 'Sau until / when / as soon as dùng hiện tại đơn để nói về tương lai, không dùng "will".' },
      { l: 'By the time you read this,', r: 'I will have finished the migration.', vi: 'Khi bạn đọc được cái này thì tôi đã migrate xong.', note: 'Tương lai hoàn thành: will have + V3, xong trước một mốc tương lai' },

      { l: 'If I had more time,', r: 'I would write more tests.', vi: 'Nếu có thêm thời gian, tôi sẽ viết thêm test.', note: 'Điều kiện loại 2 (trái hiện tại): If + QKĐ, would + V', trap: 'I will write more tests.', why: '"Had" ở vế If là giả định trái hiện tại (loại 2), vế sau phải là "would + V".' },
      { l: 'If we had tested it properly,', r: "the outage wouldn't have happened.", vi: 'Nếu test kỹ thì đã không có sự cố.', note: 'Điều kiện loại 3 (trái quá khứ): If + had V3, would have V3', trap: "the outage wouldn't happen.", why: 'Loại 3 nói về quá khứ: vế sau là "would have + V3".' },
      { l: 'I wish', r: 'I knew more about Kubernetes.', vi: 'Ước gì tôi biết nhiều hơn về Kubernetes.', note: 'wish + QKĐ: ước điều trái với hiện tại', trap: 'I know more about Kubernetes.', why: 'Sau "wish" lùi một thì: hiện tại → quá khứ (I knew).' },
      { l: 'The bug was reported', r: 'by a customer yesterday.', vi: 'Lỗi được một khách hàng báo hôm qua.', note: 'Bị động quá khứ: was/were + V3 (+ by …)' },
      { l: 'All passwords must be', r: 'encrypted before saving.', vi: 'Mọi mật khẩu phải được mã hoá trước khi lưu.', note: 'Bị động với động từ khuyết thiếu: must be + V3', trap: 'encrypt before saving.', why: 'Sau "must be" cần V3 (bị động): must be encrypted.' },
      { l: "It's time we", r: 'upgraded to the new framework.', vi: 'Đã đến lúc chúng ta nâng cấp framework.', note: "It's time + S + QKĐ: đã đến lúc nên làm" },

      { l: 'The developer who wrote this function', r: 'has left the company.', vi: 'Người viết hàm này đã nghỉ việc.', note: 'Mệnh đề quan hệ "who" bổ nghĩa cho người' },
      { l: 'This is the service', r: 'that handles all payments.', vi: 'Đây là service xử lý mọi khoản thanh toán.', note: '"that / which" cho vật', trap: 'who handles all payments.', why: '"Who" chỉ dùng cho người; service là vật → "that" hoặc "which".' },
      { l: 'She asked me', r: 'whether I had finished the report.', vi: 'Cô ấy hỏi tôi đã xong báo cáo chưa.', note: 'Tường thuật câu hỏi Yes/No: asked + whether/if + lùi thì' },
      { l: "I'm looking forward to", r: 'working with your team.', vi: 'Tôi mong được làm việc với đội của bạn.', note: 'look forward to + V-ing ("to" là giới từ)', trap: 'work with your team.', why: 'Trong "look forward to", "to" là giới từ nên theo sau là V-ing.' },
      { l: 'We decided', r: 'to postpone the release.', vi: 'Chúng tôi quyết định hoãn bản phát hành.', note: 'decide + to V', trap: 'postponing the release.', why: '"Decide" đi với "to V": decided to postpone.' },
      { l: 'Would you mind', r: 'reviewing my pull request?', vi: 'Phiền bạn review pull request của tôi được không?', note: 'Would you mind + V-ing?: nhờ vả lịch sự', trap: 'to review my pull request?', why: '"Mind" đi với V-ing: Would you mind reviewing…?' },
      { l: 'This is the first time', r: 'I have used GraphQL.', vi: 'Đây là lần đầu tôi dùng GraphQL.', note: 'This is the first time + HTHT', trap: 'I use GraphQL.', why: 'Sau "This is the first time" dùng hiện tại hoàn thành: I have used.' },
    ],
  },
  {
    id: 'conversation',
    title: 'Hỏi – đáp công sở',
    vi: 'Ghép câu hỏi với câu trả lời tự nhiên: stand-up, review, họp hành.',
    cefr: 'B1–B2',
    kind: 'qa',
    tone: 'green',
    pairs: [
      { l: 'How long will it take?', r: 'About two days, I think.', vi: 'Mất bao lâu? Khoảng hai ngày, tôi nghĩ vậy.', note: 'How long…? hỏi khoảng thời gian' },
      { l: 'Who is working on this ticket?', r: 'Minh is. He picked it up yesterday.', vi: 'Ai đang làm ticket này? Minh. Hôm qua anh ấy nhận rồi.', note: 'Trả lời câu hỏi Who bằng S + trợ động từ (Minh is.)' },
      { l: 'Where can I find the API docs?', r: "They're on the team wiki.", vi: 'Tài liệu API ở đâu? Trên wiki của team.', note: 'Where…? trả lời bằng địa điểm (on the wiki, in the repo)' },
      { l: 'When is the demo?', r: "It's on Thursday at 3 p.m.", vi: 'Khi nào demo? Thứ Năm lúc 3 giờ chiều.', note: 'on + thứ/ngày, at + giờ' },

      { l: "What's blocking you?", r: "I'm waiting for access to the database.", vi: 'Cái gì đang chặn bạn? Tôi đang chờ quyền truy cập database.', note: 'blocker = thứ cản trở công việc (dùng nhiều ở stand-up)' },
      { l: 'Could you share your screen?', r: 'Sure, give me a second.', vi: 'Bạn chia sẻ màn hình được không? Được, chờ tôi chút.', note: 'Could you…? = nhờ lịch sự → Sure / Of course' },
      { l: 'Have you deployed the hotfix yet?', r: "Not yet. I'll do it after lunch.", vi: 'Bạn deploy hotfix chưa? Chưa, sau bữa trưa tôi làm.', note: 'Have you … yet? → Not yet / Yes, I already have' },
      { l: 'Why did the build fail?', r: 'Because a dependency was missing.', vi: 'Sao build lỗi? Vì thiếu một dependency.', note: 'Why…? → Because + mệnh đề' },
      {
        l: 'Do you mind if I join the call late?',
        r: 'Not at all, go ahead.',
        vi: 'Tôi vào họp muộn có phiền không? Không sao, cứ tự nhiên.',
        note: 'Do you mind if…? → "Not at all" = đồng ý',
        trap: 'Yes, go ahead.',
        why: '"Do you mind?" nghĩa là "bạn có phiền không?". Trả lời "Yes" là CÓ phiền, tức từ chối. Muốn đồng ý thì nói "Not at all".',
      },

      { l: 'Sorry, could you repeat that?', r: 'Of course. I said the release is delayed.', vi: 'Xin lỗi, nhắc lại được không? Được, tôi nói bản phát hành bị hoãn.', note: 'Xin nhắc lại lịch sự: Sorry, could you repeat that?' },
      { l: 'What do you think about this approach?', r: 'It looks good, but it might be hard to scale.', vi: 'Bạn thấy cách này thế nào? Ổn, nhưng có thể khó mở rộng.', note: 'Góp ý lịch sự: khen trước, nêu lo ngại sau với "might"' },
      { l: 'Can we push the meeting to tomorrow?', r: 'That works for me.', vi: 'Dời cuộc họp sang mai được không? Tôi ok.', note: 'push (a meeting) = dời lịch; That works for me = tôi ok' },
      { l: 'Is this bug a blocker for the release?', r: "No, it's minor. We can fix it next sprint.", vi: 'Lỗi này có chặn release không? Không, nhỏ thôi, sprint sau sửa.', note: 'minor / major / critical: mức độ nghiêm trọng' },
      {
        l: "How's the migration going?",
        r: "So far so good. We're about 70% done.",
        vi: 'Migrate tới đâu rồi? Đến giờ vẫn ổn, xong khoảng 70%.',
        note: "How's … going? hỏi tiến độ → So far so good / It's going well",
        trap: 'It goes well.',
        why: 'Hỏi bằng tiếp diễn ("is going") thì trả lời "It\'s going well", không dùng hiện tại đơn "It goes well".',
      },
      {
        l: 'Thanks for your help!',
        r: 'No problem. Happy to help.',
        vi: 'Cảm ơn đã giúp! Không có gì, sẵn lòng.',
        note: 'Đáp lời cảm ơn: No problem / You’re welcome / Happy to help',
        trap: 'Never mind.',
        why: '"Never mind" nghĩa là "thôi bỏ qua đi", dùng khi ai đó xin lỗi hoặc khi bạn không cần nữa, không dùng để đáp lời cảm ơn.',
      },

      {
        l: 'Could you walk me through the code?',
        r: "Sure. Let's start with the entry point.",
        vi: 'Bạn giải thích code giúp tôi được không? Được, bắt đầu từ entry point nhé.',
        note: 'walk sb through sth = giải thích từng bước',
        trap: "Sure, let's walk to the office together.",
        why: '"Walk sb through sth" là giải thích từng bước cho ai đó, không phải đi bộ.',
      },
      { l: 'Are we on track for the deadline?', r: 'Mostly, but the payment part is behind schedule.', vi: 'Có kịp hạn không? Phần lớn kịp, nhưng phần thanh toán đang chậm.', note: 'on track (đúng tiến độ) ↔ behind schedule (chậm tiến độ)' },
      {
        l: "Why don't we add a retry?",
        r: 'Good idea, that should fix the timeouts.',
        vi: 'Sao mình không thêm retry nhỉ? Ý hay, chắc sẽ hết timeout.',
        note: '"Why don\'t we…?" là lời gợi ý, không phải hỏi lý do',
        trap: "Because we don't have time.",
        why: '"Why don\'t we…?" là lời đề nghị ("hay là mình…"), không hỏi lý do, nên không trả lời bằng "Because".',
      },
      { l: 'Who signed off on this change?', r: 'The tech lead approved it on Monday.', vi: 'Ai duyệt thay đổi này? Tech lead duyệt hôm thứ Hai.', note: 'sign off on sth = phê duyệt' },
      { l: "I'm afraid I can't make it to the meeting.", r: "No worries. I'll send you the notes.", vi: 'Tôi e là không dự họp được. Không sao, tôi sẽ gửi biên bản.', note: "I'm afraid… = báo tin xấu lịch sự; make it = đến / tham dự được" },
      { l: 'Would it be possible to extend the deadline?', r: "I'll check with the PM and get back to you.", vi: 'Có thể lùi hạn không? Tôi sẽ hỏi PM rồi báo lại bạn.', note: 'get back to sb = phản hồi lại sau' },
      {
        l: "Let's call it a day.",
        r: 'Sounds good. See you tomorrow!',
        vi: 'Hôm nay dừng ở đây nhé. Ok, mai gặp!',
        note: 'call it a day = kết thúc ngày làm việc',
        trap: 'Thanks, have a nice day too!',
        why: '"Call it a day" nghĩa là "hôm nay dừng ở đây", không phải lời chúc "một ngày tốt lành".',
      },
    ],
  },
  {
    id: 'advanced',
    title: 'Liên từ & câu nâng cao',
    vi: 'Although, unless, đảo ngữ, câu chẻ: viết như người bản xứ.',
    cefr: 'B2',
    kind: 'sentence',
    tone: 'pink',
    pairs: [
      { l: 'Although the deadline was tight,', r: 'we delivered on time.', vi: 'Dù hạn rất gấp, chúng tôi vẫn giao đúng hạn.', note: 'Although + mệnh đề (tương phản)', trap: 'but we delivered on time.', why: '"Although" và "but" không dùng cùng nhau trong một câu (khác tiếng Việt "tuy… nhưng…").' },
      { l: 'The release was delayed', r: 'because of a security issue.', vi: 'Bản phát hành bị hoãn vì một lỗi bảo mật.', note: 'because of + danh từ; because + mệnh đề', trap: 'because a security issue.', why: 'Theo sau là danh từ thì dùng "because of"; "because" cần cả một mệnh đề (S + V).' },
      { l: 'We added a cache', r: 'so that pages load faster.', vi: 'Chúng tôi thêm cache để trang tải nhanh hơn.', note: 'so that + mệnh đề: để mà (mục đích)' },
      { l: 'Unless you have a better idea,', r: "let's go with plan A.", vi: 'Trừ khi bạn có ý hay hơn, cứ làm phương án A.', note: 'Unless = If … not' },

      { l: 'Not only is the new version faster,', r: 'but it is also cheaper to run.', vi: 'Bản mới không chỉ nhanh hơn mà còn rẻ hơn.', note: 'Not only + đảo ngữ (is / does + S), but … also' },
      { l: 'No sooner had we deployed', r: 'than the alerts started firing.', vi: 'Vừa deploy xong thì cảnh báo nổ liên tục.', note: 'No sooner had + S + V3 … than: vừa mới … thì', trap: 'then the alerts started firing.', why: '"No sooner" luôn đi với "than" (so sánh), không phải "then".' },
      { l: 'Whether we use AWS or GCP,', r: 'the architecture stays the same.', vi: 'Dù dùng AWS hay GCP, kiến trúc vẫn vậy.', note: 'Whether A or B: dù A hay B' },
      { l: 'The more tests we write,', r: 'the fewer bugs reach production.', vi: 'Càng viết nhiều test, càng ít bug lọt lên production.', note: 'The + so sánh hơn …, the + so sánh hơn … (càng… càng…)', trap: 'fewer bugs reach production.', why: 'Cấu trúc "càng… càng…" cần "the" ở cả hai vế: the more…, the fewer….' },
      { l: 'In case the server goes down,', r: 'we keep a backup in another region.', vi: 'Phòng khi server sập, chúng tôi giữ bản dự phòng ở region khác.', note: 'In case + HTĐ: phòng khi' },

      { l: 'Had I known about the bug,', r: 'I would have warned you.', vi: 'Nếu biết về lỗi đó, tôi đã cảnh báo bạn rồi.', note: 'Đảo ngữ loại 3: Had + S + V3 = If S had V3', trap: 'I would warn you.', why: '"Had I known" là điều kiện loại 3 (quá khứ), vế sau cần "would have + V3".' },
      { l: 'Should you need any help,', r: 'feel free to contact me.', vi: 'Nếu cần giúp gì, cứ liên hệ tôi.', note: 'Đảo ngữ loại 1 trang trọng: Should + S + V (hay dùng trong email)' },
      { l: 'It was the database', r: 'that caused the slowdown.', vi: 'Chính database gây ra việc chậm.', note: 'Câu chẻ: It was X that… (nhấn mạnh X)' },
      { l: 'What we really need', r: 'is better monitoring.', vi: 'Thứ chúng ta thật sự cần là giám sát tốt hơn.', note: 'Câu chẻ với What: What + S + V + is …', trap: 'it is better monitoring.', why: 'Mệnh đề "What we really need" đã là chủ ngữ, nên theo sau là "is" luôn, không thêm "it".' },
      { l: 'By the end of this year,', r: 'we will have migrated all services.', vi: 'Đến cuối năm nay chúng tôi sẽ migrate xong mọi service.', note: 'By + mốc tương lai → tương lai hoàn thành' },
      { l: 'The feature, which took three months to build,', r: 'was finally released.', vi: 'Tính năng đó, mất ba tháng để làm, cuối cùng đã ra mắt.', note: 'Mệnh đề quan hệ có dấu phẩy dùng "which", không dùng "that"' },

      { l: 'Hardly had the meeting started', r: 'when the fire alarm went off.', vi: 'Cuộc họp vừa bắt đầu thì chuông báo cháy reo.', note: 'Hardly had + S + V3 … when' },
      { l: 'Only after the audit', r: 'did we realize how many keys had leaked.', vi: 'Chỉ sau đợt kiểm tra chúng tôi mới nhận ra bao nhiêu key đã bị lộ.', note: 'Only after + N đứng đầu → đảo ngữ (did + S + V)', trap: 'we realized how many keys had leaked.', why: '"Only after…" đứng đầu câu thì phải đảo ngữ: "did we realize".' },
      { l: 'Rarely do we see', r: 'such clean code in a legacy project.', vi: 'Hiếm khi thấy code sạch như vậy trong dự án cũ.', note: 'Rarely / Seldom + đảo ngữ' },
      { l: 'Provided that the budget is approved,', r: 'we will hire two more engineers.', vi: 'Với điều kiện ngân sách được duyệt, chúng tôi sẽ tuyển thêm hai kỹ sư.', note: 'Provided that = với điều kiện là' },
      { l: 'She talks as if', r: 'she were the project owner.', vi: 'Cô ấy nói chuyện như thể mình là chủ dự án.', note: 'as if + quá khứ giả định (were): trái thực tế' },
      { l: "I'd rather you", r: "didn't share the password over chat.", vi: 'Tôi mong bạn đừng gửi mật khẩu qua chat.', note: 'would rather + S + QKĐ: muốn người khác (không) làm gì', trap: "don't share the password over chat.", why: '"I\'d rather + người khác" thì động từ lùi về quá khứ: didn\'t share.' },
      { l: 'Little did they know', r: 'that the bug was in their own code.', vi: 'Họ đâu ngờ lỗi nằm ngay trong code của mình.', note: 'Little did + S + V: đâu có ngờ' },
    ],
  },
];

/** Stable id for a pair: "<world>:<index>". */
export const pairKey = (w: number, i: number) => `${WORLDS[w].id}:${i}`;

export function pairByKey(key: string): { w: number; i: number; pair: Pair } | null {
  const [id, idx] = key.split(':');
  const w = WORLDS.findIndex((x) => x.id === id);
  const i = Number(idx);
  if (w < 0 || !WORLDS[w].pairs[i]) return null;
  return { w, i, pair: WORLDS[w].pairs[i] };
}

/** What gets read aloud and shown as the "full" result of a match. */
export function spoken(kind: Kind, p: Pair): string {
  if (kind === 'vocab') return p.ex ? `${p.l}. ${p.ex}` : p.l;
  if (kind === 'qa') return `${p.l} ${p.r}`;
  return `${p.l} ${p.r}`;
}
