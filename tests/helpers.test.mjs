import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractRows, sortRows, toDate, formatDuration, fillTemplate, pickColor, formatCell, cellAlign, resolveLanguage, t
} from '../dist/attribute-table-card.js';

const ctx = { lang: 'pt', locale: 'pt-PT', timeZone: 'Europe/Lisbon' };

test('rows come from a list attribute, an object attribute, or every object attribute', () => {
  const trips = { attributes: { recent_trips: [{ km: 1 }, { km: 2 }, 'noise'], friendly_name: 'x' } };
  assert.deepEqual(extractRows(trips, { attribute: 'recent_trips' }), [{ km: 1 }, { km: 2 }]);

  const keyed = { attributes: { log: { a: { km: 1 }, b: { km: 2 } } } };
  assert.deepEqual(extractRows(keyed, { attribute: 'log' }), [{ km: 1 }, { km: 2 }]);

  const dreame = { attributes: { '2026-10-15 11:49': { timestamp: 1, area: 9 }, friendly_name: 'Cleaning history', icon: 'mdi:x' } };
  assert.deepEqual(extractRows(dreame, {}), [{ timestamp: 1, area: 9 }]);
  assert.deepEqual(extractRows({ attributes: { a: { x: 1 }, b: { timestamp: 2 } } }, { require: 'timestamp' }), [{ timestamp: 2 }]);
  assert.deepEqual(extractRows({ attributes: {} }, { attribute: 'missing' }), []);
});

test('rows sort by dates, numbers or text, newest first by default', () => {
  const rows = [{ start: '2026-10-15T17:30:00+01:00' }, { start: '2026-10-16T07:32:00+01:00' }, { start: '2026-10-14T09:00:00+01:00' }];
  assert.deepEqual(sortRows(rows, { by: 'start' }).map((r) => r.start.slice(8, 10)), ['16', '15', '14']);
  assert.deepEqual(sortRows([{ n: 2 }, { n: 10 }, { n: 1 }], { by: 'n', order: 'asc' }).map((r) => r.n), [1, 2, 10]);
  assert.deepEqual(sortRows(rows, null), rows);
});

test('timestamps in seconds, milliseconds and ISO strings all become dates', () => {
  assert.equal(toDate(1760600000).getTime(), 1760600000000);
  assert.equal(toDate(1760600000000).getTime(), 1760600000000);
  assert.equal(toDate('2026-10-16T12:00:00Z').toISOString(), '2026-10-16T12:00:00.000Z');
  assert.equal(toDate(''), null);
  assert.equal(toDate('not a date'), null);
});

test('durations read as minutes or hours and minutes', () => {
  assert.equal(formatDuration(30), '30 min');
  assert.equal(formatDuration(106), '1 h 46');
  assert.equal(formatDuration(120), '2 h');
  assert.equal(formatDuration(5400, 's'), '1 h 30');
  assert.equal(formatDuration('x'), '');
});

test('templates fill fields and format numbers in the Home Assistant language', () => {
  assert.equal(fillTemplate('{soc_start:0}→{soc_end:0}%', { soc_start: 83.0, soc_end: 87.4 }, ctx), '83→87%');
  assert.equal(fillTemplate('{a:1} kWh', { a: 2.75 }, ctx), '2,8 kWh');
  assert.equal(fillTemplate('{missing}', {}, ctx), '—');
});

test('colour steps pick the first matching maximum', () => {
  const steps = [{ max: 17, color: 'green' }, { max: 21, color: 'amber' }, { color: 'red' }];
  assert.equal(pickColor(15.4, steps), 'green');
  assert.equal(pickColor(19.1, steps), 'amber');
  assert.equal(pickColor(25, steps), 'red');
  assert.equal(pickColor(10, undefined), null);
});

test('cells format numbers, ranges, maps and stacks', () => {
  const row = {
    start: '2026-10-16T18:29:00Z', end: '2026-10-16T18:47:00Z', km: 9.94, pct: 72.4,
    type: 'DC', solar: 73, pw: 27, grid: 0, minutes: 106
  };
  assert.equal(formatCell(row, { field: 'km', format: 'number', decimals: 1, unit: 'km' }, ctx).text, '9,9 km');
  assert.equal(formatCell(row, { field: 'pct', format: 'percent' }, ctx).text, '72%');
  assert.equal(formatCell(row, { field: 'minutes', format: 'duration' }, ctx).text, '1 h 46');
  assert.equal(formatCell(row, { field: 'start', format: 'range', end: 'end' }, ctx).text, '16/10 19:29–19:47');
  assert.equal(formatCell(row, { field: 'start', format: 'date' }, ctx).text, '16/10');

  const mapped = formatCell(row, { field: 'type', format: 'map', map: { DC: { label: 'DC', icon: 'mdi:flash', color: 'amber' } } }, ctx);
  assert.deepEqual([mapped.text, mapped.icon, mapped.color], ['DC', 'mdi:flash', 'amber']);

  const stack = formatCell(row, { format: 'stack', segments: [{ field: 'solar', color: 'amber' }, { field: 'pw', color: 'green' }, { field: 'grid', color: 'red' }] }, ctx);
  assert.deepEqual(stack.segments.map((s) => s.value), [73, 27, 0]);
  assert.equal(formatCell({}, { format: 'stack', segments: [{ field: 'solar' }] }, ctx).text, '—');
  const withPct = formatCell(row, { format: 'stack', unit: '%', segments: [{ field: 'solar' }, { field: 'pw' }] }, ctx);
  assert.equal(withPct.text, '73% · 27%');

  assert.equal(formatCell({}, { field: 'km', format: 'number' }, ctx).text, '—');
  assert.equal(formatCell({ km: null }, { field: 'km', format: 'number', empty: 'n/a' }, ctx).text, 'n/a');
});

test('numeric columns align to the end unless told otherwise', () => {
  assert.equal(cellAlign({ format: 'number' }), 'end');
  assert.equal(cellAlign({ format: 'datetime' }), 'start');
  assert.equal(cellAlign({ format: 'number', align: 'center' }), 'center');
});

test('language follows Home Assistant', () => {
  assert.equal(resolveLanguage({ locale: { language: 'pt-BR' } }), 'pt');
  assert.equal(resolveLanguage({ language: 'de' }), 'en');
  assert.equal(t('pt', 'more', { n: 5 }), 'Mostrar mais 5');
});
