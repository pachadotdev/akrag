const CHAT = document.getElementById('chat');
const FORM = document.getElementById('composer');
const INPUT = document.getElementById('input');

let quotes = [
  'You can do it — start small and build momentum.',
  'Small progress every day leads to big results.',
  'Curiosity wins: read more, then go try it yourself!',
  'A little research today saves hours of guesswork tomorrow.'
];

async function tryLoadCSV(){
  try{
    const res = await fetch('quotes.csv');
    if (!res.ok) return;
    const txt = await res.text();
    const rows = txt.split(/\r?\n/).map(l=>l.trim()).filter(Boolean).map(line=>{
      // simple CSV with single column (quote)
      // allow optional surrounding quotes
      if (line.startsWith('#')) return null;
      if (line.startsWith('"') && line.endsWith('"')) return line.slice(1,-1);
      return line;
    }).filter(Boolean);
    if (rows.length) quotes = rows;
  }catch(e){
    // ignore if file missing or not allowed
    console.debug('no CSV loaded or failed to parse:', e?.message);
  }
}

function scrollToBottom(){
  CHAT.scrollTop = CHAT.scrollHeight;
}

function mkRow(type='them', text){
  const row = document.createElement('div');
  row.className = `row ${type === 'me' ? 'me' : ''}`;

  const bubble = document.createElement('div');
  bubble.className = 'bubble ' + (type === 'me' ? 'me' : 'them');
  bubble.innerHTML = text;

  row.appendChild(bubble);
  return {row, bubble};
}

function addUserMessage(text){
  const {row} = mkRow('me', text);
  CHAT.appendChild(row);
  scrollToBottom();
}

function addBotTyping(){
  const {row, bubble} = mkRow('them', `<span class="typing"><span></span><span></span><span></span></span> thinking...`);
  bubble.setAttribute('data-typing', 'true');
  CHAT.appendChild(row);
  scrollToBottom();
  return {row, bubble};
}

function replaceTypingWithText(bubble, text){
  bubble.removeAttribute('data-typing');
  bubble.innerHTML = text;
  scrollToBottom();
}

function randomQuote(){
  return quotes[Math.floor(Math.random()*quotes.length)];
}

async function handleQuestion(question){
  // sequence: first motivational quote inviting to read more
  // second: insist on the same
  // third: open duckduckgo results for the question

  // 1st: Send a short motivational reminder (user requested "Here's an important reminder...")
  const t1 = addBotTyping();
  await delay(700);
  replaceTypingWithText(t1.bubble, `Here's an important reminder: ${escapeHtml(randomQuote())}`);

  // 2nd: Insist on doing research with the exact phrasing requested
  const t2 = addBotTyping();
  await delay(900);
  replaceTypingWithText(t2.bubble, `Do some research and read other sources about this.`);

  // 3rd
  await delay(600);
  const t3 = addBotTyping();
  await delay(500);
  replaceTypingWithText(t3.bubble, `Okay — opening search results for: <span class="ka">${escapeHtml(question)}</span>`);

  // open DuckDuckGo with query in a new tab
  const q = encodeURIComponent(question);
  const url = `https://duckduckgo.com/?q=${q}`;
  // open after a slightly longer delay so the user has time to read the messages
  // before the new tab is opened and potentially steals focus
  await delay(1400);
  window.open(url, '_blank');

  // good UX: add a small link that points to same
  const linkEl = document.createElement('div');
  linkEl.className = 'meta';
  linkEl.innerHTML = `Search opened — <a class="search-link" href="${url}" target="_blank" rel="noopener noreferrer">Open DuckDuckGo for: ${escapeHtml(question)}</a>`;
  CHAT.appendChild(linkEl);
  scrollToBottom();
}

// --- New: session-level message counter / behaviors ---
let sessionAskCount = 0; // counts how many times the user asked

async function handleFirst(question){
  // reuse existing flow (motivation -> insist -> open search)
  return handleQuestion(question);
}

