// Keyboard row fragments — common random-smash patterns
const KEYBOARD_ROWS = [
  'qwertyuiop', 'poiuytrewq',
  'asdfghjkl',  'lkjhgfdsa',
  'zxcvbnm',    'mnbvcxz',
  'qwerty', 'ytrewq',
  'asdfgh', 'hgfdsa',
  'zxcvbn', 'nbvcxz',
  'qwer', 'rewq',
  'asdf', 'fdsa',
  'zxcv', 'vcxz',
  'hjkl', 'lkjh',
  'uiop', 'poiu',
  'bnm',  'mnb',
];

// Letters that are NOT vowels (A E I O U and their accented/Devanagari equivalents)
const CONSONANT_RE = /[^aeiouAEIOUaeiouअ-औअआइईउऊऋऌएऐओऔ\s.''-]/g;

/**
 * Returns an error string if the value looks like gibberish, or null if it's fine.
 * @param {string} value  - already-trimmed text (letters only expected)
 * @param {string} label  - e.g. "Name", "City", "State"
 */
export function detectGibberish(value, label = 'This field') {
  const v = value.trim().toLowerCase();
  if (!v) return null;

  // 1. Block keyboard-row smash patterns
  for (const row of KEYBOARD_ROWS) {
    if (v.includes(row)) {
      return `${label} looks like random keyboard input — please enter a real ${label.toLowerCase()}.`;
    }
  }

  // 2. Block 3+ identical consecutive characters (aaa, bbb, zzz …)
  if (/(.)\1{2,}/.test(v)) {
    return `${label} has too many repeated characters — please enter a real ${label.toLowerCase()}.`;
  }

  // 3. Block 5+ consecutive consonants (no vowels = almost certainly gibberish)
  // Strip spaces/punctuation first, then look for consonant runs
  const lettersOnly = v.replace(/[\s.''-]/g, '');
  const consonantRun = lettersOnly.replace(/[aeiou]/g, ' ');
  if (/[^\s]{5,}/.test(consonantRun)) {
    return `${label} doesn't look like a real word — it must contain vowels.`;
  }

  return null;
}
