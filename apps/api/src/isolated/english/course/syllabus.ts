import { CefrLevel } from '../shared/cefr';

/**
 * The reference syllabus the course is built on.
 *
 * - Grammar and discourse points per level are the British Council – EAQUALS
 *   "Core Inventory for General English" (North, Ortega & Sheehan; 2nd ed. 2015,
 *   posters 2018). Names are kept as the Inventory prints them so a lesson can be
 *   traced back to it; `vi` is our own gloss.
 * - The workplace "can-do" goals are our own short Vietnamese paraphrases of the
 *   kinds of objectives in Pearson's GSE Learning Objectives for Professional
 *   English — paraphrased, not quoted (Pearson reserves the text).
 *
 * Keys (`b1.past-perfect`) are stored on lessons (`course_lesson.syllabusKeys`)
 * and on placement items, which is how a placement result maps onto lessons.
 */
export interface SyllabusPoint {
  key: string;
  level: CefrLevel;
  kind: 'grammar' | 'discourse';
  /** As named in the Core Inventory. */
  name: string;
  vi: string;
}

export interface LevelFramework {
  level: CefrLevel;
  /** GSE range the CEFR level corresponds to. */
  gse: string;
  /** EF SET score range that maps to this level (efset.org/cefr). */
  efset: string;
  points: SyllabusPoint[];
  /** Core Inventory functions for the level (names as printed). */
  functions: string[];
  /** Workplace can-do goals (paraphrased from GSE Professional English). */
  canDo: string[];
}

type Raw = [key: string, name: string, vi: string, kind?: 'discourse'];

const build = (level: CefrLevel, rows: Raw[]): SyllabusPoint[] =>
  rows.map(([key, name, vi, kind]) => ({
    key: `${level.toLowerCase()}.${key}`,
    level,
    kind: kind ?? 'grammar',
    name,
    vi,
  }));

