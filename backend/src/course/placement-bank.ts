import { CefrLevel } from '../knowledge/entities/knowledge.entity';

/**
 * The placement test. Our own items (no exam content is reproduced), written to
 * CEFR level and tagged with the Core Inventory point they probe (`key`, see
 * syllabus.ts) so a result can mark lessons as already mastered or weak.
 *
 * Each level block has 12 items: 8 grammar, 2 vocabulary, 1 reading, 1 listening
 * (the listening text is read aloud by the browser and never shown).
 */
export type PlacementSkill = 'grammar' | 'vocab' | 'reading' | 'listening';

export interface PlacementItem {
  id: string;
  level: CefrLevel;
  skill: PlacementSkill;
  key: string | null;
  prompt: string;
  options: string[];
  answer: string;
  /** Reading text shown above the question. */
  passage?: string;
  /** Listening script, spoken with TTS. */
  audio?: string;
}

/** Levels tested, in order. */
export const PLACEMENT_LEVELS = [CefrLevel.A2, CefrLevel.B1, CefrLevel.B2, CefrLevel.C1];
/** A level counts as "already passed" with at least this share of its block right. */
export const PLACEMENT_PASS = 0.75;
/** Below this share the test stops: the harder blocks would only be guesses. */
export const PLACEMENT_STOP = 0.5;

type G = [key: string | null, prompt: string, answer: string, ...wrong: string[]];

function block(
  level: CefrLevel,
  grammar: G[],
  vocab: G[],
  reading: { passage: string; prompt: string; answer: string; wrong: string[] },
  listening: { audio: string; prompt: string; answer: string; wrong: string[] },
): PlacementItem[] {
  const lv = level.toLowerCase();
  const mk = (skill: PlacementSkill, rows: G[]) =>
    rows.map(([key, prompt, answer, ...wrong], i) => ({
      id: `${lv}-${skill[0]}${i + 1}`,
      level,
      skill,
      key: key ? `${lv}.${key}` : null,
      prompt,
      options: [answer, ...wrong],
      answer,
    }));
  return [
    ...mk('grammar', grammar),
    ...mk('vocab', vocab),
    {
      id: `${lv}-r1`,
      level,
      skill: 'reading',
      key: null,
      passage: reading.passage,
      prompt: reading.prompt,
      options: [reading.answer, ...reading.wrong],
      answer: reading.answer,
    },
    {
      id: `${lv}-l1`,
      level,
      skill: 'listening',
      key: null,
      audio: listening.audio,
      prompt: listening.prompt,
      options: [listening.answer, ...listening.wrong],
      answer: listening.answer,
    },
  ];
}

