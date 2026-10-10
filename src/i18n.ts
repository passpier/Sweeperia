export type Lang = 'zh' | 'en';

const zh = {
  'doc.title': 'Sweeperia — 帝國掃雷',
  'res.food': '食物',
  'res.wood': '木材',
  'res.stone': '石材',
  'res.gold': '黃金',
  'age.0': '石器時代',
  'age.1': '青銅時代',
  'age.2': '中世紀',
  'age.3': '火藥時代',
  'age.4': '現代',
  'ab.scout.name': '斥候',
  'ab.scout.short': '安全揭開一格',
  'ab.scout.desc': '安全揭開 1 格',
  'ab.wall.name': '城牆',
  'ab.wall.short': '抵擋一次踩雷',
  'ab.wall.desc': '抵擋下一次踩雷 (最多 3 層)',
  'ab.engineer.name': '工兵',
  'ab.engineer.short': '偵測 5×5 雷數',
  'ab.engineer.desc': '偵測 5x5 範圍內地雷數',
  'ab.radar.name': '雷達',
  'ab.radar.short': '標出 3×3 地雷',
  'ab.radar.desc': '高亮 3x3 內的地雷',
  'diff.easy': '初級',
  'diff.medium': '中級',
  'diff.hard': '高級',
  'diff.empire40': '帝國',
  'diff.empire70': '帝國',
  'diff.empire100': '帝國',
  'toast.wall': '城牆擋下了伏兵！',
  'toast.wallMax': '城牆已達上限',
  'toast.noScout': '沒有可偵察的格子',
  'toast.revealFirst': '請先揭開一格',
  'toast.age': '進入 {name}！',
  'toast.engineer': '5×5 範圍內有 {n} 顆地雷',
  'toast.copied': '已複製到剪貼簿',
  'hud.restart': '重新開始 (R)',
  'hud.restartAria': '重新開始',
  'hud.menu': '選單 (Esc)',
  'hud.unlocksAt': '{age}解鎖',
  'hud.maxAge': '已達最高時代',
  'hud.upgradeTo': '升級至 {name}',
  'hud.unlocks': '解鎖技能：{list}',
  'hud.unlocksNone': '地貌與天色改變，開啟新時代',
  'hud.listSep': '、',
  'hud.cost': '費用',
  'hud.cooldown': '冷卻 {s} 秒',
  'hud.needTarget': '需點選目標格',
  'hud.hotkey': '快捷鍵 {k}',
  'hud.advance': '升級時代',
  'end.win': '勝利！',
  'end.lose': '失敗',
  'end.time': '用時 {s} 秒',
  'end.best': '最佳 {s} 秒',
  'end.resources': '資源 {n}',
  'end.score': '分數 {n}',
  'end.again': '再來一局',
  'end.menu': '選單',
  'end.share': '分享戰績',
  'end.shareText': '我在 Sweeperia 帝國掃雷 {diff} 用 {s} 秒通關{score}，同一張地圖你能更快嗎？⚔',
  'end.copy': '複製文字與連結',
  'end.shareNow': '分享',
  'end.preview': '將分享以下內容',
  'challenge.hint': '請先點擊發亮的起手格，計時才會開始',
  'challenge.banner': '挑戰 {s} 秒',
  'challenge.win': '你 {s} 秒，比挑戰的 {target} 秒快了 {d} 秒！',
  'challenge.slower': '你 {s} 秒，比挑戰的 {target} 秒慢了 {d} 秒',
  'challenge.lose': '未能通關，目標是 {s} 秒',
  'challenge.retry': '再挑戰一次',
  'end.shareScore': '（分數 {n}）',
  'menu.tagline': '帝國掃雷 — 從石器時代揭開世界',
  'menu.modeEmpire': '資源 · 時代 · 技能',
  'menu.modeClassic': '經典規則',
  'menu.quality': '畫質',
  'menu.q.high': '高',
  'menu.q.balanced': '中',
  'menu.q.low': '低（最快）',
  'menu.sound': '音效',
  'menu.on': '開',
  'menu.off': '關',
  'menu.lang': '語言 / Language',
  'menu.close': '繼續',
  'menu.help1': '左鍵 揭開 · 右鍵 插旗 · 中鍵/點數字 快速開格',
  'menu.help2': '拖曳/<kbd>WASD</kbd> 移動 · 滾輪 縮放 · <kbd>Q</kbd><kbd>E</kbd> 旋轉 · <kbd>R</kbd> 重開',
  'menu.help3': '帝國模式：<kbd>1</kbd>–<kbd>4</kbd> 技能、<kbd>G</kbd> 升級時代 · 手機：點按揭開、長按插旗',
};

export type StrKey = keyof typeof zh;

