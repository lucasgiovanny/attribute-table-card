# Attribute Table Card

A Home Assistant Lovelace card that draws a table from rows kept in an entity's attributes — the
trip log a car integration keeps in `recent_trips`, a template sensor that collects charging
sessions, a vacuum's cleaning history — in the Mushroom look. On a narrow card, a phone for
example, each row becomes a small card of its own instead of a table that scrolls sideways.

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=lucasgiovanny&repository=attribute-table-card&category=dashboard)

## Installation

HACS → ⋮ → *Custom repositories* → `https://github.com/lucasgiovanny/attribute-table-card`, type
*Dashboard*. Install *Attribute Table Card* and reload the browser.

## Usage

```yaml
type: custom:attribute-table-card
entity: sensor.car_last_trip
attribute: recent_trips
title: Last trips
icon: mdi:map-marker-path
limit: 8
sort:
  by: start
columns:
  - field: start
    name: When
    format: range
    end: end
  - field: duration_min
    name: Duration
    format: duration
  - field: distance_km
    name: km
    format: number
    decimals: 1
  - field: consumption_kwh_100km
    name: kWh/100 km
    format: number
    decimals: 1
    colors:
      - max: 17
        color: green
      - max: 21
        color: amber
      - color: red
```

With no `attribute`, every attribute of the entity that is itself an object is a row, which is how
some history sensors keep their entries:

```yaml
type: custom:attribute-table-card
entity: sensor.vacuum_cleaning_history
require: timestamp
sort:
  by: timestamp
columns:
  - field: timestamp
    name: When
    format: datetime
  - field: cleaned_area
    name: Area
```

## Options

| Option | Default | Description |
|---|---|---|
| `entity` | — | **Required.** The entity holding the rows |
| `attribute` | — | Attribute with the rows: a list of objects, or an object of objects. Without it, every attribute that is an object is a row |
| `require` | — | Field (or list of fields) a row must have to be shown |
| `columns` | — | **Required.** See below |
| `sort` | — | `by`: the field; `order`: `desc` (default) or `asc`. Dates, numbers and text all sort correctly. Without it rows keep their order |
| `limit` | `10` | Rows shown before *Show more* |
| `max_height` | — | e.g. `300px`: the table scrolls inside and the header stays in place |
| `title`, `icon` | — | Header |
| `empty` | *Nothing yet* | Text when there are no rows |
| `narrow_width` | `420` | Below this width (px) rows are drawn as small cards |
| `details` | — | `true`: tapping a row opens a popup with every column in full; a list of columns (same options as `columns`) shows those instead, so the popup can carry fields the table leaves out |

### Columns

| Option | Description |
|---|---|
| `field` | Field of the row |
| `name` | Header text |
| `format` | `text` (default), `number`, `percent`, `duration`, `date`, `time`, `datetime`, `range`, `template`, `map`, `stack`, `image` |
| `decimals`, `unit` | For `number`; `percent` adds `%` itself |
| `unit_in` | For `duration`: the field is in `min` (default), `s` or `h` |
| `end` | For `range`: the field with the end |
| `template` | For `template`: `{soc_start:0}→{soc_end:0}%` fills fields, `:N` sets decimals |
| `map` | For `map`: value → text, or value → `{ label, icon, color }` |
| `segments` | For `stack`: `[{ field, color, label }]`, drawn as a small bar of shares with the numbers under it; `unit` (e.g. `%`) follows each number |
| `source` | For `image`: `{ entity, attribute, match }` takes the URL from another entity's attribute (a URL or an object of URLs) that contains `match`, where `{value}` is the field — e.g. Dreame's cleaning history maps, `match: "v={value}"` on `timestamp`. Without `source` the field itself is the URL. In the table an image is an icon; in the row details it fills the width |
| `colors` | Steps `[{ max, color }, …, { color }]`: the first whose `max` the value does not exceed gives a dot (or a pill with `style: pill`) |
| `align` | `start`, `center` or `end`. Numbers, percents and durations default to `end` |
| `primary` | On narrow cards, the column used as each card's title (first column by default) |
| `empty` | Text for a missing value (default `—`) |

Colours are Home Assistant colour names (`green`, `amber`, `red`, `blue`, …) or any CSS colour.

Dates (`date`, `time`, `datetime`, `range`) are drawn as a day line and a time line, each with a
small icon: the day reads *Today*, *Yesterday*, the weekday within the last week (`Thu, 15/10`) or
the date, and a range shows `19:14 → 09:35`, naming both days when it crosses midnight
(`Yesterday → today`). The row details show the full dates.

Timestamps may be seconds or milliseconds since the epoch, or ISO strings. Dates and numbers follow
the Home Assistant language and time zone.

Theme variables: `--atc-divider` (row lines) and `--atc-row-background` (narrow row cards).

## Development

The card is a single file, `dist/attribute-table-card.js`, with no build step.

```bash
node --check dist/attribute-table-card.js
npm test
```

## License

[MIT](LICENSE)