async function handleSecond(question){
  // produce a thoughtful AI-risks reply with links
  const t = addBotTyping();
  await delay(700);

  const risksHtml = [
    '<b>Important — some risks and limitations of AI:</b>',
    '<ul>',
    '<li>Not a human — the system is not conscious or understanding; treat it as a tool.</li>',
    '<li>Answers are not validated — models can produce plausible-sounding but incorrect facts.</li>',
    '<li>May reinforce false beliefs or hallucinations — double-check important claims.</li>',
    '<li>Bias & fairness — models reflect training data and can show biased outputs.</li>',
    '</ul>'
  ].join('\n');

  // add short helpful links
  const links = `Further reading:
  <ul>
  <li><a target="_blank" rel="noopener noreferrer" href="https://medium.com/publishous/filling-the-data-gaps-causes-ai-to-make-up-false-facts-7895b79711db">Filling The Data Gaps Causes AI To Make Up False Facts</a></li>
  <li><a target="_blank" rel="noopener noreferrer" href="https://www.psychologytoday.com/gb/blog/urban-survival/202507/the-emerging-problem-of-ai-psychosis">Psychology Today: The Emerging Problem of "AI Psychosis"</a></li>
  <li><a target="_blank" rel="noopener noreferrer" href="https://www.wired.com/story/human-misuse-will-make-artificial-intelligence-more-dangerous/">Wired: Worry About Misuse of AI, Not Superintelligence</a></li>
  </ul>`;

  // use the same bubble style for the extra reading links (no separate color so it matches)
  replaceTypingWithText(t.bubble, `${risksHtml}<p style="margin-top:8px">${links}</p>`);
}

async function handleThird(question){
  // final message: lock conversation
  const t = addBotTyping();
  await delay(700);
  replaceTypingWithText(t.bubble, `I have reached my design limits. Was this useful? Consider donating <a target="_blank" rel="noopener noreferrer" href="https://buymeacoffee.com/pacha">here</a>.`);

  // darken chat area and prevent further input
  // add a locked class to the app, disable the composer
  const appEl = document.querySelector('.app');
  if (appEl) appEl.classList.add('locked');

  // disable composer elements
  FORM.querySelectorAll('input,button').forEach(el=>{
    try{ el.disabled = true; }catch(e){/*ignore*/}
  });

  // show reset control (header button)
  const resetBtn = document.getElementById('reset');
  if (resetBtn) resetBtn.hidden = false;

  // mark a small persistent note
  const note = document.createElement('div');
  note.className = 'meta';
  note.style.opacity = '0.9';
  note.textContent = 'This conversation has reached the design limits for this demo and has been locked.';
  CHAT.appendChild(note);
  scrollToBottom();
}

// reset conversation
function resetConversation(){
  // clear chat
  CHAT.innerHTML = '';
  sessionAskCount = 0;

  // remove lock state and re-enable composer
  const appEl = document.querySelector('.app');
  if (appEl) appEl.classList.remove('locked');
  FORM.querySelectorAll('input,button').forEach(el=>{ try{ el.disabled = false; }catch(e){} });

  // hide reset button again
  const resetBtn = document.getElementById('reset');
  if (resetBtn) resetBtn.hidden = true;

  // re-add welcome message
  const {row, bubble} = mkRow('them', `Hi — I'm Akrag. I'm a software, not a real human. Try asking something like "How to bake cookies in air fryer"`);
  CHAT.appendChild(row);
  scrollToBottom();
}

// wire reset button
const resetBtnEl = document.getElementById('reset');
if (resetBtnEl){
  resetBtnEl.addEventListener('click', resetConversation);
}

function delay(ms){return new Promise(r=>setTimeout(r, ms));}

function escapeHtml(s=''){return String(s).replace(/[&<>"]/g, function(c){
  return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];
});}

FORM.addEventListener('submit', async (ev)=>{
  ev.preventDefault();
  const q = INPUT.value.trim();
  if (!q) return;

  // if composer is disabled, ignore
  if (INPUT.disabled) return;

  addUserMessage(escapeHtml(q));
  INPUT.value = '';

  sessionAskCount += 1;

  try{
    if (sessionAskCount === 1){
      await handleFirst(q);
    }else if (sessionAskCount === 2){
      await handleSecond(q);
    }else if (sessionAskCount === 3){
      await handleThird(q);
    }else{
      // further messages after lock: do nothing (safeguard)
      const t = addBotTyping();
      await delay(400);
      replaceTypingWithText(t.bubble, `I've already reached my design limits — this chat is locked.`);
    }
  }catch(err){
    console.error('handler error', err);
  }
});

// start
(async ()=>{
  await tryLoadCSV();
  // initial welcome message
  const {row, bubble} = mkRow('them', `Hi — I'm Akrag. I'm a software, not a real human. Try asking something like "How to bake cookies in air fryer"`);
  CHAT.appendChild(row);
})();
