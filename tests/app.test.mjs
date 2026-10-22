import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { signals, initialMembers, venues } from '../dist/fixtures.js';
import { negotiate, applyFeedback } from '../dist/engine.js';
import { previewInstruction } from '../dist/instructions.js';

// A small DOM stub exercises the actual event handlers and async state commits.
// It does not render a page or substitute for browser/visual testing.
async function app() {
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) {
      const children = new Map();
      elements.set(id, {
        value: '', hidden: false, disabled: false, innerHTML: '', textContent: '',
        handlers: {}, elements: { memberId: { focus() {} } },
        addEventListener(type, handler) { this.handlers[type] = handler; },
        querySelector(selector) {
          if (!children.has(selector)) children.set(selector, { disabled: false });
          return children.get(selector);
        },
        scrollIntoView() {},
      });
    }
    return elements.get(id);
  }
  let resolveStatus;
  const status = new Promise(resolve => { resolveStatus = resolve; });
  let response = { ok: false, json: async () => ({ error: '测试查询失败' }) };
  const context = vm.createContext({
    signals, initialMembers, venues, negotiate, applyFeedback, previewInstruction, structuredClone,
    document: { getElementById: element, querySelectorAll: () => [] },
    setTimeout: () => 1, clearTimeout() {}, AbortSignal,
    matchMedia: () => ({ matches: true }),
    FormData: class { constructor(form) { return Object.entries(form.data); } },
    fetch: async path => path === '/api/status' ? status : response,
  });
  const source = (await readFile(new URL('../dist/app.js', import.meta.url), 'utf8'))
    .replace(/^import .*;\n/gm, '');
  vm.runInContext(source, context);
  return {
    element,
    inspect: () => JSON.parse(vm.runInContext('JSON.stringify({state,mode,round,dirty,busy,apiError,undoStack,result,votes})', context)),
    async configure(qlooConfigured = true) {
      resolveStatus({ ok: true, json: async () => ({ qlooConfigured }) });
      await new Promise(resolve => setImmediate(resolve));
    },
    respond(value) { response = value; },
    async generate() {
      await element('negotiate').handlers.click();
      await new Promise(resolve => setImmediate(resolve));
    },
  };
}

test('slow status discovery preserves edits made before it resolves', async () => {
  const page = await app();
  page.element('members').handlers.change({ target: { dataset: { member: 'm1', field: 'name' }, value: '新名字' } });
  await page.configure();
  assert.equal(page.inspect().state.members[0].name, '新名字');
  assert.equal(page.inspect().dirty, true);
  assert.equal(page.inspect().mode, 'demo');
  assert.equal(page.element('data-mode').querySelector('[value=qloo]').disabled, false);
});

test('slow status discovery respects an explicit demo selection', async () => {
  const page = await app();
  page.element('data-mode').handlers.change({ target: { value: 'demo' } });
  await page.configure();
  assert.equal(page.inspect().mode, 'demo');
  assert.ok(page.inspect().result.plans.length > 0);
});

test('status discovery does not re-render a name while the user is still typing', async () => {
  const page = await app();
  page.element('members').handlers.input();
  page.element('members').innerHTML = 'uncommitted name input';
  await page.configure();
  assert.equal(page.element('members').innerHTML, 'uncommitted name input');
  assert.equal(page.inspect().mode, 'demo');
});

test('untouched startup enables Qloo without requesting recommendations', async () => {
  const page = await app();
  await page.configure();
  assert.equal(page.inspect().mode, 'qloo');
  assert.equal(page.inspect().round, 0);
  assert.equal(page.inspect().result.plans.length, 0);
});

test('failed live feedback preserves state and result, then retry and undo commit once', async () => {
  const page = await app();
  await page.configure();
  const state = page.inspect().state;
  const result = negotiate(state, venues);
  result.metadata = { scoredCandidates: result.eligible.length, notices: [] };
  for (const row of [...result.eligible, ...result.excluded]) {
    row.venue.address = 'Test address';
    for (const score of row.memberScores) score.rawAffinity = score.score / 100;
  }
  page.respond({ ok: true, json: async () => result });
  await page.generate();
  const before = page.inspect();
  page.respond({ ok: false, json: async () => ({ error: '请求频率限制' }) });
  const form = { data: { memberId: 'm1', type: 'closer', venueId: '' } };
  const submit = () => page.element('feedback-form').handlers.submit({ preventDefault() {}, currentTarget: form });
  await submit();
  assert.deepEqual(page.inspect().state, before.state);
  assert.deepEqual(page.inspect().result, before.result);
  assert.equal(page.inspect().round, before.round);
  assert.equal(page.inspect().undoStack.length, 0);
  assert.equal(page.inspect().busy, false);
  assert.equal(page.element('negotiate').disabled, false);
  page.respond({ ok: true, json: async () => result });
  await submit();
  assert.equal(page.inspect().state.constraints.maxDistanceKm, 4);
  assert.equal(page.inspect().undoStack.length, 1);
  await page.element('undo').handlers.click();
  assert.deepEqual(page.inspect().state, before.state);
  assert.equal(page.inspect().undoStack.length, 0);
});

test('command preview waits for apply, then creates one reversible feedback transaction', async () => {
  const page=await app();await page.configure(false);
  const before=page.inspect().state;
  page.element('instruction-text').value='Alex: no bars; Sam: closer';
  page.element('instruction-form').handlers.submit({preventDefault(){}});
  assert.deepEqual(page.inspect().state,before);
  assert.equal(page.element('instruction-preview').hidden,false);
  await page.element('instruction-apply').handlers.click();
  assert.equal(page.inspect().state.constraints.maxDistanceKm,4);
  assert.deepEqual(page.inspect().state.members[0].exclusions,['bar']);
  assert.equal(page.inspect().undoStack.length,1);
  await page.element('undo').handlers.click();
  assert.deepEqual(page.inspect().state,before);
});

test('agreement is explicit and a new round invalidates all old confirmations', async () => {
  const page=await app();await page.configure(false);
  assert.deepEqual(page.inspect().votes,{});
  for(const m of initialMembers)page.element('agreement-votes').handlers.click({target:{closest:()=>({dataset:{vote:m.id}})}});
  assert.equal(page.element('agreement-title').textContent,'Everyone is on board.');
  await page.generate();
  assert.deepEqual(page.inspect().votes,{});
  assert.notEqual(page.element('agreement-title').textContent,'Everyone is on board.');
});
