/**
 * One-off data for lessons written before the course was tied to the Core
 * Inventory (syllabus.ts). Applied on boot by CourseSyllabusService, idempotent.
 */

/** Grammar label of an existing lesson → the Core Inventory points it teaches. */
export const LEGACY_KEYS: Record<string, string[]> = {
  'Present simple vs present continuous': ['a2.present-continuous'],
  'Present perfect with just, already and yet': ['a2.present-perfect'],
  'Present perfect continuous with for and since': ['b1.present-perfect-continuous'],
  'Present continuous for future arrangements': ['a2.present-continuous-future'],
  'Polite requests: Could you...? / Would you mind + -ing?': ['a2.can-could'],
  'Will vs going to': ['b1.will-going-to'],
  'Question tags': ['b1.question-tags'],
  'Past simple vs past continuous': ['b1.past-simple', 'b1.past-continuous'],
  'Zero conditional': ['a2.conditionals-0-1'],
  'Passive voice: present simple and past simple': ['b1.passive'],
  'Quantifiers: a few, a little, a lot of, too many, too much, not enough': ['b1.intensifiers', 'a2.countables'],
  'Advice: should, ought to, had better': ['a2.should'],
  'Comparatives and superlatives': ['b1.comparatives'],
  'First conditional': ['a2.conditionals-0-1'],
  'Verb + gerund or infinitive (suggest, avoid, consider, try, need, remember)': ['a2.verb-ing-infinitive', 'a2.gerunds'],
  "Obligation: must, have to, don't have to, mustn't": ['b1.must-have-to'],
  'Possibility: may, might, could': ['b1.might-may-will'],
  'Contrast linkers: although, even though, however, despite': ['b1.connectors'],
  'Defining relative clauses (who, which, that, where)': ['b2.relative-clauses'],
  'Non-defining relative clauses': ['b2.relative-clauses'],
  'Passive with modals (can be, must be, should be + past participle)': ['b1.passive'],
  "Deduction in the present: must, might, can't": ['b1.deduction-present'],
  'Past perfect': ['b1.past-perfect', 'b1.sequencing'],
  'Reported speech: statements': ['b1.reported-speech'],
  'Second conditional': ['b1.conditionals-2-3'],
  'Present perfect vs past simple': ['b1.present-perfect-past-simple'],
  'Phrasal verbs (separable and inseparable)': ['b1.phrasal-verbs'],
  'Reported speech: questions and requests': ['b1.reported-speech'],
  // Workplace extras outside the Core Inventory list (kept, never "mastered" by the test):
  'Indirect questions (Do you know where...? / Could you tell me if...?)': [],
  'Future time clauses with when, as soon as, before, until': [],
  'Purpose: to, in order to, so that': [],
  'Used to': [],
};

/**
 * B1 points the first outline left out, added as a ninth unit. The lessons are
 * created PENDING and written by the normal generator run.
 */
export const B1_GAP_UNIT = {
  title: 'Sprint Retrospectives',
  titleVi: 'Họp retro cuối sprint',
  summary: 'Nhìn lại sprint: hỏi và kể lại chuyện đã xảy ra, rút kinh nghiệm, nói về kế hoạch sắp tới.',
  lessons: [
    {
      title: 'Looking back on the sprint',
      grammar: 'Wh- questions in the past and past tense responses',
      vocabTheme: 'Retro board: went well, went wrong, action items',
      objective: 'Sau bài này bạn có thể đặt câu hỏi và trả lời ngắn gọn về những gì đã xảy ra trong sprint.',
      syllabusKeys: ['b1.wh-questions-past', 'b1.past-tense-responses'],
    },
    {
      title: 'What we should have done',
      grammar: 'Past modals: should have, could have, might have',
      vocabTheme: 'Mistakes, missed steps and hindsight',
      objective: 'Sau bài này bạn có thể nói về việc lẽ ra nên làm khác đi mà không đổ lỗi cho ai.',
      syllabusKeys: ['b1.past-modals'],
    },
    {
      title: 'If we had tested it…',
      grammar: 'Third conditional',
      vocabTheme: 'Root causes, safeguards and prevention',
      objective: 'Sau bài này bạn có thể phân tích nguyên nhân và hệ quả của một sự cố đã xảy ra.',
      syllabusKeys: ['b1.conditionals-2-3'],
    },
    {
      title: 'Next sprint',
      grammar: 'Future continuous',
      vocabTheme: 'Capacity, availability and sprint commitments',
      objective: 'Sau bài này bạn có thể nói về việc mình sẽ đang làm vào một thời điểm trong sprint tới.',
      syllabusKeys: ['b1.future-continuous'],
    },
    {
      title: 'Writing clear updates',
      grammar: 'Adverbs: formation and position (quickly, carefully, already, still, probably)',
      vocabTheme: 'Status words for written updates',
      objective: 'Sau bài này bạn có thể viết cập nhật tiến độ rõ ràng, đặt trạng từ đúng chỗ.',
      syllabusKeys: ['b1.adverbs'],
    },
  ],
};