export const PLACEMENT_ITEMS: PlacementItem[] = [
  ...block(
    CefrLevel.A2,
    [
      ['present-continuous', "Sorry, I can't join the call right now — I ___ a bug in production.", 'am fixing', 'fix', 'fixed', 'have fix'],
      ['past-simple', 'Yesterday we ___ the new version to the staging server.', 'deployed', 'deploy', 'have deployed', 'deploying'],
      ['comparatives', 'The new laptop is much ___ than my old one.', 'faster', 'fast', 'fastest', 'more fast'],
      ['have-to', 'You ___ log in with your company account to use the VPN.', 'have to', 'has to', 'having to', 'to have'],
      ['present-perfect', 'I ___ already sent the report to the client.', 'have', 'has', 'did', 'am'],
      ['countables', "Hurry up — there isn't ___ time left before the release.", 'much', 'many', 'a few', 'few'],
      ['conditionals-0-1', 'If the tests fail, the pipeline ___ the deployment.', 'will stop', 'stopped', 'would stop', 'is stop'],
      ['prepositions-time', 'The sprint review is ___ Friday ___ 3 p.m.', 'on … at', 'in … at', 'at … on', 'on … in'],
    ],
    [
      [null, 'A ___ is a mistake in a program that makes it work incorrectly.', 'bug', 'patch', 'branch', 'feature'],
      [null, "I'm busy at 10. Can we ___ the meeting to the afternoon?", 'reschedule', 'repeat', 'return', 'review'],
    ],
    {
      passage:
        'Hi team,\n\nThe office will be closed on Friday because of electrical maintenance. ' +
        'Please work from home that day. The daily stand-up will be on Zoom at 9:30 as usual.\n\nThanks,\nLan',
      prompt: 'What will happen on Friday?',
      answer: 'Everyone will work from home.',
      wrong: ['The stand-up is cancelled.', 'The stand-up will start at 10:30.', 'The office will open late.'],
    },
    {
      audio:
        "Hi, this is Minh from the QA team. I found two bugs on the login page. I've put them in Jira. " +
        'Can you check them before lunch? Thanks!',
      prompt: 'What does Minh want you to do?',
      answer: 'Check the two bugs before lunch.',
      wrong: ['Fix the login page tomorrow.', 'Call the QA team.', 'Create two Jira tickets.'],
    },
  ),
  ...block(
    CefrLevel.B1,
    [
      ['present-perfect-past-simple', 'I ___ at a big outsourcing company for three years, and then I moved to a startup.', 'worked', 'have worked', 'have been working', 'work'],
      ['past-perfect', 'When I joined the call, the team ___ the decision.', 'had already made', 'already made', 'has already made', 'was already making'],
      ['passive', 'The bug ___ by the QA team last night.', 'was found', 'found', 'is finding', 'has find'],
      ['conditionals-2-3', 'If we ___ more developers, we could finish the feature this sprint.', 'had', 'have', 'would have', 'will have'],
      ['deduction-present', "The server isn't responding and nobody can connect. It ___ be down.", 'must', "can't", 'should', 'would'],
      ['reported-speech', 'The PM told us that the deadline ___ moved to next week.', 'had been', 'have', 'is being', 'was be'],
      ['present-perfect-continuous', "We ___ on this migration since March, and it still isn't finished.", 'have been working', 'work', 'were working', 'had worked'],
      ['question-tags', "You've pushed the fix, ___?", "haven't you", "didn't you", "aren't you", 'have you'],
    ],
    [
      [null, 'Before merging, please ask a teammate to ___ your pull request.', 'review', 'revise', 'repeat', 'reply'],
      [null, "We don't have time for a proper fix, so we'll use a temporary ___.", 'workaround', 'walkthrough', 'workload', 'workflow'],
    ],
    {
      passage:
        'Title: Checkout page goes blank on Safari\n' +
        'Steps: 1) Add any item to the cart. 2) Open the checkout page in Safari 17.\n' +
        'Expected: the payment form loads.\n' +
        'Actual: the page goes blank and the console shows a TypeError.\n' +
        'Notes: Chrome and Firefox work fine. First reported the morning after release 2.4.0.',
      prompt: 'What does the ticket suggest?',
      answer: 'The problem probably came with release 2.4.0.',
      wrong: ['The problem affects every browser.', 'The payment form loads slowly.', 'The problem happens only in Chrome.'],
    },
    {
      audio:
        "Quick update from me. Yesterday I finished the API for user profiles. Today I'm going to write the tests for it. " +
        "I'm blocked on the settings page, though — the design isn't ready yet, so I'll need to sync with Hoa about it.",
      prompt: 'Why does the speaker need to talk to Hoa?',
      answer: 'The design for the settings page is not ready.',
      wrong: ['The tests are failing.', 'The profile API is not finished.', 'Hoa is writing the tests.'],
    },
  ),
  ...block(
    CefrLevel.B2,
    [
      ['future-perfect', 'By the end of next week, we ___ the migration to the new database.', 'will have finished', 'will finish', 'are finishing', 'have finished'],
      ['mixed-conditionals', "If we had written proper tests last year, we ___ in this mess now.", "wouldn't be", "wouldn't have been", "won't be", "weren't"],
      ['past-modals-neg', 'You ___ restarted the server — the config reloads automatically.', "needn't have", "mustn't have", "can't", "shouldn't"],
      ['deduction-speculation', 'The job finished in two seconds instead of two hours. It ___ skipped most of the records.', 'must have', 'should have', "can't have", 'would'],
      ['relative-clauses', 'The engineer ___ change caused the outage has written a detailed postmortem.', 'whose', 'who', 'which', 'whom'],
      ['wish', 'I wish we ___ a different framework — this one is so hard to maintain.', 'had chosen', 'have chosen', 'would choose', 'chose'],
      ['past-perfect-continuous', 'The service ___ for hours before anyone noticed the memory leak.', 'had been crashing', 'has been crashing', 'was crash', 'crashes'],
      ['contrast-linkers', '___ the tight deadline, the team delivered every feature on the list.', 'Despite', 'Although', 'However', 'Even'],
    ],
    [
      [null, 'We need to ___ the risk of data loss by taking daily backups.', 'mitigate', 'migrate', 'mediate', 'motivate'],
      [null, "Could you give me a ___ figure for the cost? It doesn't need to be exact.", 'ballpark', 'baseline', 'benchmark', 'bottom-line'],
    ],
    {
      passage:
        'At 14:05 a configuration change reduced the database connection pool from 100 to 10. ' +
        'Error rates rose gradually rather than spiking, which is why the alert — configured to detect sudden jumps — ' +
        'did not fire until 14:50. Rolling back the change restored service within minutes. ' +
        'We will add a threshold-based alert and require a second reviewer for pool settings.',
      prompt: 'Why was the problem detected late?',
      answer: 'The alert only reacted to sudden increases in errors.',
      wrong: ['Nobody was on call that afternoon.', 'The rollback failed twice.', 'The change had been reviewed by two people.'],
    },
    {
      audio:
        "I see where you're coming from, and I agree that performance matters. That said, I'm not convinced that rewriting " +
        "the whole service is the best use of next quarter. Could we profile the hot paths first and then decide?",
      prompt: "What is the speaker's position?",
      answer: 'They want more evidence before agreeing to a rewrite.',
      wrong: ['They fully support the rewrite.', 'They think performance is not important.', 'They want to cancel the project.'],
    },
  ),
  ...block(
    CefrLevel.C1,
    [
      ['inversion', 'Not only ___ the deadline, but we also cut infrastructure costs by 20%.', 'did we meet', 'we met', 'we did meet', 'met we'],
      ['modals-past', "With hindsight, we ___ the vendor's claims more carefully before signing.", 'ought to have checked', 'ought to check', 'must have checked', 'had to check'],
      ['passives-all', 'The legacy module is believed ___ written by a contractor back in 2012.', 'to have been', 'to be', 'being', 'having'],
      ['wish-if-only', 'If only the outage ___ during the client demo!', "hadn't happened", "didn't happen", "wouldn't happen", "hasn't happened"],
      ['mixed-conditionals', 'Were the API better documented, integrators ___ so many support tickets right now.', "wouldn't be filing", "won't file", "hadn't filed", "didn't file"],
      ['phrasal-verbs', 'We need to ___ the root cause before we promise the client a fix date.', 'pin down', 'put off', 'take after', 'turn up'],
      ['linking', 'The managed service is cheaper to run; ___, it ties us to a single vendor.', 'that said', 'therefore', 'consequently', 'as a result'],
      ['futures', 'The new API ___ go live on 1 March, although the date could still slip.', 'is due to', 'is about to', 'will have', 'is to be'],
    ],
    [
      [null, 'Our findings ___ that the latency comes from the cache layer, although more data is needed.', 'suggest', 'prove', 'confirm', 'establish'],
      [null, 'As a lead, you have to ___ a balance between delivery speed and code quality.', 'strike', 'hit', 'make', 'take'],
    ],
    {
      passage:
        'While the proposal undoubtedly simplifies onboarding, it is predicated on the assumption that every team will ' +
        'migrate within a single quarter — an assumption for which the platform team has, to date, offered little evidence. ' +
        'Absent a phased plan, the risk is not so much outright failure as a prolonged period of running two systems in parallel.',
      prompt: "What is the writer's main concern?",
      answer: 'Teams may end up maintaining two systems for a long time.',
      wrong: ['The proposal makes onboarding harder.', 'The platform team has rejected the proposal.', 'The migration will certainly fail.'],
    },
    {
      audio:
        "Look, I'm not saying the numbers are wrong per se. What I'm saying is that we've drawn a fairly sweeping conclusion " +
        'from two weeks of data — in December, of all months, when traffic is anything but typical.',
      prompt: 'What does the speaker imply?',
      answer: 'The data may not represent normal usage.',
      wrong: ['The numbers were calculated incorrectly.', 'They should collect more December data.', 'December traffic was completely normal.'],
    },
  ),
];

export const PLACEMENT_BY_ID = new Map(PLACEMENT_ITEMS.map((i) => [i.id, i]));
