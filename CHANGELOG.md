# Changelog

## 0.1.2 - 2026-10-17

- Centred columns centre their header too; only the cells moved before

## 0.1.1 - 2026-10-17

- `stack` columns take a `unit`, shown after each number under the bar — `73% 27% 0%` instead of
  three bare numbers that read as anything

## 0.1.0 - 2026-10-17

- First release. A table from rows kept in an entity's attributes — a list of objects in one
  attribute, or, with no attribute set, every attribute of the entity that is itself an object
- Columns with formats: `text`, `number`, `percent`, `duration`, `date`, `time`, `datetime`,
  `range` (start–end in one cell), `template`, `map` (value to label, icon and colour) and
  `stack` (a small bar of shares, such as solar, battery and grid)
- Colour steps put a coloured dot (or a pill) on a number by thresholds
- Sorting, a row limit with *Show more*, and an optional maximum height that scrolls inside with
  the header kept in place
- On a narrow card each row becomes a small card of its own instead of a table
- Numbers and dates follow the Home Assistant language and time zone; English and Portuguese
