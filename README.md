# RData Preview

Preview `.RData`, `.rda`, and `.rds` files directly in VS Code — no more switching to RStudio just to check your data.

![VS Code](https://img.shields.io/badge/VS%20Code-1.80+-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

### 📊 Interactive Table View
- Data frames, tibbles, and matrices displayed as sortable, searchable, paginated tables
- Click column headers to sort, use the search box to filter rows
- Type annotations shown for each column (`<integer>`, `<character>`, etc.)

### 🌳 Enhanced Tree View
- Lists, environments, and nested structures shown as collapsible trees
- **Inline tables** — data.frame and matrix nodes inside lists expand into embedded tables directly in the tree
- **Color-coded type badges** — numeric (blue), character (orange), logical (green), data.frame/matrix (teal), list (yellow)
- **Search/filter** — filter tree nodes by key name or value
- **Expand / Collapse all** — quickly expand or collapse the entire tree

### 🔄 View Toggle
Switch between Table and Tree views with one click when an object supports both representations.

### 📁 Multi-object Support
`.RData` files containing multiple objects show a sidebar for easy navigation between objects.

### 🎨 Theme-aware
Automatically adapts to your VS Code light or dark theme.

## Requirements

- [R](https://www.r-project.org/) installed with `Rscript` available in your PATH
- [`jsonlite`](https://cran.r-project.org/package=jsonlite) R package

```r
install.packages("jsonlite")
```

## Usage

Open any `.RData`, `.rda`, or `.rds` file in VS Code — the preview opens automatically.

### Table View
- Click column headers to sort (click again to reverse)
- Type in the search box to filter rows across all columns
- Use pagination controls at the bottom for large datasets

### Tree View
- Click nodes to expand/collapse
- Data frames and matrices inside lists expand into inline tables
- Use **⊞ Expand** / **⊟ Collapse** buttons to open/close all nodes at once
- Use the **Filter keys…** search box to find specific entries

### View Toggle
When an object supports both table and tree views (e.g., a data.frame), toggle buttons appear in the toolbar.

## Extension Settings

| Setting | Default | Description |
|---|---|---|
| `rdataPreview.rscriptPath` | `""` | Custom path to `Rscript` executable. Leave empty to use PATH. |
| `rdataPreview.maxRows` | `1000` | Maximum number of rows to preview for data frames and matrices. |

## Supported R Object Types

| R Type | View |
|---|---|
| `data.frame`, `tibble`, `data.table` | Table (with Tree toggle) |
| `matrix` | Table / Inline table in tree (with dimensions like `matrix[5×4]`) |
| `list` | Tree with inline tables for nested data.frames/matrices |
| `vector` (numeric, character, logical, etc.) | Atomic value list with color-coded values |
| `function` | Source code display |
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

MIT
