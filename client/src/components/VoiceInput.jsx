import React, { useRef, useState } from 'react';
import { Mic, MicOff, Loader2, Sparkles } from 'lucide-react';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

// ─── Number-word tables ──────────────────────────────────────────────────────
// Maps spoken number words (any Indian language) → numeric value
const NUMBER_WORDS = {
  // English
  zero:0, one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8,
  nine:9, ten:10, eleven:11, twelve:12, thirteen:13, fourteen:14, fifteen:15,
  sixteen:16, seventeen:17, eighteen:18, nineteen:19, twenty:20, thirty:30,
  forty:40, fifty:50, sixty:60, seventy:70, eighty:80, ninety:90,
  hundred:100, thousand:1000,
  // Hindi
  'एक':1,'दो':2,'तीन':3,'चार':4,'पांच':5,'पाँच':5,'छह':6,'छः':6,
  'सात':7,'आठ':8,'नौ':9,'दस':10,'ग्यारह':11,'बारह':12,'तेरह':13,
  'चौदह':14,'पंद्रह':15,'सोलह':16,'सत्रह':17,'अठारह':18,'उन्नीस':19,
  'बीस':20,'तीस':30,'चालीस':40,'पचास':50,'साठ':60,'सत्तर':70,
  'अस्सी':80,'नब्बे':90,'सौ':100,'हजार':1000,
  // Gujarati
  'એક':1,'બે':2,'ત્રણ':3,'ચાર':4,'પાંચ':5,'છ':6,'સાત':7,'આઠ':8,
  'નવ':9,'દસ':10,'અગ્યાર':11,'બાર':12,'તેર':13,'ચૌદ':14,'પંદર':15,
  'સોળ':16,'સત્તર':17,'અઢાર':18,'ઓગણીસ':19,'વીસ':20,'ત્રીસ':30,
  'ચાળીસ':40,'પચાસ':50,'સાઠ':60,'સિત્તેર':70,'એંસી':80,'નેવું':90,
  'સો':100,'હજાર':1000,
  // Gujarati compound area words
  'ત્રણસો':300,'ચારસો':400,'પાંચસો':500,'છસો':600,'સાતસો':700,'આઠસો':800,
  // Marathi
  'एक':1,'दोन':2,'तीन':3,'चार':4,'पाच':5,'सहा':6,'सात':7,'आठ':8,
  'नऊ':9,'दहा':10,'वीस':20,'तीस':30,'चाळीस':40,'पन्नास':50,
};

// Replace all number-words in text with their digit equivalents
function normalizeNumbers(text) {
  let s = text;
  // Sort by length descending so "ત્રણસો" (300) matches before "ત્રણ" (3)
  const sorted = Object.entries(NUMBER_WORDS).sort((a, b) => b[0].length - a[0].length);
  for (const [word, val] of sorted) {
    // Use word boundary where possible, otherwise simple replace
    try {
      s = s.replace(new RegExp('(?<![\\w\\u0900-\\u097F\\u0A80-\\u0AFF])' + word + '(?![\\w\\u0900-\\u097F\\u0A80-\\u0AFF])', 'g'), ` ${val} `);
    } catch {
      s = s.replace(new RegExp(word, 'g'), ` ${val} `);
    }
  }
  return s;
}

// Tokenize into words; extract numbers from token list
function tokenize(text) {
  return text.trim().split(/\s+/).filter(Boolean);
}

// Find the first number near a keyword token (within `window` tokens)
function numNear(tokens, keywords, window = 5) {
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i].toLowerCase();
    if (keywords.some(k => tok.includes(k.toLowerCase()))) {
      // Search window around this keyword
      for (let j = Math.max(0, i - window); j < Math.min(tokens.length, i + window + 1); j++) {
        const n = parseFloat(tokens[j]);
        if (!isNaN(n) && n > 0) return n;
      }
    }
  }
  return null;
}

// Check if any keyword appears in the full lowercased text
function hasKeyword(text, keywords) {
  const t = text.toLowerCase();
  return keywords.some(k => t.includes(k.toLowerCase()));
}

