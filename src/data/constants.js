export const MCFG = {
  work:   { l: 'Work',        m: 25 },
  short:  { l: 'Short Break', m: 5  },
  long:   { l: 'Long Break',  m: 15 },
  custom: { l: 'Custom',      m: 25 },
};

export const QUOTES = [
  { q: "Look deep into nature, and then you will understand everything better.", a: "— Albert Einstein" },
  { q: "The clearest way into the Universe is through a forest wilderness.", a: "— John Muir" },
  { q: "In every walk with nature, one receives far more than they seek.", a: "— John Muir" },
  { q: "You don't rise to the level of your goals — you fall to the level of your systems.", a: "— James Clear" },
  { q: "The present moment always will have been.", a: "— Stoic reminder" },
  { q: "Do what you can, with what you have, where you are.", a: "— Theodore Roosevelt" },
  { q: "The task is never as hard as the resistance to starting it.", a: "— observation" },
  { q: "Boredom is the price of admission for mastery.", a: "— observation" },
  { q: "Energy follows attention. What you attend to grows.", a: "— observation" },
  { q: "One Pomodoro is enough to start the momentum. Just one.", a: "— Focus OS" },
  { q: "The visa wait is temporary. What you build right now is permanent.", a: "— a note to yourself" },
  { q: "Every session is a vote for who you are becoming.", a: "— adapted from Atomic Habits" },
];

export const NATURE_ART = [
  '🌿','🌾','🍃','🌸','🌲','🌻','🍂','🌴','🌺','🪷','🌵','🎋','🍀','🌱','🪸',
  '🦋','🦅','🐘','🦁','🐺','🦊','🐻','🦌','🐆','🦓','🐬','🦜','🦩','🦔','🐢',
  '🦭','🐧','🦉','🐝','🦦','🐻‍❄️','🦀','🦚','🐠','🦙','🦒','🐴','🦋','🪶','🦎',
];

export const MOOD_TIPS = [
  { t: "You're fresh and ready",     b: "Perfect for deep work. Match this energy to your hardest task right now. Don't waste it on email." },
  { t: "You're already in flow",     b: "Protect this rare state. Close everything except the one thing. A 50-min session is within reach." },
  { t: "Restlessness is energy",     b: "Channel it: do 10 jumping jacks, then commit to one Pomodoro. Action dissolves restlessness." },
  { t: "Low energy is normal",       b: "Start with something easy to warm up. Drink water. A 20-min nap in the afternoon resets you entirely." },
  { t: "Anxiety = open loops",       b: "Do a brain dump — write everything on your mind into the task list. Then pick ONE thing and close the rest." },
  { t: "Peak state — go NOW",        b: "Stop reading this. Open your most important task. No music, no breaks until you get stuck. You're ready." },
];

export const URGE_FALLBACKS = {
  'reaching for phone to scroll':
    "Your phone is engineered to pull you in — you're not weak for feeling this. Put it face-down and give yourself 2 more minutes of the current task. The urge always passes faster than it feels.",
  'wanting to open YouTube or watch something':
    "Your brain hit a friction point and wants easy dopamine. That video will be there in 25 minutes. Ask yourself: what exactly made you want to escape just now? That friction point is where the real work is.",
  'drifting to food or snacks':
    "Are you hungry or bored? Boredom hunger passes in 3 minutes. Drink a glass of water right now. If you're genuinely hungry, eat something quick and return. Don't let snacking become a procrastination ritual.",
  'checking messages or chat':
    "Nothing sent in the last hour needs a reply in the next 25 minutes. Protect this window. You can batch all replies at the next break — that's not rude, it's how focused people work.",
  'feeling overwhelmed and wanting to quit':
    "Overwhelm means you're thinking about the whole mountain. You only need the next 10 minutes. Shrink the task to something absurdly small — what is the tiniest possible next action you could take right now?",
  'just bored and restless':
    "Boredom during deep work is actually a good sign — it means you're doing real work, not easy distraction. This feeling peaks at about 10 minutes and then fades. You are very likely close to that point. Stay.",
};

export const DEF = {
  tasks: [], log: [], history: [], wins: [],
  sessions: 0, fmins: 0, urges: 0, mood: -1,
  streak: 0, lastDate: null, activeId: null, idc: 1,
  spotToken: null, lastUrge: null,
};
