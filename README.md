# RData Preview

A VS Code extension for previewing `.RData`, `.rda`, and `.rds` files directly in the editor.

![VS Code](https://img.shields.io/badge/VS%20Code-1.80+-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

- **Interactive Table View** — Data frames, tibbles, and matrices are displayed as sortable, searchable, paginated tables
- **Tree View** — Lists, environments, and nested structures shown as collapsible trees
- **View Toggle** — Switch between Table and Tree views with one click
- **Multi-object Support** — `.RData` files with multiple objects show a sidebar for easy navigation
- **Theme-aware** — Automatically adapts to your VS Code light/dark theme
- **Large File Handling** — Configurable row limit with pagination (default: 1000 rows)

## Requirements

- [R](https://www.r-project.org/) installed with `Rscript` available in your PATH
- [`jsonlite`](https://cran.r-project.org/package=jsonlite) R package

```r
install.packages("jsonlite")
```

## Usage

Open any `.RData`, `.rda`, or `.rds` file in VS Code — the preview opens automatically.

### Table View

- Click column headers to sort
- Use the search box to filter rows
- Navigate pages with the pagination controls at the bottom

### Tree View

- Click nodes to expand/collapse
- Nested structures are shown with type annotations and value previews

### View Toggle

When an object supports both views (e.g., a data.frame), use the **Table** / **Tree** toggle buttons in the toolbar to switch.

## Extension Settings

| Setting | Default | Description |
|---|---|---|
| `rdataPreview.rscriptPath` | `""` | Custom path to `Rscript` executable. Leave empty to use PATH. |
| `rdataPreview.maxRows` | `1000` | Maximum number of rows to preview for data frames. |

## Supported R Object Types

| R Type | View |
|---|---|
| `data.frame`, `tibble`, `data.table` | Table (with Tree toggle) |
| `matrix` | Table |
| `list` | Tree (with Table toggle if coercible) |
| `vector` (numeric, character, logical, etc.) | Atomic value list |
| `function` | Source code |
| Other | `str()` text output |

## Development

```bash
# Install dependencies
npm install

# Compile
npm run compile

# Watch mode
npm run watch
```

Press `Fn + F5` (macOS) or `F5` (Windows/Linux) to launch the Extension Development Host for testing.

## License

GPL-3.0