const en: Record<StrKey, string> = {
  'doc.title': 'Sweeperia — Empire Minesweeper',
  'res.food': 'Food',
  'res.wood': 'Wood',
  'res.stone': 'Stone',
  'res.gold': 'Gold',
  'age.0': 'Stone Age',
  'age.1': 'Bronze Age',
  'age.2': 'Medieval',
  'age.3': 'Gunpowder',
  'age.4': 'Modern',
  'ab.scout.name': 'Scout',
  'ab.scout.short': 'Safe reveal',
  'ab.scout.desc': 'Safely reveal 1 tile',
  'ab.wall.name': 'Wall',
  'ab.wall.short': 'Block a mine',
  'ab.wall.desc': 'Block the next mine hit (up to 3 layers)',
  'ab.engineer.name': 'Sapper',
  'ab.engineer.short': 'Count 5×5',
  'ab.engineer.desc': 'Count the mines within a 5×5 area',
  'ab.radar.name': 'Radar',
  'ab.radar.short': 'Mark 3×3',
  'ab.radar.desc': 'Highlight the mines within a 3×3 area',
  'diff.easy': 'Beginner',
  'diff.medium': 'Intermediate',
  'diff.hard': 'Expert',
  'diff.empire40': 'Empire',
  'diff.empire70': 'Empire',
  'diff.empire100': 'Empire',
  'toast.wall': 'The wall stopped an ambush!',
  'toast.wallMax': 'Wall limit reached',
  'toast.noScout': 'No tile left to scout',
  'toast.revealFirst': 'Reveal a tile first',
  'toast.age': 'Entering {name}!',
  'toast.engineer': '{n} mines within 5×5',
  'toast.copied': 'Copied to clipboard',
  'hud.restart': 'Restart (R)',
  'hud.restartAria': 'Restart',
  'hud.menu': 'Menu (Esc)',
  'hud.unlocksAt': 'unlocks at {age}',
  'hud.maxAge': 'Highest age reached',
  'hud.upgradeTo': 'Advance to {name}',
  'hud.unlocks': 'Unlocks: {list}',
  'hud.unlocksNone': 'The terrain and sky change as a new age begins',
  'hud.listSep': ', ',
  'hud.cost': 'Cost',
  'hud.cooldown': 'Cooldown {s}s',
  'hud.needTarget': 'Pick a target tile',
  'hud.hotkey': 'Hotkey {k}',
  'hud.advance': 'Advance',
  'end.win': 'Victory!',
  'end.lose': 'Defeat',
  'end.time': 'Time {s}s',
  'end.best': 'Best {s}s',
  'end.resources': 'Resources {n}',
  'end.score': 'Score {n}',
  'end.again': 'Play again',
  'end.menu': 'Menu',
  'end.share': 'Share result',
  'end.shareText': 'I cleared Sweeperia {diff} in {s}s{score}. Can you beat me on the same map? ⚔',
  'end.copy': 'Copy text & link',
  'end.shareNow': 'Share',
  'end.preview': 'This is what will be shared',
  'challenge.hint': 'Click the glowing start tile to begin — the clock starts then',
  'challenge.banner': 'Beat {s}s',
  'challenge.win': 'You: {s}s — {d}s faster than the {target}s target!',
  'challenge.slower': 'You: {s}s — {d}s slower than the {target}s target',
  'challenge.lose': 'Not cleared. The target was {s}s',
  'challenge.retry': 'Try again',
  'end.shareScore': ' (score {n})',
  'menu.tagline': 'Empire Minesweeper — uncover the world from the Stone Age',
  'menu.modeEmpire': 'Resources · Ages · Skills',
  'menu.modeClassic': 'Classic rules',
  'menu.quality': 'Quality',
  'menu.q.high': 'High',
  'menu.q.balanced': 'Medium',
  'menu.q.low': 'Low (fastest)',
  'menu.sound': 'Sound',
  'menu.on': 'On',
  'menu.off': 'Off',
  'menu.lang': '語言 / Language',
  'menu.close': 'Resume',
  'menu.help1': 'Left click: reveal · Right click: flag · Middle click / click a number: chord',
  'menu.help2': 'Drag / <kbd>WASD</kbd> pan · Wheel zoom · <kbd>Q</kbd><kbd>E</kbd> rotate · <kbd>R</kbd> restart',
  'menu.help3': 'Empire: <kbd>1</kbd>–<kbd>4</kbd> skills, <kbd>G</kbd> advance age · Mobile: tap to reveal, long-press to flag',
};

const DICT: Record<Lang, Record<StrKey, string>> = { zh, en };

let current: Lang = 'zh';

export function detectLang(): Lang {
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  return langs.some((l) => l?.toLowerCase().startsWith('zh')) ? 'zh' : 'en';
}

export function setLang(l: Lang): void {
  current = l;
  document.documentElement.lang = l === 'zh' ? 'zh-Hant' : 'en';
  document.title = t('doc.title');
}

export function getLang(): Lang {
  return current;
}

export function t(key: StrKey, vars?: Record<string, string | number>): string {
  let s = DICT[current][key];
  if (vars) for (const k in vars) s = s.replaceAll(`{${k}}`, String(vars[k]));
  return s;
}

export function diffName(d: { id: string }): string {
  return t(`diff.${d.id}` as StrKey);
}

export function diffLabel(d: { id: string; w: number; h: number }): string {
  return `${t(`diff.${d.id}` as StrKey)} ${d.w}×${d.h}`;
}
