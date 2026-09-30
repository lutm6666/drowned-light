// 無瀏覽器的冒煙測試：用假的 DOM 跑完整個遊戲流程，確認不會丟出例外。
// 用法：node tools/smoke-test.js
const fs = require('fs'), path = require('path');
let src = fs.readFileSync(path.join(__dirname, '..', 'game.html'), 'utf8').match(/<script>([\s\S]*)<\/script>/)[1];
src = src.replace("hub();\nrequestAnimationFrame(frame);", "globalThis.__t={get P(){return P},get fl(){return fl},get run(){return run},get state(){return state},get meta(){return meta},press,keys};\nhub();\nrequestAnimationFrame(frame);");
if (!src.includes('__t=')) throw new Error('hook not injected');

const noop = new Proxy(function () {}, { get: (t, k) => k === Symbol.toPrimitive ? () => 0 : noop, apply: () => noop, set: () => true });
const handlers = {}, els = {};
const mkEl = id => els[id] || (els[id] = { id, hidden: false, style: {}, dataset: {}, classList: { add() {}, remove() {} }, firstElementChild: { style: {} }, textContent: '', innerHTML: '', scrollTop: 0,
  addEventListener(t, f) { handlers[id + ':' + t] = f; }, getContext: () => noop, getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 600 }), querySelector: () => null, focus() {} });
let now = 0, raf = null, timers = [];
Object.assign(globalThis, {
  document: { querySelector: s => mkEl(s), createElement: () => mkEl('tmp' + Math.random()) },
  addEventListener: (t, f) => { handlers['win:' + t] = f; },
  performance: { now: () => now }, requestAnimationFrame: f => { raf = f; },
  setTimeout: (f, ms) => { timers.push({ at: now + ms, f }); },
  localStorage: { getItem: () => null, setItem() {} }
});
(0, eval)(src);
const t = globalThis.__t;
const step = (n = 1) => { for (let i = 0; i < n; i++) { now += 16; const due = timers.filter(x => x.at <= now); timers = timers.filter(x => x.at > now); due.forEach(x => x.f()); const f = raf; raf = null; f(now); } };
const click = (a, id) => handlers['#ov:click']({ target: { closest: () => ({ dataset: { a, id }, disabled: false }) } });
const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok  ' + m); };

step(3); assert(t.state === 'hub', 'starts in the lighthouse');
click('start'); step(2); assert(t.state === 'play' && t.fl.en.length > 0, 'run starts with enemies on floor 1');

