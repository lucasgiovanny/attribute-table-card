/* Attribute Table Card
 * A Home Assistant Lovelace card that draws a table from rows kept in an entity's attributes —
 * a list of objects in one attribute, or an entity whose attributes are the rows — in the
 * Mushroom look. On a narrow card each row becomes a small card of its own.
 * Licensed under MIT. See LICENSE.
 */

const CARD_TYPE = 'attribute-table-card';
const EDITOR_TYPE = 'attribute-table-card-editor';
const CARD_VERSION = '0.3.0';
const NARROW_PX = 420;
// Lets the helpers be imported by the Node tests, where there is no DOM.
const ElementBase = typeof HTMLElement === 'undefined' ? class {} : HTMLElement;

const STRINGS = {
  en: {
    more: 'Show {n} more',
    less: 'Show less',
    empty: 'Nothing yet',
    close: 'Close',
    today: 'Today',
    yesterday: 'Yesterday',
    tomorrow: 'Tomorrow',
    missing_entity: 'Set an entity',
    missing_columns: 'Add at least one column',
    no_rows: 'No rows found in {where}'
  },
  pt: {
    more: 'Mostrar mais {n}',
    less: 'Mostrar menos',
    empty: 'Ainda não há nada',
    close: 'Fechar',
    today: 'Hoje',
    yesterday: 'Ontem',
    tomorrow: 'Amanhã',
    missing_entity: 'Defina uma entidade',
    missing_columns: 'Adicione pelo menos uma coluna',
    no_rows: 'Nenhuma linha em {where}'
  }
};

const NUMERIC_FORMATS = new Set(['number', 'percent', 'duration']);

export function resolveLanguage(hass) {
  const lang = String(hass?.locale?.language || hass?.language || 'en').toLowerCase();
  return lang.startsWith('pt') ? 'pt' : 'en';
}

export function t(lang, key, vars = {}) {
  const text = (STRINGS[lang] || STRINGS.en)[key] || STRINGS.en[key] || key;
  return text.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? ''));
}

