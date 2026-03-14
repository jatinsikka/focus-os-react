import { useReducer, useRef, useEffect, useState, useCallback } from 'react';
import './index.css';
import { MCFG, QUOTES, NATURE_ART, MOOD_TIPS, URGE_FALLBACKS, DEF } from './data/constants';
import { loadState, saveState, loadDark, saveDark, loadColWidths, saveColWidths, loadNotionCreds, saveNotionCreds } from './utils/storage';
import { pad, ms2t, relTime } from './utils/helpers';

// ── Reducer ──────────────────────────────────────────────────────────────────
function reducer(state, action) {
  switch (action.type) {
    case 'SET': return { ...state, ...action.payload };
    case 'ADD_TASK': {
      return { ...state, tasks: [...state.tasks, action.payload], idc: state.idc + 1 };
    }
    case 'TOGGLE_DONE': {
      const tasks = state.tasks.map(t =>
        t.id === action.id ? { ...t, done: !t.done } : t
      );
      return { ...state, tasks };
    }
    case 'DEL_TASK': {
      const tasks = state.tasks.filter(t => t.id !== action.id);
      const activeId = state.activeId === action.id ? null : state.activeId;
      return { ...state, tasks, activeId };
    }
    case 'FOCUS_TASK':
      return { ...state, activeId: action.id };
    case 'SAVE_NOTE': {
      const tasks = state.tasks.map(t =>
        t.id === action.id ? { ...t, note: action.note } : t
      );
      return { ...state, tasks };
    }
    case 'INC_POMS': {
      const tasks = state.tasks.map(t =>
        t.id === action.id ? { ...t, poms: (t.poms || 0) + 1 } : t
      );
      return { ...state, tasks };
    }
    case 'ADD_WIN': {
      const wins = [...(state.wins || []), { text: action.text, done: false }];
      return { ...state, wins };
    }
    case 'TOGGLE_WIN': {
      const wins = (state.wins || []).map((w, i) =>
        i === action.idx ? { ...w, done: !w.done } : w
      );
      return { ...state, wins };
    }
    case 'SET_MOOD':
      return { ...state, mood: action.mood };
    case 'ADD_LOG': {
      const n = new Date();
      const t = `${pad(n.getHours())}:${pad(n.getMinutes())}`;
      const log = [...(state.log || []), { t, text: action.text, type: action.logType }];
      return { ...state, log };
    }
    case 'LOG_URGE': {
      const n = new Date();
      const t = `${pad(n.getHours())}:${pad(n.getMinutes())}`;
      const log = [...(state.log || []), { t, text: action.text, type: 'd' }];
      return { ...state, urges: state.urges + 1, lastUrge: Date.now(), log };
    }
    case 'INC_SESSION':
      return { ...state, sessions: state.sessions + 1 };
    case 'ADD_FMINS':
      return { ...state, fmins: state.fmins + action.amt };
    case 'SET_SPOT_TOKEN':
      return { ...state, spotToken: action.token };
    case 'INC_POMS_ACTIVE': {
      if (state.activeId === null) return state;
      const tasks = state.tasks.map(t =>
        t.id === state.activeId ? { ...t, poms: (t.poms || 0) + 1 } : t
      );
      return { ...state, tasks };
    }
    default:
      return state;
  }
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  // ── State init ──
  const [S, dispatch] = useReducer(reducer, null, () => {
    const saved = loadState();
    const today = new Date().toDateString();
    if (saved.lastDate !== today) {
      let history = saved.history || [];
      if (saved.lastDate && (saved.sessions > 0 || saved.tasks.length > 0)) {
        history = [
          {
            date: saved.lastDate,
            sessions: saved.sessions,
            fmins: Math.round(saved.fmins),
            tt: saved.tasks.length,
            td: saved.tasks.filter(t => t.done).length,
            urges: saved.urges,
            log: [...(saved.log || [])],
          },
          ...history,
        ].slice(0, 60);
      }
      let streak = saved.streak || 0;
      if (saved.lastDate) {
        const prev = new Date(saved.lastDate), now = new Date();
        streak = Math.round((now - prev) / 86400000) <= 1 ? streak + 1 : 0;
      }
      return {
        ...DEF,
        ...saved,
        history,
        streak,
        sessions: 0, fmins: 0, urges: 0, mood: -1,
        log: [], wins: [],
        tasks: (saved.tasks || []).filter(t => !t.done),
        lastDate: today,
        activeId: null,
      };
    }
    return saved;
  });

  // Persist state on every change
  const prevSRef = useRef(S);
  useEffect(() => {
    prevSRef.current = S;
    saveState(S);
  });

  // ── Timer state ──
  const [cmode, setCmode] = useState('work');
  const [total, setTotal] = useState(1500);
  const [remain, setRemain] = useState(1500);
  const [running, setRunning] = useState(false);
  const timerRef = useRef(null);
  const cmodeRef = useRef('work');
  const totalRef = useRef(1500);
  const runningRef = useRef(false);
  const SRef = useRef(S);
  SRef.current = S;

  // Keep refs in sync
  useEffect(() => { cmodeRef.current = cmode; }, [cmode]);
  useEffect(() => { totalRef.current = total; }, [total]);
  useEffect(() => { runningRef.current = running; }, [running]);

  // ── UI state ──
  const [tab, setTab] = useState('dash');
  const [dark, setDark] = useState(() => loadDark());
  const [taskFilter, setTaskFilter] = useState('all');
  const [openNotes, setOpenNotes] = useState({});
  const [taskInputVal, setTaskInputVal] = useState('');
  const [taskPri, setTaskPri] = useState('mid');
  const [taskEst, setTaskEst] = useState('');
  const [ignInput, setIgnInput] = useState('');
  const [winInput, setWinInput] = useState('');
  const [logNote, setLogNote] = useState('');
  const [aiInput, setAiInput] = useState('');
  const [aiText, setAiText] = useState('');
  const [aiHdr, setAiHdr] = useState('');
  const [aiOn, setAiOn] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastOn, setToastOn] = useState(false);
  const toastTimerRef = useRef(null);
  const [focusLockOn, setFocusLockOn] = useState(false);
  const [notionModalOn, setNotionModalOn] = useState(false);
  const [notionTokenVal, setNotionTokenVal] = useState('');
  const [notionDbVal, setNotionDbVal] = useState('');
  const [notionStatus, setNotionStatus] = useState({ msg: '', cls: '' });
  const notionCredsRef = useRef(loadNotionCreds());
  const [notionBtnState, setNotionBtnState] = useState({});

  // ── Clock / Nature ──
  const [clock, setClock] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [greetLine, setGreetLine] = useState('');
  const [natSub, setNatSub] = useState('');
  const [natIdx, setNatIdx] = useState(0);
  const [qIdx, setQIdx] = useState(() => Math.floor(Math.random() * QUOTES.length));
  const [cleanMins, setCleanMins] = useState(0);
  const cleanSinceRef = useRef(S.lastUrge || Date.now());

  // ── Spotify ──
  const [spotConnected, setSpotConnected] = useState(false);
  const [spotPlaying, setSpotPlaying] = useState(false);
  const [spotDur, setSpotDur] = useState(0);
  const [spotPos, setSpotPos] = useState(0);
  const [trackName, setTrackName] = useState('Nothing playing');
  const [trackArtist, setTrackArtist] = useState('—');
  const [albumArtUrl, setAlbumArtUrl] = useState('');
  const [vol, setVol] = useState(70);
  const [shuffleOn, setShuffleOn] = useState(false);
  const [activePl, setActivePl] = useState(-1);
  const [spotTokenInput, setSpotTokenInput] = useState('');
  const spotTokenRef = useRef(S.spotToken || null);
  const spotPosIvRef = useRef(null);
  const spotPollIvRef = useRef(null);
  const spotPlayingRef = useRef(false);
  const spotDurRef = useRef(0);
  const spotPosRef = useRef(0);
  spotPlayingRef.current = spotPlaying;
  spotDurRef.current = spotDur;
  spotPosRef.current = spotPos;

  // ── Dark mode ──
  useEffect(() => {
    if (dark) document.body.classList.add('dark');
    else document.body.classList.remove('dark');
    saveDark(dark);
  }, [dark]);

  // ── Clock tick ──
  useEffect(() => {
    function tick() {
      const n = new Date();
      const h = n.getHours(), m = n.getMinutes();
      setClock(`${pad(h)}:${pad(m)}`);
      const opts = { weekday: 'long', month: 'long', day: 'numeric' };
      setDateStr(n.toLocaleDateString('en-US', opts));
      setGreetLine(
        h < 12 ? 'take a deep breath first.'
          : h < 17 ? 'keep the momentum going.'
          : 'one last push today.'
      );
      setNatSub(
        h < 12 ? 'Morning light, fresh start.'
          : h < 17 ? 'Afternoon — stay steady.'
          : 'Evening — finish strong.'
      );
    }
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  // ── Nature cycle ──
  useEffect(() => {
    const iv = setInterval(() => {
      setNatIdx(i => (i + 1) % NATURE_ART.length);
    }, 8000);
    return () => clearInterval(iv);
  }, []);

  // ── Clean timer ──
  useEffect(() => {
    const iv = setInterval(() => {
      setCleanMins(Math.floor((Date.now() - cleanSinceRef.current) / 60000));
    }, 15000);
    setCleanMins(Math.floor((Date.now() - cleanSinceRef.current) / 60000));
    return () => clearInterval(iv);
  }, []);

  // ── Document title ──
  useEffect(() => {
    if (running) {
      document.title = `${pad(Math.floor(remain / 60))}:${pad(remain % 60)} — Focus OS`;
    } else {
      document.title = 'Focus OS';
    }
  }, [running, remain]);

  // ── Toast ──
  const toast = useCallback((msg) => {
    setToastMsg(msg);
    setToastOn(true);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastOn(false), 3000);
  }, []);

  // ── Add log ──
  const addLog = useCallback((text, logType) => {
    dispatch({ type: 'ADD_LOG', text, logType });
  }, []);

  // ── Timer done callback ──
  const onTimerDone = useCallback((mode, tot) => {
    setRunning(false);
    runningRef.current = false;
    clearInterval(timerRef.current);
    setRemain(tot);

    if (mode === 'work') {
      dispatch({ type: 'INC_SESSION' });
      dispatch({ type: 'INC_POMS_ACTIVE' });
      addLog(`✓ Session complete`, 'f');
      toast(`Session done — rest for 5 minutes 🌿`);
      try { new Notification('Focus OS', { body: 'Session done! Take a break.' }); } catch (e) { /* ignore */ }
    } else {
      toast('Break over — back to work 🌱');
      addLog('☕ Break complete', 'b');
    }
  }, [addLog, toast]);

  // ── Toggle timer ──
  const toggleTimer = useCallback(() => {
    if (runningRef.current) {
      clearInterval(timerRef.current);
      setRunning(false);
      runningRef.current = false;
    } else {
      setRunning(true);
      runningRef.current = true;
      const capturedMode = cmodeRef.current;
      const capturedTotal = totalRef.current;
      if (capturedMode === 'work') {
        const cur = SRef.current;
        const activeTask = cur.tasks.find(t => t.id === cur.activeId);
        addLog(`▶ Started: "${activeTask ? activeTask.name : 'open work'}"`, 'f');
      }
      timerRef.current = setInterval(() => {
        setRemain(r => {
          if (r <= 1) {
            onTimerDone(cmodeRef.current, totalRef.current);
            return totalRef.current;
          }
          const next = r - 1;
          if (cmodeRef.current === 'work') {
            dispatch({ type: 'ADD_FMINS', amt: 1 / 60 });
          }
          return next;
        });
      }, 1000);
    }
  }, [addLog, onTimerDone]);

  const resetTimer = useCallback(() => {
    clearInterval(timerRef.current);
    setRunning(false);
    runningRef.current = false;
    setRemain(totalRef.current);
    document.title = 'Focus OS';
  }, []);

  const setMode = useCallback((m) => {
    if (runningRef.current) return;
    let mins = MCFG[m].m;
    if (m === 'custom') {
      const x = parseInt(prompt('Minutes:', '50') || '25');
      if (isNaN(x) || x < 1) return;
      mins = x;
      MCFG.custom.m = mins;
    }
    setCmode(m);
    cmodeRef.current = m;
    const newTotal = mins * 60;
    setTotal(newTotal);
    totalRef.current = newTotal;
    setRemain(newTotal);
    document.title = 'Focus OS';
  }, []);

  // ── Task functions ──
  const addTask = useCallback(() => {
    const v = taskInputVal.trim();
    if (!v) return;
    const est = parseInt(taskEst) || null;
    const id = SRef.current.idc;
    dispatch({
      type: 'ADD_TASK',
      payload: { id, name: v, done: false, pri: taskPri, est, poms: 0, note: '', added: Date.now() }
    });
    setTaskInputVal('');
    setTaskEst('');
  }, [taskInputVal, taskPri, taskEst]);

  const toggleDone = useCallback((id) => {
    const task = SRef.current.tasks.find(t => t.id === id);
    if (task && !task.done) addLog(`✓ Done: "${task.name}"`, 't');
    dispatch({ type: 'TOGGLE_DONE', id });
  }, [addLog]);

  const delTask = useCallback((id) => {
    dispatch({ type: 'DEL_TASK', id });
  }, []);

  const focusTask = useCallback((id) => {
    const task = SRef.current.tasks.find(t => t.id === id);
    if (task) addLog(`⊙ Focusing on: "${task.name}"`, 'f');
    dispatch({ type: 'FOCUS_TASK', id });
  }, [addLog]);

  const saveNote = useCallback((id, note) => {
    dispatch({ type: 'SAVE_NOTE', id, note });
  }, []);

  // ── Ignite ──
  const ignite = useCallback(() => {
    const v = ignInput.trim();
    if (!v) { toast('Write your intention first 🌱'); return; }
    const id = SRef.current.idc;
    dispatch({
      type: 'ADD_TASK',
      payload: { id, name: v, done: false, pri: 'high', est: null, poms: 0, note: '', added: Date.now() }
    });
    dispatch({ type: 'FOCUS_TASK', id });
    addLog(`🌱 Intention: "${v}"`, 'f');
    setIgnInput('');
    toast('Intention set. Timer starts — go 🌿');
    if (!runningRef.current) toggleTimer();
  }, [ignInput, addLog, toast, toggleTimer]);

  // ── Mood ──
  const setMoodFn = useCallback((i) => {
    dispatch({ type: 'SET_MOOD', mood: i });
    const labels = ['🌅 Fresh', '🧠 Focused', '😤 Restless', '😶‍🌫️ Foggy', '😰 Anxious', '🔥 Peak'];
    addLog(`Mood: ${labels[i]}`, 'n');
  }, [addLog]);

  // ── Wins ──
  const addWin = useCallback(() => {
    const v = winInput.trim();
    if (!v) return;
    if ((SRef.current.wins || []).length >= 3) { toast('Max 3 wins — tick one first!'); return; }
    dispatch({ type: 'ADD_WIN', text: v });
    setWinInput('');
  }, [winInput, toast]);

  const toggleWin = useCallback((idx) => {
    const w = SRef.current.wins[idx];
    if (w && !w.done) addLog(`🏆 Win: "${w.text}"`, 't');
    dispatch({ type: 'TOGGLE_WIN', idx });
  }, [addLog]);

  // ── Urge Guard / AI ──
  const typeText = useCallback((text) => {
    setAiText('');
    let i = 0;
    const iv = setInterval(() => {
      if (i < text.length) {
        setAiText(prev => prev + text[i]);
        i++;
      } else {
        clearInterval(iv);
      }
    }, 16);
  }, []);

  const showAI = useCallback((text, custom) => {
    setAiOn(true);
    setAiText('');
    setAiHdr('thinking…');
    const sys = 'You are a warm, grounded focus coach. Keep responses to 2-3 sentences. Plain prose, no bullets. Empathetic but action-oriented. Speak like a calm friend.';
    const promptMsg = custom
      ? `The user says: "${text}". They want to stay focused. Give a brief, warm, practical 2-3 sentence response.`
      : `The user felt an urge: ${text}. They're in a focus session and resisted it. Briefly acknowledge + redirect in 2-3 sentences.`;
    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 180, system: sys, messages: [{ role: 'user', content: promptMsg }] })
    }).then(r => r.json()).then(d => {
      const resp = d.content?.[0]?.text;
      setAiHdr('Claude');
      if (resp) typeText(resp);
      else setAiText(URGE_FALLBACKS[text] || "You noticed the urge. That's the win. Take one breath and return.");
    }).catch(() => {
      setAiHdr('Reminder');
      setAiText(URGE_FALLBACKS[text] || "You noticed the urge. That's the win. Take one breath and return.");
    });
  }, [typeText]);

  const logUrge = useCallback((type, emoji) => {
    cleanSinceRef.current = Date.now();
    setCleanMins(0);
    dispatch({ type: 'LOG_URGE', text: `${emoji} Urge: ${type} (noticed)` });
    showAI(type, false);
  }, [showAI]);

  const askAI = useCallback(() => {
    const v = aiInput.trim();
    if (!v) return;
    setAiInput('');
    showAI(v, true);
    addLog(`💬 "${v.slice(0, 40)}"`, 'n');
  }, [aiInput, showAI, addLog]);

  // ── Log note ──
  const addNote = useCallback(() => {
    const v = logNote.trim();
    if (!v) return;
    addLog(v, 'n');
    setLogNote('');
  }, [logNote, addLog]);

  // ── Quotes ──
  const nextQ = useCallback(() => {
    setQIdx(i => (i + 1) % QUOTES.length);
  }, []);

  // ── Focus Lock ──
  const openFL = useCallback(() => setFocusLockOn(true), []);
  const closeFL = useCallback(() => setFocusLockOn(false), []);

  // ── Notion ──
  const openNotionModal = useCallback(() => {
    const creds = notionCredsRef.current;
    setNotionTokenVal(creds.token);
    setNotionDbVal(creds.dbId);
    setNotionStatus({ msg: creds.token ? '✓ Connected' : '', cls: creds.token ? 'ok' : '' });
    setNotionModalOn(true);
  }, []);

  const closeNotionModal = useCallback(() => setNotionModalOn(false), []);

  const saveNotionCredsFn = useCallback(async () => {
    const t = notionTokenVal.trim();
    const d = notionDbVal.trim().replace(/-/g, '');
    if (!t || !d) { setNotionStatus({ msg: 'Please fill both fields.', cls: 'err' }); return; }
    setNotionStatus({ msg: 'Testing connection…', cls: '' });
    try {
      const r = await fetch(
        `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://api.notion.com/v1/databases/${d}`)}`,
        { headers: { Authorization: `Bearer ${t}`, 'Notion-Version': '2022-06-28' } }
      );
      if (!r.ok) throw new Error('bad');
      notionCredsRef.current = { token: t, dbId: d };
      saveNotionCreds(t, d);
      setNotionStatus({ msg: '✓ Connected to Notion!', cls: 'ok' });
      setTimeout(closeNotionModal, 1200);
    } catch {
      notionCredsRef.current = { token: t, dbId: d };
      saveNotionCreds(t, d);
      setNotionStatus({ msg: 'Saved. (Could not verify — CORS may block preview, but push will work from a server.)', cls: 'ok' });
      setTimeout(closeNotionModal, 2200);
    }
  }, [notionTokenVal, notionDbVal, closeNotionModal]);

  const pushToNotion = useCallback(async (id) => {
    const task = SRef.current.tasks.find(t => t.id === id);
    if (!task) return;
    const { token, dbId } = notionCredsRef.current;
    if (!token || !dbId) {
      openNotionModal();
      setNotionStatus({ msg: 'Connect Notion first, then retry.', cls: 'err' });
      return;
    }
    setNotionBtnState(prev => ({ ...prev, [id]: '⏳' }));
    const priMap = { high: 'High', mid: 'Medium', low: 'Low' };
    const body = {
      parent: { database_id: dbId.replace(/-/g, '') },
      properties: {
        Name: { title: [{ text: { content: task.name } }] },
        Priority: { select: { name: priMap[task.pri] || 'Medium' } },
        Status: { select: { name: task.done ? 'Done' : 'To Do' } },
      }
    };
    if (task.est) body.properties['Estimate'] = { number: task.est };
    if (task.note) body.properties['Notes'] = { rich_text: [{ text: { content: task.note } }] };
    try {
      const r = await fetch(
        'https://api.allorigins.win/raw?url=' + encodeURIComponent('https://api.notion.com/v1/pages'),
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }
      );
      const data = await r.json();
      if (data.id || data.object === 'page') {
        toast(`✓ "${task.name}" pushed to Notion!`);
        addLog(`◻ Sent to Notion: "${task.name}"`, 'n');
        setNotionBtnState(prev => ({ ...prev, [id]: '✓' }));
        setTimeout(() => setNotionBtnState(prev => ({ ...prev, [id]: null })), 1500);
      } else {
        throw new Error(data.message || 'unknown');
      }
    } catch {
      toast('Direct push blocked — opening Notion instead.');
      window.open(`https://www.notion.so/new?title=${encodeURIComponent(task.name)}`, '_blank');
      setNotionBtnState(prev => ({ ...prev, [id]: null }));
    }
  }, [openNotionModal, toast, addLog]);

  // ── Spotify ──
  const updatePlayer = useCallback((d) => {
    if (!d || !d.item) return;
    const playing = d.is_playing;
    const dur = d.item.duration_ms;
    const pos = d.progress_ms || 0;
    setSpotPlaying(playing);
    setSpotDur(dur);
    setSpotPos(pos);
    spotPlayingRef.current = playing;
    spotDurRef.current = dur;
    spotPosRef.current = pos;
    setTrackName(d.item.name || '—');
    setTrackArtist((d.item.artists || []).map(a => a.name).join(', '));
    setAlbumArtUrl(d.item.album?.images?.[0]?.url || '');
    setVol(d.device?.volume_percent || 70);
    clearInterval(spotPosIvRef.current);
    if (playing) {
      spotPosIvRef.current = setInterval(() => {
        setSpotPos(p => {
          const next = Math.min(p + 1000, spotDurRef.current);
          spotPosRef.current = next;
          return next;
        });
      }, 1000);
    }
  }, []);

  const fetchTrack = useCallback(async () => {
    if (!spotTokenRef.current) return false;
    try {
      const r = await fetch('https://api.spotify.com/v1/me/player', {
        headers: { Authorization: `Bearer ${spotTokenRef.current}` }
      });
      if (r.status === 204) return true;
      if (r.status === 401) return false;
      if (!r.ok) return false;
      updatePlayer(await r.json());
      return true;
    } catch { return false; }
  }, [updatePlayer]);

  const startSpotPoll = useCallback(() => {
    clearInterval(spotPollIvRef.current);
    spotPollIvRef.current = setInterval(fetchTrack, 10000);
  }, [fetchTrack]);

  const tryAutoSpot = useCallback(async () => {
    if (!spotTokenRef.current) return;
    const ok = await fetchTrack();
    if (ok) {
      setSpotConnected(true);
      startSpotPoll();
    } else {
      toast('Spotify token expired — reconnect');
    }
  }, [fetchTrack, startSpotPoll, toast]);

  // ── Init effects ──
  useEffect(() => {
    if (S.spotToken) {
      spotTokenRef.current = S.spotToken;
      tryAutoSpot();
    }
    try { Notification.requestPermission(); } catch (e) { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connectSpot = useCallback(() => {
    const t = spotTokenInput.trim();
    if (!t) { toast('Paste your Spotify token first 🎵'); return; }
    spotTokenRef.current = t;
    dispatch({ type: 'SET_SPOT_TOKEN', token: t });
    tryAutoSpot();
  }, [spotTokenInput, toast, tryAutoSpot]);

  const disconnectSpot = useCallback(() => {
    dispatch({ type: 'SET_SPOT_TOKEN', token: null });
    spotTokenRef.current = null;
    setSpotConnected(false);
    setSpotTokenInput('');
    clearInterval(spotPollIvRef.current);
    clearInterval(spotPosIvRef.current);
  }, []);

  const sCmd = useCallback(async (ep, method = 'POST', body = null) => {
    if (!spotTokenRef.current) return;
    const o = { method, headers: { Authorization: `Bearer ${spotTokenRef.current}`, 'Content-Type': 'application/json' } };
    if (body) o.body = JSON.stringify(body);
    await fetch(`https://api.spotify.com/v1/me/player${ep}`, o);
    setTimeout(fetchTrack, 500);
  }, [fetchTrack]);

  const spotToggle = useCallback(() => {
    spotPlayingRef.current ? sCmd('/pause') : sCmd('/play');
  }, [sCmd]);
  const spotNext = useCallback(() => sCmd('/next'), [sCmd]);
  const spotPrev = useCallback(() => sCmd('/previous'), [sCmd]);
  const spotShuffle = useCallback(async () => {
    const next = !shuffleOn;
    setShuffleOn(next);
    await sCmd(`/shuffle?state=${next}`);
  }, [shuffleOn, sCmd]);
  const spotVol = useCallback((v) => { setVol(v); sCmd(`/volume?volume_percent=${v}`, 'PUT'); }, [sCmd]);
  const seekSpot = useCallback((e) => {
    if (!spotDurRef.current) return;
    const rail = e.currentTarget.querySelector('.prog-rail');
    const pct = (e.clientX - rail.getBoundingClientRect().left) / rail.clientWidth;
    sCmd(`/seek?position_ms=${Math.floor(pct * spotDurRef.current)}`, 'PUT');
  }, [sCmd]);
  const playList = useCallback(async (q, idx) => {
    if (!spotTokenRef.current) { toast('Connect Spotify first 🎵'); return; }
    setActivePl(idx);
    try {
      const r = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=playlist&limit=1`,
        { headers: { Authorization: `Bearer ${spotTokenRef.current}` } }
      );
      const d = await r.json();
      const pl = d.playlists?.items?.[0];
      if (pl) { await sCmd('/play', 'PUT', { context_uri: pl.uri }); setTimeout(fetchTrack, 700); }
      else toast('No playlist found');
    } catch { toast('Spotify search failed'); }
  }, [sCmd, fetchTrack, toast]);

  // ── Column resizer ──
  const col0Ref = useRef(null);
  const col1Ref = useRef(null);
  const col2Ref = useRef(null);
  const resizer1Ref = useRef(null);
  const resizer2Ref = useRef(null);

  useEffect(() => {
    const saved = loadColWidths();
    if (saved) {
      const refs = [col0Ref, col1Ref, col2Ref];
      saved.forEach((w, i) => { if (refs[i].current) refs[i].current.style.width = w; });
    }
  }, []);

  useEffect(() => {
    function initResizer(resizer, leftRef, rightRef, isLast) {
      if (!resizer) return () => {};
      function onMouseDown(e) {
        e.preventDefault();
        const startX = e.clientX;
        const startLeftW = leftRef.current.getBoundingClientRect().width;
        const startRightW = rightRef.current.getBoundingClientRect().width;
        resizer.classList.add('dragging');
        document.body.classList.add('resizing');
        function onMove(e2) {
          const dx = e2.clientX - startX;
          const newLeft = Math.max(200, startLeftW + dx);
          const newRight = Math.max(200, startRightW - dx);
          leftRef.current.style.width = newLeft + 'px';
          leftRef.current.style.flex = 'none';
          if (isLast) {
            rightRef.current.style.flex = '1';
            rightRef.current.style.width = '';
          } else {
            rightRef.current.style.width = newRight + 'px';
            rightRef.current.style.flex = 'none';
          }
        }
        function onUp() {
          resizer.classList.remove('dragging');
          document.body.classList.remove('resizing');
          const widths = [col0Ref, col1Ref, col2Ref].map(r =>
            r.current ? (r.current.style.width || r.current.getBoundingClientRect().width + 'px') : ''
          );
          saveColWidths(widths);
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
        }
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      }
      resizer.addEventListener('mousedown', onMouseDown);
      return () => resizer.removeEventListener('mousedown', onMouseDown);
    }
    const c1 = initResizer(resizer1Ref.current, col0Ref, col1Ref, false);
    const c2 = initResizer(resizer2Ref.current, col1Ref, col2Ref, true);
    return () => { c1(); c2(); };
  }, []);

  // ── Derived values ──
  const ringC = 2 * Math.PI * 62;
  const ringOffset = ringC * (1 - remain / total);
  const isBrk = cmode !== 'work';
  const timerDisp = `${pad(Math.floor(remain / 60))}:${pad(remain % 60)}`;
  const timerLbl = MCFG[cmode].l;
  const tMainLbl = running ? 'Pause' : remain === total ? 'Start' : 'Resume';

  const activeTask = S.tasks.find(t => t.id === S.activeId);
  const sdCount = S.sessions % 4 || (S.sessions > 0 && S.sessions % 4 === 0 ? 4 : 0);

  let filteredTasks = [...S.tasks];
  if (taskFilter === 'active') filteredTasks = filteredTasks.filter(t => !t.done);
  else if (taskFilter === 'done') filteredTasks = filteredTasks.filter(t => t.done);
  else if (taskFilter === 'high') filteredTasks = filteredTasks.filter(t => t.pri === 'high');
  const po = { high: 0, mid: 1, low: 2 };
  filteredTasks.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return (po[a.pri] || 1) - (po[b.pri] || 1);
  });

  const tot = S.tasks.length, dn = S.tasks.filter(t => t.done).length;
  const progPct = tot ? (dn / tot * 100) : 0;
  const fminsRounded = Math.round(S.fmins);
  const focusDisp = fminsRounded >= 60 ? `${Math.floor(fminsRounded / 60)}h${fminsRounded % 60}m` : `${fminsRounded}m`;
  const urgeRailPct = Math.min(S.urges / 10 * 100, 100);
  const progFillPct = spotDur ? spotPos / spotDur * 100 : 0;

  const BL = { f: 'lb-f', t: 'lb-t', b: 'lb-b', n: 'lb-n', d: 'lb-d' };
  const BT = { f: 'Focus', t: 'Task', b: 'Break', n: 'Note', d: 'Urge' };

  const h = S.history || [];
  const hTs = h.reduce((a, d) => a + d.sessions, 0);
  const hTf = h.reduce((a, d) => a + d.fmins, 0);
  const hTu = h.reduce((a, d) => a + (d.urges || 0), 0);

  const PLAYLISTS = [
    { q: 'lofi hip hop chill study beats', emoji: '☕', name: 'Lofi Study' },
    { q: 'deep focus classical piano instrumental', emoji: '🎹', name: 'Focus Piano' },
    { q: 'ambient nature sounds work', emoji: '🌿', name: 'Nature Ambient' },
    { q: 'binaural beats alpha waves focus', emoji: '🧠', name: 'Binaural Focus' },
  ];

  const MOODS = [
    { icon: '🌅', word: 'Fresh' },
    { icon: '🧠', word: 'Focused' },
    { icon: '😤', word: 'Restless' },
    { icon: '😶‍🌫️', word: 'Foggy' },
    { icon: '😰', word: 'Anxious' },
    { icon: '🔥', word: 'Peak' },
  ];

  const nowH = new Date().getHours();
  const greeting = nowH < 12 ? 'Good morning,' : nowH < 17 ? 'Good afternoon,' : 'Good evening,';

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="shell">
      {/* ── TOP BAR ── */}
      <header className="topbar">
        <div className="logo">
          <div className="logo-leaf">🌿</div>
          Focus OS
        </div>
        <nav className="nav-pills">
          <button className={`nav-pill${tab === 'dash' ? ' on' : ''}`} onClick={() => setTab('dash')}>Today</button>
          <button className={`nav-pill${tab === 'hist' ? ' on' : ''}`} onClick={() => setTab('hist')}>History</button>
        </nav>
        <div className="topbar-mid">
          <span className="date-chip">{dateStr}</span>
        </div>
        <div className="topbar-right">
          <span className="clock-display">{clock}</span>
          <div className="dark-toggle-wrap">
            <span>{dark ? '☀️' : '🌙'}</span>
            <button className="dark-toggle" onClick={() => setDark(d => !d)} title="Toggle dark mode" />
          </div>
          <button
            onClick={openNotionModal}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, border: '1.5px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-2)', fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 0.18s' }}
          >
            <span style={{ fontSize: 14 }}>◻</span> Notion
          </button>
          <div className="streak-pill">🌿 <span>{S.streak || 0}</span> day streak</div>
        </div>
      </header>

      {/* ── NOTION MODAL ── */}
      <div className={`notion-modal${notionModalOn ? ' on' : ''}`} onClick={e => { if (e.target === e.currentTarget) closeNotionModal(); }}>
        <div className="notion-box">
          <h3><span>◻</span> Notion Integration</h3>
          <p>Connect your Notion workspace to push tasks directly to a Notion database — one click per task.</p>
          <div className="notion-setup">
            <div>
              <div className="notion-field-label">Integration Token</div>
              <input className="field" value={notionTokenVal} onChange={e => setNotionTokenVal(e.target.value)} placeholder="secret_xxxxxxxxxxxx" style={{ fontFamily: 'var(--mono)', fontSize: 11, padding: '9px 12px' }} />
              <div className="notion-how">Create one at <a href="https://www.notion.so/my-integrations" target="_blank" rel="noreferrer">notion.so/my-integrations</a> → New integration → copy the Internal Integration Token.</div>
            </div>
            <div>
              <div className="notion-field-label">Database ID</div>
              <input className="field" value={notionDbVal} onChange={e => setNotionDbVal(e.target.value)} placeholder="32-character database ID" style={{ fontFamily: 'var(--mono)', fontSize: 11, padding: '9px 12px' }} />
              <div className="notion-how">Open your Notion database → copy from the URL: notion.so/workspace/<strong>DATABASE_ID</strong>?v=… Share the database with your integration.</div>
            </div>
            <div className="notion-actions">
              <button className="notion-save-btn" onClick={saveNotionCredsFn}><span>◻</span> Save &amp; Connect</button>
              <button className="notion-cancel-btn" onClick={closeNotionModal}>Cancel</button>
            </div>
            <div className={`notion-status${notionStatus.cls ? ' ' + notionStatus.cls : ''}`}>{notionStatus.msg}</div>
          </div>
        </div>
      </div>

      {/* ── DASHBOARD PAGE ── */}
      <div id="page-dash" className={`page${tab === 'dash' ? ' on' : ''}`}>

        {/* ─── LEFT COLUMN ─── */}
        <div className="col" ref={col0Ref}>

          <div className="card nature-card">
            <span className="nature-art">{NATURE_ART[natIdx]}</span>
            <div className="nature-greeting">
              {greeting}<br />
              <em>{greetLine}</em>
            </div>
            <div className="nature-sub">{natSub}</div>
          </div>

          <div className="card">
            <div className="section-label"><div className="section-label-dot" />Today&apos;s Intention</div>
            <p className="intention-text">Name the <span>one thing</span> that would make today feel complete.</p>
            <textarea className="field" rows={2} placeholder="Be specific — 'finish auth flow', not 'work on app'" value={ignInput} onChange={e => setIgnInput(e.target.value)} />
            <button className="launch-btn" onClick={ignite}>
              <span>🌱</span> Begin Today&apos;s Work
            </button>
          </div>

          <div className="card">
            <div className="section-label"><div className="section-label-dot sky" />Mood &amp; Daily Wins</div>
            <div className="mood-row">
              {MOODS.map((m, i) => (
                <button key={i} className={`mood-btn${S.mood === i ? ' on' : ''}`} onClick={() => setMoodFn(i)}>
                  <span className="mood-icon">{m.icon}</span>
                  <span className="mood-word">{m.word}</span>
                </button>
              ))}
            </div>
            <div className="mood-advice">
              {S.mood >= 0
                ? <><strong>{MOOD_TIPS[S.mood].t}</strong>{MOOD_TIPS[S.mood].b}</>
                : <><strong>How are you today?</strong>Select a mood for a personalised action plan.</>
              }
            </div>
            <div style={{ marginTop: 8 }}>
              <div className="section-label" style={{ marginBottom: 6 }}><div className="section-label-dot sand" />3 Wins to Aim For</div>
              {(S.wins || []).map((w, i) => (
                <div key={i} className={`win-item${w.done ? ' done' : ''}`}>
                  <div className={`win-circle${w.done ? ' done' : ''}`} onClick={() => toggleWin(i)}>{w.done ? '✓' : ''}</div>
                  <span className={`win-name${w.done ? ' done' : ''}`}>{w.text}</span>
                </div>
              ))}
              <div className="win-add-row">
                <input className="field" placeholder="A win you'll aim for today…" style={{ padding: '8px 12px', fontSize: 12 }} value={winInput} onChange={e => setWinInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addWin(); }} />
                <button className="task-add-btn" style={{ background: 'var(--sky-soft)' }} onClick={addWin}>+</button>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="section-label"><div className="section-label-dot sand" />Thought for Today</div>
            <div className="quote-body">
              <div className="quote-leaf-bg">🍃</div>
              <button className="quote-next" onClick={nextQ}>↻</button>
              <div className="quote-text">{QUOTES[qIdx].q}</div>
              <div className="quote-attr">{QUOTES[qIdx].a}</div>
            </div>
          </div>

          <div className="card">
            <div className="section-label"><div className="section-label-dot" style={{ background: '#1ed760' }} />Spotify</div>
            {!spotConnected ? (
              <div>
                <div className="spot-connect">
                  <div className="spot-icon">🎵</div>
                  <p>Connect Spotify to play focus music right here without switching tabs.</p>
                </div>
                <input className="spot-token-input" placeholder="Paste OAuth token…" value={spotTokenInput} onChange={e => setSpotTokenInput(e.target.value)} />
                <button className="spot-connect-btn" onClick={connectSpot}>Connect Spotify</button>
                <div className="spot-how">Get a token at <a href="https://developer.spotify.com/console/get-search-item/" target="_blank" rel="noreferrer">Spotify Developer Console</a> → Get Token → paste above.</div>
              </div>
            ) : (
              <div className="player on">
                <div className="now-playing-card">
                  <div className="album-art">
                    {albumArtUrl ? <img src={albumArtUrl} alt="" /> : '🎵'}
                  </div>
                  <div className="track-info">
                    <div className="track-name">{trackName}</div>
                    <div className="track-artist">{trackArtist}</div>
                  </div>
                </div>
                <div className="prog-wrap" onClick={seekSpot}>
                  <div className="prog-rail"><div className="prog-fill" style={{ width: progFillPct + '%' }} /></div>
                  <div className="prog-times"><span>{ms2t(spotPos)}</span><span>{ms2t(spotDur)}</span></div>
                </div>
                <div className="player-controls">
                  <button className="pc-btn" onClick={spotPrev}>⏮</button>
                  <button className="pc-btn play" onClick={spotToggle}>{spotPlaying ? '⏸' : '▶'}</button>
                  <button className="pc-btn" onClick={spotNext}>⏭</button>
                  <button className={`pc-btn${shuffleOn ? ' active' : ''}`} onClick={spotShuffle} title="Shuffle">⇄</button>
                </div>
                <div className="vol-row">
                  <span className="vol-lbl">🔈</span>
                  <input type="range" className="vol" min={0} max={100} value={vol} onChange={e => spotVol(Number(e.target.value))} />
                  <span className="vol-lbl">🔊</span>
                </div>
                <div className="quick-playlists">
                  <div className="qp-title">Quick Playlists</div>
                  {PLAYLISTS.map((pl, idx) => (
                    <div key={idx} className={`qp-item${activePl === idx ? ' active' : ''}`} onClick={() => playList(pl.q, idx)}>
                      <span className="qp-emoji">{pl.emoji}</span>
                      <span className="qp-name">{pl.name}</span>
                    </div>
                  ))}
                </div>
                <div className="spot-disconnect" onClick={disconnectSpot}>Disconnect</div>
              </div>
            )}
          </div>

        </div>

        <div className="col-resizer" ref={resizer1Ref} />

        {/* ─── CENTER COLUMN ─── */}
        <div className="col" ref={col1Ref}>

          <div className="card">
            <div className="section-label"><div className="section-label-dot" />Pomodoro Timer</div>
            <div className="timer-wrap">
              <div className="ring-outer">
                <svg width="110" height="110" viewBox="0 0 140 140">
                  <circle className="ring-bg" cx="70" cy="70" r="62" />
                  <circle
                    className={`ring-fill${isBrk ? ' brk' : ''}`}
                    cx="70" cy="70" r="62"
                    style={{ strokeDasharray: ringC, strokeDashoffset: ringOffset }}
                  />
                </svg>
                <div className="ring-inner">
                  <div className="timer-num">{timerDisp}</div>
                  <div className="timer-lbl">{timerLbl}</div>
                </div>
              </div>
              <div className="timer-right">
                <div className="mode-row">
                  {['work', 'short', 'long', 'custom'].map(m => (
                    <button
                      key={m}
                      className={`mode-btn${m !== 'work' ? ' brk' : ''}${cmode === m ? ' on' : ''}`}
                      onClick={() => setMode(m)}
                    >
                      {m === 'work' ? '25 · Work' : m === 'short' ? '5 · Break' : m === 'long' ? '15 · Long' : 'Custom'}
                    </button>
                  ))}
                </div>
                <div className="focused-task-pill">
                  {activeTask ? (
                    <>
                      <div className="ftp-dot" />
                      <span className="ftp-txt">{activeTask.name}</span>
                    </>
                  ) : (
                    <span className="ftp-ph">← Click Focus on a task below</span>
                  )}
                </div>
                <div className="timer-btn-row">
                  <button className={`t-btn-main${isBrk ? ' brk' : ''}`} onClick={toggleTimer}>{tMainLbl}</button>
                  <button className="t-btn-ghost" onClick={resetTimer}>Reset</button>
                  <button className="t-btn-ghost" onClick={openFL} title="Distraction-free" style={{ padding: '10px 10px' }}>⛶</button>
                </div>
                <div className="session-dots">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className={`s-dot${i <= sdCount ? ' on' : ''}`} />
                  ))}
                  <span className="s-dot-lbl">{S.sessions} session{S.sessions !== 1 ? 's' : ''} today</span>
                </div>
              </div>
            </div>
          </div>

          <div className="card flex-fill" style={{ paddingBottom: 0 }}>
            <div className="section-label"><div className="section-label-dot sky" />Tasks</div>
            <div className="task-add-row">
              <input
                className="field" placeholder="Add a task…"
                style={{ padding: '9px 12px' }}
                value={taskInputVal}
                onChange={e => setTaskInputVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addTask(); }}
              />
              <button className="task-add-btn" onClick={addTask}>+</button>
            </div>
            <div className="task-meta-row">
              <select className="t-select" value={taskPri} onChange={e => setTaskPri(e.target.value)}>
                <option value="high">🔴 High</option>
                <option value="mid">🟡 Mid</option>
                <option value="low">⚪ Low</option>
              </select>
              <input
                className="t-est-input" type="number" min={1} max={480} placeholder="mins"
                value={taskEst} onChange={e => setTaskEst(e.target.value)}
              />
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>est.</span>
            </div>
            <div className="task-prog-rail">
              <div className="task-prog-fill" style={{ width: progPct + '%' }} />
            </div>
            <div className="filter-row">
              {['all', 'active', 'done', 'high'].map(f => (
                <button
                  key={f}
                  className={`filt-btn${taskFilter === f ? ' on' : ''}`}
                  onClick={() => setTaskFilter(f)}
                >
                  {f === 'all' ? 'All' : f === 'active' ? 'Active' : f === 'done' ? 'Done' : 'High priority'}
                </button>
              ))}
            </div>
            <div className="task-list" style={{ paddingBottom: 20 }}>
              {filteredTasks.length === 0 ? (
                <div className="task-empty">
                  <span className="task-empty-icon">🌿</span>
                  {taskFilter === 'all' ? 'Add your first task above…' : `No ${taskFilter} tasks.`}
                </div>
              ) : filteredTasks.map(t => (
                <div
                  key={t.id}
                  className={`task-card-item${t.done ? ' done' : ''}${t.id === S.activeId ? ' focused' : ''}`}
                >
                  <div className="task-row">
                    <div className="task-chk" onClick={e => { e.stopPropagation(); toggleDone(t.id); }}>
                      {t.done ? '✓' : ''}
                    </div>
                    <div className="task-title-wrap">
                      <div className="task-title">{t.name}</div>
                      <div className="task-pills">
                        <span className={`t-pill ${t.pri === 'high' ? 'tp-high' : t.pri === 'mid' ? 'tp-mid' : 'tp-low'}`}>{t.pri}</span>
                        {t.added && <span className="t-pill tp-time">{relTime(t.added)}</span>}
                        {t.est && <span className="t-pill tp-est">~{t.est}m</span>}
                        {t.poms ? <span className="t-pill tp-pom">{t.poms} 🍅</span> : null}
                      </div>
                    </div>
                    <div className="task-actions-col">
                      <button className="ta-btn" onClick={e => { e.stopPropagation(); focusTask(t.id); }}>Focus</button>
                      <button className="ta-btn" onClick={e => { e.stopPropagation(); setOpenNotes(prev => ({ ...prev, [t.id]: !prev[t.id] })); }}>Notes</button>
                      <button className="ta-btn ta-notion" onClick={e => { e.stopPropagation(); pushToNotion(t.id); }} title="Push to Notion">
                        {notionBtnState[t.id] || '◻ Notion'}
                      </button>
                      <button className="ta-btn ta-del" onClick={e => { e.stopPropagation(); delTask(t.id); }}>✕</button>
                    </div>
                  </div>
                  <div className={`task-notes-drawer${openNotes[t.id] || t.note ? ' open' : ''}`}>
                    <textarea
                      className="field task-note-input"
                      placeholder="Notes, context, subtasks…"
                      rows={2}
                      style={{ fontSize: 12, padding: '8px 10px' }}
                      defaultValue={t.note || ''}
                      onBlur={e => saveNote(t.id, e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        <div className="col-resizer" ref={resizer2Ref} />

        {/* ─── RIGHT COLUMN ─── */}
        <div className="col" ref={col2Ref}>

          <div className="card">
            <div className="section-label"><div className="section-label-dot terra" />Urge Guard</div>
            <div className="urge-header">
              <div className="urge-count-wrap">
                <div className="urge-count">{S.urges}</div>
                <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)' }}>Urges today</div>
              </div>
              <div className="urge-clean">
                <div className="urge-clean-num">{cleanMins}</div>
                <div className="urge-clean-lbl">min since last</div>
              </div>
            </div>
            <div className="urge-rail"><div className="urge-rail-fill" style={{ width: urgeRailPct + '%' }} /></div>
            <p className="urge-desc">Don&apos;t fight the urge — name it. Tap what you&apos;re feeling, and I&apos;ll help you through it.</p>
            <div className="urge-grid">
              {[
                ['reaching for phone to scroll', '📱', 'Phone scroll'],
                ['wanting to open YouTube or watch something', '📺', 'YouTube'],
                ['drifting to food or snacks', '🍵', 'Food break'],
                ['checking messages or chat', '💬', 'Messages'],
                ['feeling overwhelmed and wanting to quit', '🌊', 'Overwhelmed'],
                ['just bored and restless', '🍃', 'Restless'],
              ].map(([type, emoji, lbl]) => (
                <button key={lbl} className="urge-btn" onClick={() => logUrge(type, emoji)}>
                  <span className="urge-icon">{emoji}</span>
                  <span className="urge-lbl">{lbl}</span>
                </button>
              ))}
            </div>
            <div className={`ai-panel${aiOn ? ' on' : ''}`}>
              <div className="ai-panel-hdr"><div className="ai-loading-dot" /><span>{aiHdr}</span></div>
              <div className="ai-response">{aiText}</div>
            </div>
            <div className="ai-ask-row">
              <input
                className="ai-ask-input"
                placeholder="Tell me what you're feeling…"
                value={aiInput}
                onChange={e => setAiInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') askAI(); }}
              />
              <button className="ai-ask-btn" onClick={askAI}>Ask →</button>
            </div>
          </div>

          <div className="card flex-fill" style={{ paddingBottom: 0 }}>
            <div className="section-label"><div className="section-label-dot sand" />Activity Log</div>
            <div className="log-list" style={{ paddingBottom: 12 }}>
              {(S.log || []).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', fontFamily: 'var(--serif)', fontStyle: 'italic', color: 'var(--text-3)', fontSize: 13 }}>
                  Your session activity appears here.
                </div>
              ) : [...(S.log || [])].reverse().map((e, i) => (
                <div key={i} className={`log-row l${e.type}`}>
                  <span className="log-time">{e.t}</span>
                  <span className="log-text">{e.text}</span>
                  <span className={`log-badge ${BL[e.type] || 'lb-n'}`}>{BT[e.type] || 'Note'}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="log-note-row">
            <input
              className="log-note-inp"
              placeholder="Add a note to your log…"
              value={logNote}
              onChange={e => setLogNote(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addNote(); }}
            />
            <button className="log-add-btn" onClick={addNote}>+ Note</button>
          </div>

          <div className="card">
            <div className="section-label"><div className="section-label-dot" />Today&apos;s Numbers</div>
            <div className="stats-grid">
              <div className="stat-box"><div className="stat-val">{S.sessions}</div><div className="stat-lbl">Sessions</div></div>
              <div className="stat-box"><div className="stat-val sky">{focusDisp}</div><div className="stat-lbl">Focus time</div></div>
              <div className="stat-box"><div className="stat-val sand">{dn}/{S.tasks.length}</div><div className="stat-lbl">Tasks done</div></div>
              <div className="stat-box"><div className="stat-val blush">{S.urges}</div><div className="stat-lbl">Urges resisted</div></div>
            </div>
          </div>

        </div>

      </div>{/* /page-dash */}

      {/* ── HISTORY PAGE ── */}
      <div id="page-hist" className={`page${tab === 'hist' ? ' on' : ''}`}>
        <div className="hist-page">
          <div className="hist-h">Your <span>journey</span></div>
          <div className="hist-sub">{h.length} day{h.length !== 1 ? 's' : ''} of data</div>
          <div className="hist-summary">
            <div className="hs-box"><div className="hs-num">{h.length}</div><div className="hs-lbl">Days</div></div>
            <div className="hs-box"><div className="hs-num">{hTs}</div><div className="hs-lbl">Sessions</div></div>
            <div className="hs-box"><div className="hs-num">{Math.round(hTf / 60 * 10) / 10}h</div><div className="hs-lbl">Focus time</div></div>
            <div className="hs-box"><div className="hs-num">{hTu}</div><div className="hs-lbl">Urges resisted</div></div>
          </div>
          {h.length === 0 ? (
            <p style={{ color: 'var(--text-3)', fontFamily: 'var(--serif)', fontStyle: 'italic' }}>No history yet — check back tomorrow.</p>
          ) : h.map((d, di) => (
            <div key={di} className="h-day">
              <div className="h-day-top">
                <div className="h-day-date">{d.date}</div>
                <div className="h-chips">
                  <div className={`h-chip${d.sessions >= 4 ? ' good' : ''}`}>{d.sessions} sessions</div>
                  <div className="h-chip">{d.fmins}m</div>
                  <div className={`h-chip${d.td === d.tt && d.tt > 0 ? ' good' : ''}`}>{d.td}/{d.tt} tasks</div>
                  <div className="h-chip">{d.urges || 0} urges</div>
                </div>
              </div>
              <div className="h-entries">
                {(d.log || []).slice(0, 8).map((e, ei) => (
                  <div key={ei} className="h-entry"><time>{e.t || ''}</time><span>{e.text}</span></div>
                ))}
                {(d.log || []).length > 8 && (
                  <div style={{ color: 'var(--text-3)', fontSize: 11, paddingTop: 2 }}>+{d.log.length - 8} more</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── FOCUS LOCK ── */}
      <div className={`focus-lock${focusLockOn ? ' on' : ''}`}>
        <div className="fl-header">
          <div className="fl-logo"><span>🌿</span> Focus OS</div>
          <button className="fl-exit" onClick={closeFL}>✕ Exit</button>
        </div>
        <div className="fl-nature">{NATURE_ART[natIdx]}</div>
        <div className="fl-mode">{MCFG[cmode].l}</div>
        <div className="fl-task-name">{activeTask ? activeTask.name : 'Set a task to focus on'}</div>
        <div className={`fl-digits${isBrk ? ' brk' : ''}`}>{timerDisp}</div>
        <div className="fl-sdots">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className={`fl-sdot${i <= sdCount ? ' on' : ''}`} />
          ))}
        </div>
        <div className="fl-btns">
          <button className={`fl-start-btn${isBrk ? ' brk' : ''}`} onClick={toggleTimer}>{tMainLbl}</button>
          <button className="fl-reset-btn" onClick={resetTimer}>Reset</button>
        </div>
        <div className="fl-quote">{QUOTES[qIdx].q}</div>
      </div>

      {/* ── TOAST ── */}
      <div className={`toast${toastOn ? ' on' : ''}`}>{toastMsg}</div>
    </div>
  );
}