function fight(frames, god) { // 走向最近的敵人並攻擊
  for (let i = 0; i < frames && t.state === 'play'; i++) {
    const P = t.P; if (god) { P.hp = P.hpMax; P.san = P.saMax; }
    const e = t.fl.en.slice().sort((a, b) => Math.hypot(a.x - P.x, a.y - P.y) - Math.hypot(b.x - P.x, b.y - P.y))[0];
    if (e) { const d = Math.hypot(e.x - P.x, e.y - P.y); if (d > 300) { P.x = e.x - 60; P.y = e.y; } t.keys.right = e.x > P.x + 20; t.keys.left = e.x < P.x - 20; t.keys.down = e.y > P.y + 20; t.keys.up = e.y < P.y - 20; if (i % 9 === 0) t.press[i % 27 === 0 ? 'heavy' : 'light'] = true; if (i % 61 === 0) t.press.roll = true; }
    step();
  }
  for (const k in t.keys) t.keys[k] = false;
}
for (let f = 0; f < 3; f++) {
  const n0 = t.fl.en.length; fight(2500, true);
  assert(t.run.kills > 0 && t.fl.en.length < n0, `floor ${f + 1}: enemies can be killed (${t.run.kills} kills, ${t.run.echoes} echoes)`);
  // 先試錯一次，再照正確順序解謎
  const pil = t.fl.obj.filter(o => o.k === 'pillar'), Z = t.fl.puzzle;
  const wrong = pil.find(p => p.gl !== Z.order[0]); t.P.x = wrong.x; t.P.y = wrong.y + 20; t.P.st = 'idle'; t.press.use = true; step();
  assert(Z.idx === 0 && t.fl.en.some(e => e.type === 'phantom'), `floor ${f + 1}: wrong pillar resets and wakes phantoms`);
  fight(400, true);
  const pages0 = t.meta.pages;
  for (const gl of Z.order) { const p = pil.find(o => o.gl === gl); t.P.x = p.x; t.P.y = p.y + 20; t.P.st = 'idle'; t.press.use = true; step(); }
  assert(Z.solved && t.meta.pages === pages0 + 1 && t.state === 'modal', `floor ${f + 1}: puzzle solved, journal page ${t.meta.pages} shown`);
  click('resume'); step();
  for (const k of ['brazier', 'idol']) { const o = t.fl.obj.find(x => x.k === k); t.P.x = o.x; t.P.y = o.y + 10; t.P.st = 'idle'; t.press.use = true; step(); }
  assert(t.fl.obj.find(x => x.k === 'brazier').lit && t.fl.obj.find(x => x.k === 'idol').used, `floor ${f + 1}: brazier and idol work`);
  t.P.hp = 40; t.P.st = 'idle'; t.press.heal = true; step(80); assert(t.P.hp > 40, `floor ${f + 1}: flask heals`);
  const s = t.fl.obj.find(o => o.k === 'stairs'); t.P.x = s.x; t.P.y = s.y; t.P.st = 'idle'; t.press.use = true; step();
  assert(t.state === 'modal', `floor ${f + 1}: stairs offer relics`);
  const id = els['#ov'].innerHTML.match(/data-id="(\w+)"/)[1]; click('relic', id); step(2);
  assert(t.run.floor === f + 1 && t.run.relics.length === f + 1, `descended to floor ${f + 2} with relic ${id}`);
}
assert(t.fl.boss && t.fl.boss.type === 'boss', 'floor 4 has the boss');
let sawHaz = false, sawBolt = false;
for (let i = 0; i < 40 && t.state === 'play' && !t.fl.boss.dead; i++) { fight(200, true); sawHaz = sawHaz || t.fl.haz.length > 0; sawBolt = sawBolt || t.fl.bolts.length > 0; }
assert(sawHaz && sawBolt, 'boss uses slam and bolt attacks');
assert(t.fl.boss.dead || t.fl.boss.hp < t.fl.boss.max, 'boss takes damage');
if (!t.fl.boss.dead) { t.fl.boss.hp = 1; fight(600, true); }
step(120); assert(t.state === 'modal' && t.meta.wins === 1, 'boss dies and victory screen shows');
const banked = t.meta.echoes; assert(banked > 0, `echoes banked after victory (${banked})`);
click('hub'); step(); click('up', 'vit'); step(); assert(t.meta.up.vit === 1 && t.meta.echoes < banked, 'upgrade can be bought');

click('start'); step(2); t.run.echoes = 50; // 死亡：一半帶回，一半遺落
for (let i = 0; i < 4000 && t.state === 'play'; i++) { const P = t.P, e = t.fl.en[0]; P.hp = Math.min(P.hp, 5); P.x = e.x + 20; P.y = e.y; step(); }
assert(t.state === 'modal' && t.meta.remnant && t.meta.remnant.amt === 25, 'death banks half and drops half as a remnant');
click('hub'); step(); click('start'); step(2);
const rem = t.fl.obj.find(o => o.k === 'remnant'); assert(rem, 'remnant appears on the floor where you died');
t.P.x = rem.x; t.P.y = rem.y; t.P.st = 'idle'; t.press.use = true; step(); assert(t.run.echoes === 25 && !t.meta.remnant, 'remnant can be picked up');
t.P.san = 0; step(200); assert(t.P.hp < t.P.hpMax, 'zero sanity drains health');
console.log('\nALL PASSED');