function isRow(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// Rows come from one attribute (a list, or an object of rows) or, with no attribute, from every
// attribute of the entity that is itself an object — how history sensors such as Dreame's keep them.
export function extractRows(stateObj, config = {}) {
  const attributes = stateObj?.attributes || {};
  let rows;
  if (config.attribute) {
    const value = attributes[config.attribute];
    if (Array.isArray(value)) rows = value.filter(isRow);
    else if (isRow(value)) rows = Object.values(value).filter(isRow);
    else rows = [];
  } else {
    rows = Object.values(attributes).filter(isRow);
  }
  const required = [].concat(config.require || []);
  if (required.length) {
    rows = rows.filter((row) => required.every((field) => row[field] !== undefined && row[field] !== null));
  }
  return rows;
}

// Seconds or milliseconds since the epoch, an ISO string, or a Date.
export function toDate(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number' || /^\d+(\.\d+)?$/.test(String(value))) {
    const n = Number(value);
    return new Date(n < 1e12 ? n * 1000 : n);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function sortKey(value) {
  if (typeof value === 'number') return value;
  const date = typeof value === 'string' && /\d{4}-\d{2}-\d{2}/.test(value) ? toDate(value) : null;
  if (date) return date.getTime();
  const n = Number(value);
  return Number.isNaN(n) || value === '' || value === null || value === undefined ? String(value ?? '') : n;
}

export function sortRows(rows, sort) {
  if (!sort || !sort.by) return rows.slice();
  const direction = sort.order === 'asc' ? 1 : -1;
  return rows.slice().sort((a, b) => {
    const x = sortKey(a[sort.by]);
    const y = sortKey(b[sort.by]);
    if (typeof x === 'number' && typeof y === 'number') return (x - y) * direction;
    return String(x).localeCompare(String(y)) * direction;
  });
}

function numberFormat(ctx, decimals) {
  return new Intl.NumberFormat(ctx.locale || 'en', {
    minimumFractionDigits: decimals ?? 0,
    maximumFractionDigits: decimals ?? 2
  });
}

function formatNumber(value, ctx, decimals) {
  const n = Number(value);
  return Number.isFinite(n) ? numberFormat(ctx, decimals).format(n) : '';
}

function withUnit(text, unit) {
  if (!unit || text === '') return text;
  return /^[%°]/.test(unit) ? `${text}${unit}` : `${text} ${unit}`;
}

function dateParts(date, ctx) {
  const parts = new Intl.DateTimeFormat(ctx.locale || 'en', {
    timeZone: ctx.timeZone || undefined, weekday: 'short', year: 'numeric',
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || '';
  return {
    date: `${get('day')}/${get('month')}`,
    time: `${get('hour')}:${get('minute')}`,
    year: get('year'),
    // Three letters, so Portuguese reads "sex" rather than "sexta".
    weekday: get('weekday').replace(/\.$/, '').slice(0, 3),
    // Calendar day number in the Home Assistant time zone, for "today", "yesterday" and the weekday.
    dayNumber: Date.UTC(Number(get('year')), Number(get('month')) - 1, Number(get('day'))) / 86400000
  };
}

// "Today", "Yesterday", the weekday within the last week ("Wed, 15/10"), or just the date.
export function dayLabel(parts, ctx) {
  const today = dateParts(ctx.now || new Date(), ctx).dayNumber;
  const ago = today - parts.dayNumber;
  if (ago === 0) return t(ctx.lang, 'today');
  if (ago === 1) return t(ctx.lang, 'yesterday');
  if (ago === -1) return t(ctx.lang, 'tomorrow');
  if (ago > 1 && ago < 7) return `${parts.weekday}, ${parts.date}`;
  return parts.date;
}

// A start (and optional end) as a day line and a time line, plus one-line and full texts.
export function formatWhen(startDate, endDate, ctx, format) {
  const start = dateParts(startDate, ctx);
  const startDay = dayLabel(start, ctx);
  const full = (parts) => `${parts.weekday}, ${parts.date}/${parts.year}`;
  let day = startDay;
  let time = start.time;
  let long = `${full(start)} · ${start.time}`;
  if (endDate) {
    const end = dateParts(endDate, ctx);
    time = `${start.time} → ${end.time}`;
    if (end.dayNumber !== start.dayNumber) {
      const endDay = dayLabel(end, ctx);
      const relative = (label, parts) => label !== parts.date && !label.includes(',');
      if (relative(startDay, start) || relative(endDay, end)) day = `${startDay} → ${relative(endDay, end) ? endDay.toLowerCase() : endDay}`;
      else day = start.date.slice(3) === end.date.slice(3) ? `${start.date.slice(0, 2)} → ${end.date}` : `${start.date} → ${end.date}`;
      long = `${full(start)} · ${start.time} → ${full(end)} · ${end.time}`;
    } else {
      long = `${full(start)} · ${start.time} → ${end.time}`;
    }
  }
  if (format === 'date') return { day, time: '', text: day, long: full(start) };
  if (format === 'time') return { day: '', time, text: time, long };
  return { day, time, text: `${day} ${time}`, long };
}

// Minutes by default, so 106 reads "1 h 46" and 30 reads "30 min".
export function formatDuration(value, unitIn = 'min') {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  const minutes = Math.round(unitIn === 's' ? n / 60 : unitIn === 'h' ? n * 60 : n);
  if (minutes < 60) return `${minutes} min`;
  const rest = minutes % 60;
  return rest ? `${Math.floor(minutes / 60)} h ${String(rest).padStart(2, '0')}` : `${minutes / 60} h`;
}

// "{soc_start:0}→{soc_end:0}%" fills each field from the row, numbers with that many decimals.
export function fillTemplate(template, row, ctx) {
  return String(template).replace(/\{(\w+)(?::(\d+))?\}/g, (_, field, decimals) => {
    const value = row[field];
    if (value === null || value === undefined) return '—';
    if (decimals !== undefined && Number.isFinite(Number(value))) return formatNumber(value, ctx, Number(decimals));
    return String(value);
  });
}

// colors: [{ max: 17, color: 'green' }, { max: 21, color: 'amber' }, { color: 'red' }], first match wins.
export function pickColor(value, colors) {
  if (!Array.isArray(colors) || !colors.length) return null;
  const n = Number(value);
  for (const step of colors) {
    if (step.max === undefined || (Number.isFinite(n) && n <= step.max)) return step.color || null;
  }
  return null;
}

// Returns what a cell shows: text, plus an optional colour, icon, or stacked segments.
export function formatCell(row, column, ctx) {
  const value = column.field ? row[column.field] : undefined;
  const format = column.format || (column.template ? 'template' : 'text');
  const missing = value === null || value === undefined || value === '';
  const cell = { text: '', color: pickColor(value, column.colors), icon: null, segments: null };

  if (format === 'template') {
    cell.text = fillTemplate(column.template || '', row, ctx);
    return cell;
  }
  if (format === 'stack') {
    const segments = (column.segments || []).map((segment) => ({
      value: Math.max(Number(row[segment.field]) || 0, 0),
      color: segment.color || 'grey',
      label: segment.label || segment.field
    }));
    if (!segments.some((segment) => segment.value > 0)) return { ...cell, text: '—' };
    cell.segments = segments;
    cell.unit = column.unit || '';
    cell.text = segments.map((segment) => withUnit(formatNumber(segment.value, ctx, 0), column.unit)).join(' · ');
    return cell;
  }
  if (missing) return { ...cell, text: column.empty ?? '—' };

  switch (format) {
    case 'number':
      cell.text = withUnit(formatNumber(value, ctx, column.decimals), column.unit);
      break;
    case 'percent':
      cell.text = withUnit(formatNumber(value, ctx, column.decimals ?? 0), '%');
      break;
    case 'duration':
      cell.text = formatDuration(value, column.unit_in);
      break;
    case 'date':
    case 'time':
    case 'datetime':
    case 'range': {
      const date = toDate(value);
      if (!date) return { ...cell, text: String(value) };
      const endDate = format === 'range' && column.end ? toDate(row[column.end]) : null;
      const when = formatWhen(date, endDate, ctx, format);
      cell.when = { day: when.day, time: when.time };
      cell.text = when.text;
      cell.long = when.long;
      break;
    }
    case 'map': {
      const entry = (column.map || {})[String(value)];
      if (entry && typeof entry === 'object') {
        cell.text = entry.label ?? String(value);
        cell.icon = entry.icon || null;
        cell.color = entry.color || cell.color;
      } else {
        cell.text = entry ?? String(value);
      }
      break;
    }
    default:
      cell.text = withUnit(String(value), column.unit);
  }
  return cell;
}

export function cellAlign(column) {
  if (column.align) return column.align;
  return NUMERIC_FORMATS.has(column.format) ? 'end' : 'start';
}

function cssColor(name) {
  if (!name) return '';
  return /^(#|rgb|hsl|var\()/.test(name) ? name : `var(--${name}-color, ${name})`;
}

// Columns shown in a row's details: `details: true` reuses the table columns, a list brings its own.
export function detailColumns(config) {
  if (!config || !config.details) return null;
  if (Array.isArray(config.details)) return config.details.length ? config.details : null;
  return Array.isArray(config.columns) && config.columns.length ? config.columns : null;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const STYLES = `
  :host { display: block; height: 100%; }
  ha-card { height: 100%; box-sizing: border-box; padding: 12px; display: flex; flex-direction: column; overflow: hidden; }
  .header { display: flex; align-items: center; gap: 8px; padding: 2px 4px 10px; color: var(--primary-text-color); }
  .header ha-icon { --mdc-icon-size: 20px; color: var(--secondary-text-color); }
  .header .title { font-size: 14px; font-weight: 500; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .body { flex: 1; min-height: 0; overflow: auto; }
  .table { display: grid; font-size: 13px; color: var(--primary-text-color); }
  .head {
    position: sticky; top: 0; z-index: 1; padding: 0 6px 6px;
    background: var(--ha-card-background, var(--card-background-color));
    font-size: 11px; font-weight: 500; letter-spacing: 0.02em; color: var(--secondary-text-color);
    white-space: nowrap;
  }
  .cell { padding: 8px 6px; border-top: 1px solid var(--atc-divider, rgba(127, 127, 127, 0.16)); white-space: nowrap; display: flex; align-items: center; gap: 6px; min-width: 0; overflow: hidden; }
  .txt { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .clickable [data-r] { cursor: pointer; }
  .clickable .cell.hover { background: rgba(127, 127, 127, 0.08); }
  .overlay { position: fixed; inset: 0; z-index: 100; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(0, 0, 0, 0.45); }
  .dialog { width: min(480px, 100%); max-height: 85vh; overflow: auto; box-sizing: border-box; padding: 18px 20px 14px; border-radius: 16px;
    background: var(--ha-card-background, var(--card-background-color, #1c1f24)); color: var(--primary-text-color); box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35); }
  .dialog h3 { margin: 0 0 12px; font-size: 16px; font-weight: 600; }
  .dialog dl { display: grid; grid-template-columns: max-content 1fr; gap: 8px 16px; margin: 0; font-size: 14px; }
  .dialog dt { color: var(--secondary-text-color); font-size: 13px; }
  .dialog dd { margin: 0; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; overflow-wrap: anywhere; }
  .dialog dd .txt { overflow: visible; white-space: normal; }
  .dialog dd ha-icon { --mdc-icon-size: 16px; }
  .dialog .actions { display: flex; justify-content: flex-end; margin-top: 14px; }
  .end { justify-content: flex-end; text-align: end; font-variant-numeric: tabular-nums; }
  .center { justify-content: center; text-align: center; }
  .dot { flex: 0 0 auto; width: 8px; height: 8px; border-radius: 50%; }
  .pill { padding: 2px 8px; border-radius: 999px; font-size: 12px; font-weight: 500; display: inline-flex; align-items: center; gap: 4px; }
  .cell ha-icon { --mdc-icon-size: 16px; flex: 0 0 auto; }
  .when { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .when span { display: flex; align-items: center; gap: 4px; white-space: nowrap; }
  .when ha-icon, .cell .when ha-icon { --mdc-icon-size: 13px; color: var(--secondary-text-color); }
  .row-card .when { flex-direction: row; flex-wrap: wrap; gap: 2px 12px; }
  .stack { display: flex; flex-direction: column; gap: 3px; min-width: 64px; }
  .bar { display: flex; height: 6px; border-radius: 3px; overflow: hidden; background: rgba(127, 127, 127, 0.2); }
  .bar span { height: 100%; }
  .legend { font-size: 11px; color: var(--secondary-text-color); display: flex; gap: 6px; }
  .legend b { font-weight: 600; }
  .cards { display: flex; flex-direction: column; gap: 8px; }
  .row-card { padding: 10px 12px; border-radius: 12px; background: var(--atc-row-background, rgba(127, 127, 127, 0.1)); }
  .row-card .primary { font-size: 14px; font-weight: 500; display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
  .row-card .facts { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 13px; }
  .row-card .fact { display: flex; align-items: center; gap: 5px; min-width: 0; }
  .row-card .fact .label { color: var(--secondary-text-color); font-size: 11px; }
  .more {
    margin-top: 8px; align-self: center; border: none; background: none; cursor: pointer;
    font: inherit; font-size: 13px; font-weight: 500; color: var(--primary-color); padding: 6px 10px; border-radius: 8px;
  }
  .more:hover { background: rgba(127, 127, 127, 0.12); }
  .empty, .warning { padding: 16px 4px; text-align: center; font-size: 13px; color: var(--secondary-text-color); }
  .warning { color: var(--warning-color, #ffa600); }
`;

class AttributeTableCard extends ElementBase {
  static getConfigElement() {
    return document.createElement(EDITOR_TYPE);
  }

  static getStubConfig() {
    return {
      entity: '',
      attribute: '',
      columns: [{ field: 'start', name: 'When', format: 'datetime' }]
    };
  }

  constructor() {
    super();
    if (typeof this.attachShadow === 'function') this.attachShadow({ mode: 'open' });
    this._expanded = false;
    this._narrow = false;
  }

  setConfig(config) {
    if (!config) throw new Error('Invalid configuration');
    this._config = { limit: 10, ...config, columns: Array.isArray(config.columns) ? config.columns : [] };
    this._lastState = null;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    const stateObj = this._config?.entity ? hass.states[this._config.entity] : null;
    // Only the watched entity changes what is drawn, so every other update is skipped.
    if (stateObj === this._lastState && this._lastLang === resolveLanguage(hass)) return;
    this._lastState = stateObj;
    this._lastLang = resolveLanguage(hass);
    this._render();
  }

  connectedCallback() {
    if (typeof ResizeObserver === 'undefined' || this._resize) return;
    this._resize = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect?.width || 0;
      const narrow = width > 0 && width < (this._config?.narrow_width || NARROW_PX);
      if (narrow !== this._narrow) {
        this._narrow = narrow;
        this._render();
      }
    });
    this._resize.observe(this);
  }

  disconnectedCallback() {
    this._resize?.disconnect();
    this._resize = null;
  }

  getCardSize() {
    return Math.min(2 + (this._config?.limit || 10), 12);
  }

  getGridOptions() {
    return { columns: 12, min_columns: 4, rows: 'auto' };
  }

  _context() {
    const hass = this._hass || {};
    return {
      lang: resolveLanguage(hass),
      locale: hass.locale?.language || hass.language || 'en',
      timeZone: hass.locale?.time_zone === 'local' ? undefined : hass.config?.time_zone
    };
  }

  _cellHtml(cell, column, full = false) {
    if (cell.when && full) return `<span class="txt">${escapeHtml(cell.long || cell.text)}</span>`;
    if (cell.when) {
      const line = (icon, text) => (text ? `<span><ha-icon icon="${icon}"></ha-icon>${escapeHtml(text)}</span>` : '');
      return `<span class="when">${line('mdi:calendar-blank-outline', cell.when.day)}${line('mdi:clock-outline', cell.when.time)}</span>`;
    }
    if (cell.segments) {
      const total = cell.segments.reduce((sum, segment) => sum + segment.value, 0) || 1;
      const bar = cell.segments
        .map((segment) => `<span style="width:${(segment.value / total) * 100}%;background:${cssColor(segment.color)}" title="${escapeHtml(segment.label)}"></span>`)
        .join('');
      const legend = cell.segments
        .map((segment) => `<span title="${escapeHtml(segment.label)}"><b style="color:${cssColor(segment.color)}">${Math.round(segment.value)}${escapeHtml(cell.unit || '')}</b></span>`)
        .join('');
      return `<div class="stack"><div class="bar">${bar}</div><div class="legend">${legend}</div></div>`;
    }
    const icon = cell.icon ? `<ha-icon icon="${escapeHtml(cell.icon)}" style="color:${cssColor(cell.color)}"></ha-icon>` : '';
    if (cell.color && column.style === 'pill') {
      const color = cssColor(cell.color);
      return `<span class="pill" style="color:${color};background:color-mix(in srgb, ${color} 18%, transparent)">${icon}${escapeHtml(cell.text)}</span>`;
    }
    const dot = cell.color && !cell.icon ? `<span class="dot" style="background:${cssColor(cell.color)}"></span>` : '';
    return `${icon}<span class="txt">${escapeHtml(cell.text)}</span>${dot}`;
  }

  _tableHtml(rows, columns, ctx) {
    const template = columns.map((column) => column.width || (cellAlign(column) === 'end' ? 'auto' : 'minmax(0, auto)')).join(' ');
    const head = columns
      .map((column) => `<div class="head ${cellAlign(column)}">${escapeHtml(column.name ?? column.field ?? '')}</div>`)
      .join('');
    const body = rows
      .map((row, r) => columns
        .map((column) => {
          const cell = formatCell(row, column, ctx);
          return `<div class="cell ${cellAlign(column)}" data-r="${r}" title="${escapeHtml(cell.long || cell.text || '')}">${this._cellHtml(cell, column)}</div>`;
        })
        .join(''))
      .join('');
    return `<div class="table" style="grid-template-columns:${template}">${head}${body}</div>`;
  }

  _cardsHtml(rows, columns, ctx) {
    const primaryIndex = Math.max(columns.findIndex((column) => column.primary), 0);
    return `<div class="cards">${rows.map((row, r) => {
      const primary = this._cellHtml(formatCell(row, columns[primaryIndex], ctx), columns[primaryIndex]);
      const facts = columns
        .filter((_, index) => index !== primaryIndex)
        .map((column) => `<div class="fact"><span class="label">${escapeHtml(column.name ?? column.field ?? '')}</span>${this._cellHtml(formatCell(row, column, ctx), column)}</div>`)
        .join('');
      return `<div class="row-card" data-r="${r}"><div class="primary">${primary}</div><div class="facts">${facts}</div></div>`;
    }).join('')}</div>`;
  }

  _render() {
    if (!this.shadowRoot || !this._config) return;
    const config = this._config;
    const ctx = this._context();
    const header = config.title
      ? `<div class="header">${config.icon ? `<ha-icon icon="${escapeHtml(config.icon)}"></ha-icon>` : ''}<span class="title">${escapeHtml(config.title)}</span></div>`
      : '';

    let content;
    const stateObj = config.entity && this._hass ? this._hass.states[config.entity] : null;
    if (!config.entity) content = `<div class="warning">${t(ctx.lang, 'missing_entity')}</div>`;
    else if (!config.columns.length) content = `<div class="warning">${t(ctx.lang, 'missing_columns')}</div>`;
    else if (!stateObj) content = `<div class="warning">${escapeHtml(config.entity)}</div>`;
    else {
      const rows = sortRows(extractRows(stateObj, config), config.sort);
      const limit = Number(config.limit) || rows.length;
      const shown = this._expanded ? rows : rows.slice(0, limit);
      if (!rows.length) {
        content = `<div class="empty">${escapeHtml(config.empty ?? t(ctx.lang, 'empty'))}</div>`;
      } else {
        const list = this._narrow ? this._cardsHtml(shown, config.columns, ctx) : this._tableHtml(shown, config.columns, ctx);
        const hidden = rows.length - shown.length;
        const toggle = rows.length > limit
          ? `<button class="more">${this._expanded ? t(ctx.lang, 'less') : t(ctx.lang, 'more', { n: hidden })}</button>`
          : '';
        const style = config.max_height ? ` style="max-height:${escapeHtml(config.max_height)}"` : '';
        this._shown = shown;
        content = `<div class="body${detailColumns(config) ? ' clickable' : ''}"${style}>${list}</div>${toggle}`;
      }
    }

    this.shadowRoot.innerHTML = `<style>${STYLES}</style><ha-card>${header}${content}</ha-card>`;
    this.shadowRoot.querySelector('.more')?.addEventListener('click', () => {
      this._expanded = !this._expanded;
      this._render();
    });
    const body = this.shadowRoot.querySelector('.body.clickable');
    if (body) {
      body.addEventListener('click', (event) => {
        const target = event.target.closest('[data-r]');
        if (target) this._openDetails(this._shown[Number(target.dataset.r)]);
      });
      // A table row is a set of grid cells, so the hover is drawn on all cells of the row.
      body.addEventListener('mouseover', (event) => {
        const target = event.target.closest('.cell[data-r]');
        const r = target ? target.dataset.r : null;
        body.querySelectorAll('.cell.hover').forEach((cell) => { if (cell.dataset.r !== r) cell.classList.remove('hover'); });
        if (r !== null) body.querySelectorAll(`.cell[data-r="${r}"]`).forEach((cell) => cell.classList.add('hover'));
      });
      body.addEventListener('mouseleave', () => body.querySelectorAll('.cell.hover').forEach((cell) => cell.classList.remove('hover')));
    }
  }

  _openDetails(row) {
    const columns = detailColumns(this._config);
    if (!row || !columns) return;
    const ctx = this._context();
    const primary = this._config.columns.find((column) => column.primary) || this._config.columns[0];
    const title = primary ? formatCell(row, primary, ctx).text : '';
    const items = columns
      .map((column) => `<dt>${escapeHtml(column.name ?? column.field ?? '')}</dt><dd>${this._cellHtml(formatCell(row, column, ctx), column, true)}</dd>`)
      .join('');
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.innerHTML = `<div class="dialog" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}"><h3>${escapeHtml(title)}</h3><dl>${items}</dl>
      <div class="actions"><button class="more" type="button">${t(ctx.lang, 'close')}</button></div></div>`;
    const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (event) => { if (event.key === 'Escape') close(); };
    overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); });
    overlay.querySelector('.actions button').addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    this.shadowRoot.appendChild(overlay);
    overlay.querySelector('.actions button').focus();
  }
}

class AttributeTableCardEditor extends ElementBase {
  setConfig(config) {
    this._config = config;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._form) this._form.hass = hass;
    else this._render();
  }

  _render() {
    if (!this._hass || !this._config) return;
    if (!this._form) {
      this._form = document.createElement('ha-form');
      this._form.computeLabel = (schema) => ({
        entity: 'Entity',
        attribute: 'Attribute with the rows (empty: every attribute that is an object)',
        title: 'Title',
        icon: 'Icon',
        limit: 'Rows before "Show more"',
        max_height: 'Maximum height (e.g. 300px), scrolls inside'
      }[schema.name] || schema.name);
      this._form.addEventListener('value-changed', (event) => {
        this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: event.detail.value }, bubbles: true, composed: true }));
      });
      this.appendChild(this._form);
      const note = document.createElement('p');
      note.style.cssText = 'font-size:12px;color:var(--secondary-text-color);margin:12px 0 0';
      note.textContent = 'Columns, sorting and formats are set in the YAML editor — see the README.';
      this.appendChild(note);
    }
    this._form.hass = this._hass;
    this._form.data = { limit: 10, ...this._config };
    this._form.schema = [
      { name: 'entity', required: true, selector: { entity: {} } },
      { name: 'attribute', selector: { text: {} } },
      { name: 'title', selector: { text: {} } },
      { name: 'icon', selector: { icon: {} } },
      { name: 'limit', selector: { number: { min: 1, max: 100, mode: 'box' } } },
      { name: 'max_height', selector: { text: {} } }
    ];
  }
}

if (typeof customElements !== 'undefined') {
  if (!customElements.get(CARD_TYPE)) customElements.define(CARD_TYPE, AttributeTableCard);
  if (!customElements.get(EDITOR_TYPE)) customElements.define(EDITOR_TYPE, AttributeTableCardEditor);
  window.customCards = window.customCards || [];
  if (!window.customCards.some((card) => card.type === CARD_TYPE)) {
    window.customCards.push({
      type: CARD_TYPE,
      name: 'Attribute Table Card',
      description: 'A table from rows kept in an entity attribute, in the Mushroom look.',
      documentationURL: 'https://github.com/lucasgiovanny/attribute-table-card',
      preview: false
    });
  }
  console.info(`%c ATTRIBUTE-TABLE-CARD %c ${CARD_VERSION} `, 'background:#42a5f5;color:#000;font-weight:700', 'background:#1c1f24;color:#fff');
}
