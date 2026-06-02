/**
 * Content Blocker: Real-time validation before upload
 * Blocks: religion, caste, sex, politics, profanities, hate speech
 * Shows user warning before they can post
 */

interface BlockedContent {
  blocked: boolean;
  category: string;
  message: string;
  blockedTerms: string[];
}

const BLOCKLISTS = {
  profanities: [
    'shit', 'damn', 'hell', 'crap', 'ass', 'asshole', 'bastard',
    'bitch', 'dammit', 'goddamn', 'fuck', 'fucking', 'fuckup',
    'piss', 'cunt', 'dick', 'cock', 'pussy', 'whore', 'slut'
  ],

  religion: [
    'god', 'jesus', 'allah', 'buddha', 'krishna', 'brahman', 'pray', 'prayer',
    'faith', 'church', 'mosque', 'temple', 'synagogue', 'mandir',
    'bible', 'quran', 'torah', 'vedas', 'gospel', 'holy', 'sacred', 'divine',
    'salvation', 'sin', 'heaven', 'hell', 'convert', 'mission', 'evangel',
    'blessing', 'curse', 'spiritual', 'religion', 'religious', 'atheist', 'agnostic',
    'priest', 'imam', 'rabbi', 'monk', 'nun', 'meditation', 'yoga',
    'hinduism', 'islam', 'christianity', 'judaism', 'buddhism', 'sikhism',
    'catholic', 'protestant', 'orthodox', 'sunni', 'shia', 'dharma', 'karma'
  ],

  caste: [
    'brahmin', 'kshatriya', 'vaishya', 'shudra', 'dalit', 'obc', 'sc', 'st',
    'backward', 'caste', 'untouchable', 'scheduled', 'tribe', 'general',
    'upper caste', 'lower caste', 'caste system', 'jati'
  ],

  sex: [
    'sex', 'porn', 'xxx', 'nudes', 'onlyfans', 'escort', 'sex work',
    'explicit', 'nsfw', 'horny', 'blowjob', 'cum',
    'penetrate', 'orgasm', 'sexual intercourse', 'prostitute', 'dating',
    'seduction', 'flirt', 'sexy', 'erotic', 'sexual', 'strip', 'nude',
    'adult content', 'xxx rated'
  ],

  politics: [
    'election', 'vote', 'candidate', 'campaign', 'congress', 'senate', 'senator',
    'democrat', 'republican', 'political party', 'liberal', 'conservative',
    'trump', 'biden', 'obama', 'maga', 'blm', 'antifa', 'socialism',
    'communism', 'fascism', 'government', 'politics', 'political', 'legislation',
    'parliament', 'minister', 'diplomat', 'political movement'
  ],

  hate: [
    'kill yourself', 'kys', 'faggot', 'nigger', 'chink', 'spic',
    'retard', 'should die', 'piece of trash', 'worthless', 'loser',
    'i hope you', 'disgusting', 'hate you', 'kill all',
    'subhuman', 'vermin', 'scum', 'degenerate', 'inferior', 'superior',
    'ethnic cleansing', 'genocide', 'racial', 'racist', 'discrimination'
  ]
};

export function checkContent(text: string): BlockedContent {
  const textLower = text.toLowerCase();
  const words = textLower.split(/\s+/);

  // Check each category
  for (const [category, terms] of Object.entries(BLOCKLISTS)) {
    const foundTerms = terms.filter(term => {
      // Check exact word match or substring
      return words.some(w => w.includes(term)) || textLower.includes(term);
    });

    if (foundTerms.length > 0) {
      return {
        blocked: true,
        category,
        message: getCategoryMessage(category),
        blockedTerms: foundTerms
      };
    }
  }

  return {
    blocked: false,
    category: '',
    message: '',
    blockedTerms: []
  };
}

function getCategoryMessage(category: string): string {
  const messages: Record<string, string> = {
    profanities: '❌ Profanity detected. Please remove offensive language.',
    religion: '❌ Religious content not allowed on Nexus. Keep discussions secular.',
    caste: '❌ Caste references not allowed. Nexus is an equal-opportunity platform.',
    sex: '❌ Sexual content not allowed. Keep posts family-friendly.',
    politics: '❌ Political discussions not allowed. Nexus is apolitical.',
    hate: '❌ Hate speech detected. Be respectful and inclusive.'
  };
  return messages[category] || '❌ Content violates community guidelines.';
}

export function getWarningComponent(content: string) {
  const result = checkContent(content);

  if (!result.blocked) {
    return null;
  }

  return {
    visible: true,
    title: 'Content Blocked',
    message: result.message,
    category: result.category,
    blockedTerms: result.blockedTerms,
    action: 'Please revise your post'
  };
}
