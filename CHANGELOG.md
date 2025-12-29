# Change Log

All notable changes to the "Go Template Support" extension will be documented in this file.

## [0.0.1] - 2025-12-29

### Added

- Initial release
- Syntax highlighting for Go template files (`.gotmpl`, `.tmpl`, `.tpl`)
- Support for template delimiters: `{{ }}` and `{{- -}}`
- Syntax highlighting for:
  - Control keywords: `if`, `else`, `end`, `with`, `range`, `define`, `template`, `block`, `break`, `continue`
  - Built-in functions: `and`, `call`, `html`, `index`, `len`, `not`, `or`, `print`, `printf`, `eq`, `ne`, `lt`, `le`, `gt`, `ge`, etc.
  - Variables: `$variable`, `.field`
  - Strings (double, single, backtick), numbers, operators
  - Block comments: `{{/* comment */}}`
- IntelliSense autocomplete for:
  - Template control keywords
  - Built-in Go template functions
  - **70+ Sprig functions** with full documentation ([Sprig library](https://masterminds.github.io/sprig/))
  - Variables and fields
- Hover documentation for keywords and functions
  - Built-in function documentation
  - **Sprig function documentation** with category labels and links to official docs
- Basic document formatting
- Auto-closing pairs for template delimiters
- Code folding for template blocks
- Language configuration for proper indentation and commenting
- **25+ code snippets** including Sprig-specific patterns

### Features

- Triggered autocomplete when typing `{{`, space, or `.`
- Format document command for consistent spacing
- Comment toggling with `{{/* */}}`