// ─── Main parser ─────────────────────────────────────────────────────────────
export function parseSurveyTranscript(rawText) {
  const norm   = normalizeNumbers(rawText);   // number-words → digits
  const tokens = tokenize(norm);
  const text   = norm.toLowerCase();
  const fields = {};

  // ── roofType ──────────────────────────────────────────────────────────────
  // Metal sheet
  if (hasKeyword(text, ['metal','sheet','tin','galvan','industrial','ধাতু','टीन','ধাতু',
      'ধাতব','sheat','patra','pathra','dhatu'])) {
    fields.roofType = 'METAL_SHEET';
  // Tiled / sloped
  } else if (hasKeyword(text, ['tile','tiled','mangalore','slant','slope','khaprail',
      'khapra','nalio','nalia','naliya','ढलान','टाइल','ઢળ','નળ'])) {
    fields.roofType = 'TILED';
  // RCC / flat / concrete
  } else if (hasKeyword(text, ['rcc','concrete','flat','pucca','pakka','cement',
      'construction','constr','aarsi','arsi','આરસ','flat','ફ્લેટ',
      'सीमेंट','पक्का','कंक्रीट'])) {
    fields.roofType = 'RCC';
  } else if (hasKeyword(text, ['other','alag','different','અલ','अलग'])) {
    fields.roofType = 'OTHER';
  }

  // ── shadowFreeAreaSqft ────────────────────────────────────────────────────
  // Keywords that appear NEAR the area number
  const areaNum = numNear(tokens, [
    'area','sqft','sqf','sq','shadow','shade','sher','share','free',
    'usable','ક્ષ','jaga','jagya','ফ্রী','ari','erea',
    'शेड','शैडो','छाया','क्षेत्र','जगह',
    'શેર','ફ્રી','યુઝ','એર','eri',
  ], 6);
  if (areaNum) fields.shadowFreeAreaSqft = areaNum;

  // ── roofDirection ─────────────────────────────────────────────────────────
  // Order matters: check combos first
  if (hasKeyword(text, ['south west','southwest','sw ','dakshin pashchim','dakshin-pashchim'])) {
    fields.roofDirection = 'SW';
  } else if (hasKeyword(text, ['south east','southeast','se ','dakshin purva','dakshin-purva'])) {
    fields.roofDirection = 'SE';
  } else if (hasKeyword(text, ['north','uttar','उत्तर','ઉત્ત','north'])) {
    fields.roofDirection = 'N';
  } else if (hasKeyword(text, ['east west','west east','east-west',
      'iast vest','east vest','east west',
      'ઇસ્ટ વેસ્ટ','ઇસ્ટ-વેસ્ટ','पूर्व पश्चिम'])) {
    fields.roofDirection = 'E'; // east-west combo → use East
  } else if (hasKeyword(text, ['east','purva','purab','pur','पूर्व','ઇસ્ટ','east','est '])) {
    fields.roofDirection = 'E';
  } else if (hasKeyword(text, ['west','paschim','pashchim','पश्चिम',' વેસ','vest','wes'])) {
    fields.roofDirection = 'W';
  } else if (hasKeyword(text, ['south','dakshin','दक्षिण','સાઉ','saush','sauth'])) {
    fields.roofDirection = 'S';
  }

  // ── tiltDegrees ──────────────────────────────────────────────────────────
  // "direction 20", "tilt 20", "angle 20", "20 degree", "ડાયરેક્શન 20"
  const tiltNum = numNear(tokens, [
    'tilt','degree','angle','degre','deg','degd',
    'direction','direct','direc','direk',
    'dayreks','dayrec','डिग्री','digree','digri',
    'ડાય','daq','daqreks',
  ], 4);
  if (tiltNum !== null && tiltNum >= 0 && tiltNum <= 90) fields.tiltDegrees = tiltNum;

  // ── cableDistanceMeters ──────────────────────────────────────────────────
  // "18 meter", "cable 18", "wire 18", "18 મીટર", "distance 18"
  const cableNum = numNear(tokens, [
    'cable','wire','meter','metre','mitar','miter','mitar',
    'distance','dist','distan',
    'mitar','mitr','मीटर','मीट','metar',
    'મીટ','mitar','kebl','kaebl',
  ], 4);
  if (cableNum !== null && cableNum > 0 && cableNum < 500) fields.cableDistanceMeters = cableNum;

  // ── structureHeightFt ────────────────────────────────────────────────────
  // "8 feet", "mount 8", "mounting 8", "structure 8"
  const htNum = numNear(tokens, [
    'mount','mounting','structure','struct','height','feet','foot','ft ',
    'māu','mau','माउ','माउंट','ઊ','unch','uncha',
    'maunt','maunting','mauntin',
  ], 4);
  if (htNum !== null && htNum > 0 && htNum < 100) fields.structureHeightFt = htNum;

  // ── recommendedCapacityKw ────────────────────────────────────────────────
  // "5 kw", "5 kilowatt", "5 kilo watt", "5 kilo"
  const kwNum = numNear(tokens, [
    'kw','kilowatt','kilo','killo','kw','k.w',
    'કિલ','kil','kil','किलो','किलोवाट',
    'kilovolt','kilovat',
  ], 4);
  if (kwNum !== null && kwNum > 0 && kwNum <= 100) fields.recommendedCapacityKw = kwNum;

  // ── recommendedSystemType ────────────────────────────────────────────────
  if (hasKeyword(text, ['off grid','off-grid','offgrid','battery','backup',
      'ऑफ ग्रिड','off gri','ઓફ ગ્ર','off gree','ofgrid'])) {
    fields.recommendedSystemType = 'OFF_GRID';
  } else if (hasKeyword(text, ['on grid','on-grid','ongrid','net meter','net-meter',
      'ऑन ग्रिड','on gri','ઓન ગ','on gree','ongree','angrid'])) {
    fields.recommendedSystemType = 'ON_GRID';
  }

  // ── notes: always keep the original spoken text ───────────────────────────
  fields.notes = rawText.trim();

  return fields;
}

