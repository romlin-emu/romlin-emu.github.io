const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');

const source = readFileSync(join(__dirname, '../script.js'), 'utf8');
const html = readFileSync(join(__dirname, '../index.html'), 'utf8');
const latest = 'https://github.com/romlin-emu/romlin/releases/latest';
const filenames = [
  'Romlin-1.2.3-macos-arm64.zip',
  'Romlin-1.2.3-windows-x86_64.zip',
  'Romlin-1.2.3-x86_64.AppImage',
  'Romlin-1.2.3-x86_64.deb',
  'Romlin-1.2.3-x86_64.rpm',
];
const download = name => `https://example.invalid/${name}`;
// Sidecars come first so a loose filename match would select the wrong asset.
const assets = filenames.flatMap(name => [name + '.sha512', name + '.sha256', name])
  .map(name => ({ name, browser_download_url: download(name) }));

function element(textContent = '', href = '', hidden = false) {
  return {
    textContent, href, hidden, children: [],
    append(child) { this.children.push(child); },
    prepend(text) { this.prefix = text; },
  };
}

async function run(navigator, response = { ok: true, json: async () => ({ tag_name: 'v1.2.3', assets }) }) {
  // Read initial download markup so selector/fallback changes must update the fixture.
  const selectors = {};
  for (const attribute of ['data-os-label', 'data-version', 'data-tag', 'data-others']) {
    selectors[`[${attribute}]`] = [...html.matchAll(new RegExp(`<[^>]+\\s${attribute}(?=[\\s>])[^>]*>([^<]*)`, 'g'))]
      .map(([tag, text]) => element(text, tag.match(/href="([^"]+)"/)?.[1] || '', /\shidden[\s>]/.test(tag)));
    assert.ok(selectors[`[${attribute}]`].length, `Missing ${attribute} markup`);
  }
  assert.match(html, /<script src="script\.js(?:\?[^\"]*)?" defer><\/script>/);
  const calls = [];
  let jsonCalls = 0;
  runInNewContext(source, {
    navigator,
    document: {
      querySelectorAll: selector => {
        if (selector === '.switcher') return [];
        assert.ok(selectors[selector], `Unexpected selector ${selector}`);
        return selectors[selector];
      },
      querySelector: selector => {
        assert.ok(selectors[selector], `Unexpected selector ${selector}`);
        return selectors[selector][0];
      },
      createElement: tag => {
        assert.equal(tag, 'a');
        return element();
      },
    },
    fetch: async url => {
      calls.push(url);
      if (response instanceof Error) throw response;
      return { ok: response.ok, json: () => { jsonCalls++; return response.json(); } };
    },
  });
  await new Promise(setImmediate);
  assert.deepEqual(calls, ['https://api.github.com/repos/romlin-emu/romlin/releases/latest']);
  assert.equal(jsonCalls, response.ok ? 1 : 0);
  return {
    buttons: selectors['[data-os-label]'], versions: selectors['[data-version]'],
    tag: selectors['[data-tag]'][0], others: selectors['[data-others]'][0],
  };
}

for (const [platform, os, label, index] of [
  ['MacIntel', 'Mac', 'Mac with Apple silicon', 0],
  ['Win32', 'Windows', 'Windows', 1],
  ['Linux x86_64', 'Linux', 'Linux', 2],
]) {
  test(`${os} selects its primary build and offers all other formats`, async () => {
    const result = await run({ platform });
    for (const button of result.buttons) {
      assert.equal(button.href, download(filenames[index]));
      assert.equal(button.textContent, `Download for ${os}`);
    }
    for (const version of result.versions) assert.equal(version.textContent, `Version 1.2.3 for ${label}`);
    assert.equal(result.tag.textContent, 'v1.2.3');
    assert.equal(result.tag.hidden, false);
    assert.equal(result.others.hidden, false);
    assert.equal(result.others.prefix, 'Also for ');
    assert.deepEqual(result.others.children.map(a => a.href), filenames.filter((_, i) => i !== index).map(download));
    assert.deepEqual(result.others.children.map(a => a.textContent), ['Mac', 'Windows', 'Linux AppImage', '.deb', '.rpm'].filter((_, i) => i !== index));
  });
}

test('userAgentData platform takes precedence', async () => {
  const result = await run({ userAgentData: { platform: 'Windows' }, platform: 'MacIntel' });
  assert.equal(result.buttons[0].href, download(filenames[1]));
});

for (const navigator of [{ platform: 'Unknown' }, {}]) {
  test(`unknown platform ${JSON.stringify(navigator)} offers every build`, async () => {
    const result = await run(navigator);
    for (const button of result.buttons) {
      assert.equal(button.href, latest);
      assert.equal(button.textContent, 'Download');
    }
    assert.equal(result.versions[0].textContent, 'Version 1.2.3 for macOS, Windows and Linux');
    assert.equal(result.others.prefix, 'Download for ');
    assert.deepEqual(result.others.children.map(a => a.href), filenames.map(download));
  });
}

for (const [name, available, expected] of [
  ['missing primary', assets.filter(a => !a.name.endsWith('.AppImage')), [filenames[0], filenames[1], filenames[3], filenames[4]]],
  ['no assets', [], []],
  ['only checksum sidecars', assets.filter(a => /\.sha\d+$/.test(a.name)), []],
]) {
  test(name + ' preserves the release-page fallback', async () => {
    const result = await run({ platform: 'Linux' }, { ok: true, json: async () => ({ tag_name: 'v1.2.3', assets: available }) });
    for (const button of result.buttons) assert.equal(button.href, latest);
    assert.equal(result.versions[0].textContent, 'Version 1.2.3 for macOS, Windows and Linux');
    assert.deepEqual(result.others.children.map(a => a.href), expected.map(download));
    assert.equal(result.others.hidden, expected.length === 0);
  });
}

for (const [name, response] of [
  ['HTTP failure', { ok: false, json: async () => assert.fail('HTTP failure must not parse JSON') }],
  ['rejected fetch', new Error('offline')],
  ['rejected JSON', { ok: true, json: async () => { throw new Error('invalid JSON'); } }],
]) {
  test(name + ' preserves initial links and hides release metadata', async () => {
    const result = await run({ platform: 'MacIntel' }, response);
    for (const button of result.buttons) {
      assert.equal(button.href, latest);
      assert.equal(button.textContent, 'Download for Mac');
    }
    assert.equal(result.tag.hidden, true);
    assert.equal(result.others.hidden, true);
    assert.equal(result.others.children.length, 0);
    for (const version of result.versions) assert.equal(version.textContent, 'macOS, Windows, Linux');
  });
}
