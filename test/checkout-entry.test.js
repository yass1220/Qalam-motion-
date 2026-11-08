import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

const source = await fs.readFile(new URL('../public/checkout.js', import.meta.url), 'utf8');

test('marketing links select only known packages and never start a payment or enquiry automatically', async () => {
  for (const [search, expected] of [
    ['', 'short'],
    ['?package=short', 'short'],
    ['?package=signature', 'signature'],
    ['?package=__proto__', 'short'],
    ['?package=constructor', 'short'],
    ['?package=unknown', 'short'],
  ]) {
    const elements = new Map();
    const element = id => {
      if (!elements.has(id)) elements.set(id, {
        value: id === 'package' ? 'short' : '', checked: false, textContent: '',
        disabled: false, hidden: false, addEventListener() {},
        querySelector: () => ({textContent: ''}),
      });
      return elements.get(id);
    };
    const requests = [];
    const storage = {getItem: () => null, setItem() {}, removeItem() {}};
    const catalog = {
      short: {price: '15.00', durationSeconds: {min: 40, max: 45}},
      signature: {price: '25.00', durationSeconds: {min: 60, max: 75}},
    };
    vm.runInNewContext(source, {
      document: {getElementById: element, querySelectorAll: () => [], querySelector: element},
      fetch: async (url, options) => {
        requests.push({url, options});
        assert.equal(url, '/api/config');
        assert.equal(options, undefined);
        return {ok: true, json: async () => ({mode: 'live', configured: true, catalog})};
      },
      crypto: {randomUUID: () => 'local-fixture'},
      location: {search, assign: () => assert.fail('must not navigate to payment')},
      localStorage: storage, sessionStorage: storage, URLSearchParams,
    });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(element('package').value, expected, search);
    assert.equal(element('selected-price').textContent, expected === 'signature' ? '$25 USD' : '$15 USD');
    assert.equal(element('next-pay').checked, false, 'free enquiry stays the default');
    assert.equal(element('pay').textContent, 'أرسل فكرتي بدون دفع');
    assert.equal(requests.length, 1, 'only read configuration, no order or enquiry POST');
  }
});