// ─── VoiceSurveyFill component ───────────────────────────────────────────────
export function VoiceSurveyFill({ onFill }) {
  const [phase, setPhase]     = useState('idle'); // idle|listening|thinking|done|error
  const [liveText, setLive]   = useState('');
  const [filledKeys, setFilledKeys] = useState([]);
  const [errorMsg, setError]  = useState('');
  const recRef   = useRef(null);
  const finalRef = useRef('');

  const [lang, setLang] = useState('gu-IN');

  const LANGS = [
    { code:'gu-IN', label:'ગુજરાતી' },
    { code:'hi-IN', label:'हिंदी' },
    { code:'en-IN', label:'English' },
    { code:'mr-IN', label:'मराठी' },
    { code:'ta-IN', label:'தமிழ்' },
    { code:'te-IN', label:'తెలుగు' },
    { code:'kn-IN', label:'ಕನ್ನಡ' },
    { code:'pa-IN', label:'ਪੰਜਾਬੀ' },
  ];

  const FIELD_LABELS = {
    roofType:'Roof Type', shadowFreeAreaSqft:'Area (sq ft)',
    roofDirection:'Direction', tiltDegrees:'Tilt°',
    cableDistanceMeters:'Cable (m)', structureHeightFt:'Height (ft)',
    recommendedCapacityKw:'Capacity (kW)', recommendedSystemType:'System Type',
  };

  if (!SpeechRecognition) {
    return (
      <div className="voice-banner" style={{background:'#fefce8',borderColor:'#fde68a'}}>
        ⚠️ Voice input needs Chrome or Edge browser.
      </div>
    );
  }

  function startListening() {
    setError(''); setLive(''); setFilledKeys([]);
    finalRef.current = '';

    const rec = new SpeechRecognition();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;

    rec.onstart = () => setPhase('listening');

    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalRef.current += e.results[i][0].transcript + ' ';
        else interim = e.results[i][0].transcript;
      }
      setLive(finalRef.current + interim);
    };

    rec.onerror = (e) => {
      setError('Mic error: ' + e.error + '. Allow microphone in browser.');
      setPhase('error');
    };

    rec.onend = () => {
      const text = finalRef.current.trim();
      if (!text) { setPhase('idle'); return; }
      processTranscript(text);
    };

    recRef.current = rec;
    rec.start();
  }

  function stopListening() {
    recRef.current?.stop(); // triggers onend → processTranscript
  }

  function processTranscript(text) {
    setPhase('thinking');
    // Small timeout so "Filling…" state is visible briefly
    setTimeout(() => {
      const fields = parseSurveyTranscript(text);
      const filled = Object.keys(fields).filter(k => k !== 'notes');
      onFill(fields);
      setFilledKeys(filled);
      setPhase('done');
      setTimeout(() => { setPhase('idle'); setLive(''); }, 4000);
    }, 400);
  }

  const phaseStyles = {
    idle:      { color:'#2563eb', bg:'#eff6ff', border:'#bfdbfe' },
    listening: { color:'#dc2626', bg:'#fef2f2', border:'#fca5a5' },
    thinking:  { color:'#7c3aed', bg:'#f5f3ff', border:'#c4b5fd' },
    done:      { color:'#059669', bg:'#ecfdf5', border:'#6ee7b7' },
    error:     { color:'#dc2626', bg:'#fef2f2', border:'#fca5a5' },
  };
  const s = phaseStyles[phase];

  return (
    <div className="voice-banner" style={{ background: s.bg, borderColor: s.border }}>

      {/* Row 1: mic button + title + language pills */}
      <div className="voice-banner-row">
        <div className="voice-banner-left">
          {/* Mic button */}
          <button
            type="button"
            className="voice-main-btn"
            style={{ background: s.color }}
            onClick={phase === 'listening' ? stopListening : phase === 'thinking' ? undefined : startListening}
            disabled={phase === 'thinking'}
            title={phase === 'listening' ? 'Tap to stop' : 'Tap to speak'}
          >
            {phase === 'thinking'  ? <Loader2 size={22} className="spin" /> :
             phase === 'listening' ? <MicOff  size={22} /> :
             phase === 'done'      ? <Sparkles size={22} /> :
                                     <Mic     size={22} />}
          </button>

          <div>
            <div className="voice-banner-title" style={{ color: s.color }}>
              {phase === 'listening' && <span className="voice-dot" />}
              {phase === 'idle'      && 'Tap & Speak — Form Fills Automatically'}
              {phase === 'listening' && 'Listening… tap mic to stop'}
              {phase === 'thinking'  && 'Detecting fields…'}
              {phase === 'done'      && '✓ Form filled!'}
              {phase === 'error'     && 'Error — try again'}
            </div>
            <div className="voice-banner-sub">
              Speak in any language. Roof type, area, direction, kW, system — all auto-fill.
            </div>
          </div>
        </div>

        {/* Language pills */}
        <div className="voice-lang-pills">
          {LANGS.map((l) => (
            <button
              key={l.code} type="button"
              className={`voice-lang-pill ${lang === l.code ? 'active' : ''}`}
              onClick={() => setLang(l.code)}
              disabled={phase === 'listening' || phase === 'thinking'}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* Live transcript */}
      {liveText && phase === 'listening' && (
        <div className="voice-live-text">
          <span className="voice-dot-inline" /> {liveText}
        </div>
      )}

      {/* Filled fields chips */}
      {phase === 'done' && filledKeys.length > 0 && (
        <div className="voice-filled-chips">
          {filledKeys.map(k => (
            <span key={k} className="voice-chip">✓ {FIELD_LABELS[k] || k}</span>
          ))}
        </div>
      )}

      {/* Heard text after done */}
      {phase === 'done' && liveText && (
        <div className="voice-heard-text">
          <strong>Heard:</strong> {liveText}
        </div>
      )}

      {/* Error */}
      {errorMsg && <div className="voice-error-msg">{errorMsg}</div>}

      {/* Idle hint */}
      {phase === 'idle' && (
        <div className="voice-hint">
          💬 Example: <em>"RCC flat roof, 500 square feet shadow free, south direction,
          20 degree tilt, 15 meter cable, 6 feet structure, 3 kilowatt on-grid system"</em>
        </div>
      )}
    </div>
  );
}