export const FRAMEWORK: Record<'A2' | 'B1' | 'B2' | 'C1', LevelFramework> = {
  A2: {
    level: CefrLevel.A2,
    gse: '30–42',
    efset: '31–40',
    points: build(CefrLevel.A2, [
      ['comparatives', 'Adjectives – comparative – use of than and definite article', 'So sánh hơn'],
      ['superlatives', 'Adjectives – superlative – use of definite article', 'So sánh nhất'],
      ['adverbial-phrases', 'Adverbial phrases of time, place and frequency – including word order', 'Cụm trạng từ & trật tự từ'],
      ['adverbs-frequency', 'Adverbs of frequency', 'Trạng từ tần suất'],
      ['articles', 'Articles – with countable and uncountable nouns', 'Mạo từ a/an/the'],
      ['countables', 'Countables and Uncountables: much/many', 'Danh từ đếm được/không đếm được'],
      ['future-time', 'Future Time (will and going to)', 'Tương lai: will / going to'],
      ['gerunds', 'Gerunds', 'Danh động từ (V-ing)'],
      ['going-to', 'Going to', 'Going to'],
      ['imperatives', 'Imperatives', 'Câu mệnh lệnh'],
      ['can-could', 'Modals – can/could', 'Can / could'],
      ['have-to', 'Modals – have to', 'Have to'],
      ['should', 'Modals – should', 'Should'],
      ['past-continuous', 'Past continuous', 'Quá khứ tiếp diễn'],
      ['past-simple', 'Past simple', 'Quá khứ đơn'],
      ['phrasal-verbs', 'Phrasal verbs – common', 'Cụm động từ thông dụng'],
      ['possessives', "Possessives – use of 's, s'", 'Sở hữu cách'],
      ['prepositional-phrases', 'Prepositional phrases (place, time and movement)', 'Cụm giới từ'],
      ['prepositions-time', 'Prepositions of time: on/in/at', 'Giới từ thời gian on/in/at'],
      ['present-continuous', 'Present continuous', 'Hiện tại tiếp diễn'],
      ['present-continuous-future', 'Present continuous for future', 'Hiện tại tiếp diễn chỉ tương lai'],
      ['present-perfect', 'Present perfect', 'Hiện tại hoàn thành'],
      ['questions', 'Questions', 'Câu hỏi'],
      ['verb-ing-infinitive', 'Verb + ing/infinitive: like/want-would like', 'V-ing hay to V'],
      ['wh-questions-past', 'Wh-questions in past', 'Câu hỏi Wh- ở quá khứ'],
      ['conditionals-0-1', 'Zero and 1st conditional', 'Câu điều kiện loại 0 và 1'],
      ['connectors', 'Connecting words expressing cause and effect, contrast etc', 'Từ nối nguyên nhân/tương phản', 'discourse'],
      ['sequencing', 'Linkers: sequential past time', 'Từ nối trình tự', 'discourse'],
    ]),
    functions: [
      'Describing habits and routines',
      'Describing past experiences',
      'Describing people',
      'Describing places',
      'Describing things',
      'Obligation and necessity',
      'Requests',
      'Suggestions',
    ],
    canDo: [
      'Đọc hiểu email công việc ngắn, lịch họp, lịch làm việc đơn giản',
      'Kể về công việc hằng ngày và việc mình đang làm bằng câu đơn giản',
      'Trả lời các yêu cầu công việc cơ bản bằng mẫu câu cố định',
      'Viết email ngắn nhận lời, hẹn lịch, trả lời câu hỏi',
    ],
  },
  B1: {
    level: CefrLevel.B1,
    gse: '43–58',
    efset: '41–50',
    points: build(CefrLevel.B1, [
      ['adverbs', 'Adverbs', 'Trạng từ (cách thành lập, vị trí)'],
      ['intensifiers', 'Broader range of intensifiers such as too, enough', 'Too / enough và từ nhấn mạnh'],
      ['comparatives', 'Comparatives and superlatives', 'So sánh hơn / nhất (mở rộng)'],
      ['question-tags', 'Complex question tags', 'Câu hỏi đuôi'],
      ['conditionals-2-3', 'Conditionals, 2nd and 3rd', 'Câu điều kiện loại 2 và 3'],
      ['future-continuous', 'Future continuous', 'Tương lai tiếp diễn'],
      ['deduction-present', 'Modals - must/can’t deduction', 'Suy đoán: must / can’t'],
      ['might-may-will', 'Modals – might, may, will, probably', 'Khả năng: might / may / will'],
      ['past-modals', 'Modals – should have/might have/etc', 'Should have / might have'],
      ['must-have-to', 'Modals: must/have to', 'Bắt buộc: must / have to'],
      ['past-continuous', 'Past continuous', 'Quá khứ tiếp diễn'],
      ['past-perfect', 'Past perfect', 'Quá khứ hoàn thành'],
      ['past-simple', 'Past simple', 'Quá khứ đơn'],
      ['past-tense-responses', 'Past tense responses', 'Trả lời ngắn ở quá khứ'],
      ['phrasal-verbs', 'Phrasal verbs, extended', 'Cụm động từ (mở rộng)'],
      ['present-perfect-continuous', 'Present perfect continuous', 'Hiện tại hoàn thành tiếp diễn'],
      ['present-perfect-past-simple', 'Present perfect/past simple', 'Hiện tại hoàn thành vs quá khứ đơn'],
      ['reported-speech', 'Reported speech (range of tenses)', 'Câu tường thuật'],
      ['passive', 'Simple passive', 'Câu bị động'],
      ['wh-questions-past', 'Wh- questions in the past', 'Câu hỏi Wh- ở quá khứ'],
      ['will-going-to', 'Will and going to, for prediction', 'Will / going to để dự đoán'],
      ['connectors', 'Connecting words expressing cause and effect, contrast etc.', 'Từ nối nguyên nhân/tương phản', 'discourse'],
      ['sequencing', 'Linkers: sequential past time', 'Từ nối trình tự', 'discourse'],
    ]),
    functions: [
      'Checking understanding',
      'Describing experiences and events',
      'Describing feelings and emotion',
      'Expressing opinions; language of agreeing and disagreeing',
      'Initiating and closing conversation',
      'Managing interaction (interrupting, changing topic, resuming or continuing)',
    ],
    canDo: [
      'Đọc hiểu email, agenda họp, tài liệu kỹ thuật thông thường trong công việc',
      'Nắm ý chính trong cuộc họp về chủ đề quen thuộc',
      'Mô tả một quy trình, giải thích một lỗi kỹ thuật đơn giản',
      'Kể lại kinh nghiệm làm việc khi phỏng vấn, thuyết trình ngắn về công việc',
      'Viết báo cáo ngắn về một task hoặc sự cố, nêu và bảo vệ một ý kiến đơn giản',
    ],
  },
  B2: {
    level: CefrLevel.B2,
    gse: '59–75',
    efset: '51–60',
    points: build(CefrLevel.B2, [
      ['adjectives-adverbs', 'Adjectives and adverbs', 'Tính từ và trạng từ (nâng cao)'],
      ['future-continuous', 'Future continuous', 'Tương lai tiếp diễn'],
      ['future-perfect', 'Future perfect', 'Tương lai hoàn thành'],
      ['future-perfect-continuous', 'Future perfect continuous', 'Tương lai hoàn thành tiếp diễn'],
      ['mixed-conditionals', 'Mixed conditionals', 'Câu điều kiện hỗn hợp'],
      ['past-modals-neg', 'Modals – can’t have, needn’t have', 'Can’t have / needn’t have'],
      ['deduction-speculation', 'Modals of deduction and speculation', 'Suy đoán và phỏng đoán'],
      ['narrative-tenses', 'Narrative tenses', 'Các thì kể chuyện'],
      ['passives', 'Passives', 'Bị động (mở rộng)'],
      ['past-perfect', 'Past perfect', 'Quá khứ hoàn thành'],
      ['past-perfect-continuous', 'Past perfect continuous', 'Quá khứ hoàn thành tiếp diễn'],
      ['phrasal-verbs', 'Phrasal verbs, extended', 'Cụm động từ (mở rộng)'],
      ['relative-clauses', 'Relative clauses', 'Mệnh đề quan hệ'],
      ['reported-speech', 'Reported speech', 'Câu tường thuật'],
      ['will-going-to', 'Will and going to, for prediction', 'Will / going to để dự đoán'],
      ['wish', 'Wish', 'Wish'],
      ['would-habits', 'Would expressing habits, in the past', 'Would chỉ thói quen quá khứ'],
      ['contrast-linkers', 'Linkers: although, in spite of, despite', 'Although / despite / in spite of', 'discourse'],
      ['formal-markers', 'Discourse markers to structure formal speech', 'Từ dẫn dắt khi nói trang trọng', 'discourse'],
    ]),
    functions: [
      'Critiquing and reviewing',
      'Developing an argument',
      'Expressing agreement and disagreement',
      'Speculating',
      'Taking the initiative in interaction',
      'Synthesizing, evaluating, glossing info',
    ],
    canDo: [
      'Hiểu chi tiết agenda, biên bản họp, phân biệt chỗ chắc chắn và chỗ còn mơ hồ trong email',
      'Nêu mối lo cụ thể, bàn phương án và đề xuất giải pháp kèm lý do trong họp',
      'Cập nhật chi tiết tiến độ dự án, trả lời câu hỏi sau khi thuyết trình',
      'Theo kịp thảo luận công việc giữa những người nói lưu loát',
    ],
  },
  C1: {
    level: CefrLevel.C1,
    gse: '76–84',
    efset: '61–70',
    points: build(CefrLevel.C1, [
      ['futures', 'Futures (revision)', 'Các dạng tương lai (ôn tập)'],
      ['inversion', 'Inversion with negative adverbials', 'Đảo ngữ với trạng từ phủ định'],
      ['mixed-conditionals', 'Mixed conditionals in past, present and future', 'Điều kiện hỗn hợp'],
      ['modals-past', 'Modals in the past', 'Động từ khuyết thiếu ở quá khứ'],
      ['narrative-passive', 'Narrative tenses for experience, incl. passive', 'Thì kể chuyện, kể cả bị động'],
      ['passives-all', 'Passive forms, all', 'Mọi dạng bị động'],
      ['phrasal-verbs', 'Phrasal verbs, especially splitting', 'Cụm động từ (tách)'],
      ['wish-if-only', 'Wish/if only regrets', 'Wish / if only (hối tiếc)'],
      ['linking', 'Linking devices, logical markers', 'Từ nối logic', 'discourse'],
      ['signposting', 'Markers to structure and signpost formal and informal speech and writing', 'Từ dẫn dắt bố cục nói/viết', 'discourse'],
    ]),
    functions: [
      'Conceding a point',
      'Defending a point of view persuasively',
      'Developing an argument systematically',
      'Expressing opinions tentatively, hedging',
      'Expressing shades of opinion and certainty',
      'Responding to counterarguments',
      'Speculating and hypothesising about causes, consequences etc.',
    ],
    canDo: [
      'Đọc hiểu chi tiết tài liệu kỹ thuật phức tạp, proposal dài',
      'Lập luận có dẫn chứng trong họp, phản biện và nhượng bộ khéo léo',
      'Trình bày lập trường đàm phán chính xác, đề xuất nhiều phương án',
      'Nói giảm nói tránh (hedging), thể hiện mức độ chắc chắn tinh tế',
    ],
  },
};

export const ALL_POINTS: SyllabusPoint[] = Object.values(FRAMEWORK).flatMap((f) => f.points);
const BY_KEY = new Map(ALL_POINTS.map((p) => [p.key, p]));

export function syllabusPoint(key: string): SyllabusPoint | undefined {
  return BY_KEY.get(key);
}

export function frameworkFor(level: CefrLevel): LevelFramework | undefined {
  return (FRAMEWORK as Record<string, LevelFramework>)[level];
}

/** efset.org/cefr: score → CEFR level. */
export function efsetToCefr(score: number): CefrLevel {
  if (score <= 30) return CefrLevel.A1;
  if (score <= 40) return CefrLevel.A2;
  if (score <= 50) return CefrLevel.B1;
  if (score <= 60) return CefrLevel.B2;
  if (score <= 70) return CefrLevel.C1;
  return CefrLevel.C2;
}

export const SOURCES = [
  {
    name: 'British Council – EAQUALS Core Inventory for General English',
    use: 'Danh sách ngữ pháp, từ nối và chức năng giao tiếp cho từng level A2–C1',
    url: 'https://www.eaquals.org/resources/the-core-inventory-for-general-english/',
  },
  {
    name: 'Pearson GSE Learning Objectives — Professional English',
    use: 'Định hướng mục tiêu “làm được gì” trong công việc cho từng level (diễn giải lại)',
    url: 'https://www.pearson.com/english/about-us/global-scale-of-english/learning-objectives-and-resources.html',
  },
  {
    name: 'Council of Europe — CEFR',
    use: 'Thang trình độ A1–C2 mà cả khóa học, bài test và EF SET cùng quy về',
    url: 'https://www.coe.int/en/web/common-european-framework-reference-languages',
  },
  {
    name: 'EF SET (EF Standard English Test)',
    use: 'Bài thi chuẩn hóa miễn phí 50 phút (đọc + nghe) để đối chiếu kết quả xếp lớp',
    url: 'https://www.efset.org/ef-set-50/',
  },
];
