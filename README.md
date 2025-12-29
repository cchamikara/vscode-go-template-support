# Go Template Support

A VS Code / Cursor extension that provides comprehensive support for Go template files (`.gotmpl`, `.tmpl`, `.tpl`).

## 🎉 New: KrakenD LSP Features

**Schema-based IntelliSense for KrakenD templates!**

- ✅ **Smart field autocomplete** - Context-aware suggestions from KrakenD schema
- ✅ **Hover documentation** - Instant field reference with types and defaults
- ✅ **Real-time validation** - Catch invalid fields and enum values as you type
- ✅ **Custom field mapping** - Supports your `endpoint_*` and `backend_*` prefixes

## Features

### 🎨 Syntax Highlighting

- Full syntax highlighting for Go template syntax
- Highlights template delimiters `{{ }}`, `{{- -}}`
- Distinct colors for:
  - Control keywords (`if`, `else`, `end`, `with`, `range`, `define`, `template`, `block`)
  - Built-in functions (`printf`, `index`, `len`, `eq`, `ne`, etc.)
  - Variables (`$variable`, `.field`)
  - Strings, numbers, and operators
  - Comments `{{/* comment */}}`

### 💡 IntelliSense & Autocomplete

- Auto-completion for:
  - Go template control keywords
  - Built-in template functions
  - **70+ Sprig functions** with documentation (see [Sprig docs](https://masterminds.github.io/sprig/))
  - Variables and fields
- Triggered automatically when typing inside `{{ }}`

### 📖 Hover Documentation

- Hover over keywords and functions to see documentation
- Quick reference for function syntax and usage

### ✨ Code Formatting

- Basic formatting for template actions
- Ensures proper spacing around template delimiters
- Consistent spacing after control keywords

### 📝 Code Snippets

- Quick snippets for common patterns:
  - `if` - If statement
  - `ifelse` - If-else statement
  - `range` - Range loop
  - `with` - With statement
  - `define` - Define template
  - `template` - Execute template
  - `var` - Variable assignment
  - And many more!

### 🔧 Language Features

- Auto-closing pairs for `{{ }}`
- Block comments with `{{/* */}}`
- Code folding for `define`, `block`, `if`, `with`, `range` blocks

## Installation

### From Source

1. Clone this repository
2. Run `npm install` to install dependencies
3. Run `npm run compile` to build the extension
4. Press `F5` to open a new VS Code window with the extension loaded

### From VSIX

1. Build the extension: `npm run package`
2. Install the `.vsix` file: `code --install-extension go-template-support-0.0.1.vsix`

## Usage

1. Open any file with `.gotmpl`, `.tmpl`, or `.tpl` extension
2. The extension will automatically activate and provide syntax highlighting
3. Start typing `{{` to trigger autocomplete
4. Hover over keywords for documentation
5. Use `Format Document` command to format your template

## Examples

### Control Structures

```gotmpl
{{ define "BaseEndpoints" }}
  {{ $root := . }}
  {{ range $entityName, $entity := .endpoints }}
    {{ range $groupName, $group := $entity }}
      {{ range $endpoint := $group.endpoints }}
        {{ $prefix := "" }}
        {
          "endpoint": "{{ $prefix }}{{ $endpoint.endpoint_url }}",
          "method": "{{ $endpoint.method }}",
          "output_encoding": "{{ $endpoint.endpoint_output_encoding }}"
        }
      {{ end }}
    {{ end }}
  {{ end }}
{{ end }}
```

### Functions

```gotmpl
{{ if ne $endpoint.endpoint_timeout nil }}
  "timeout": "{{ $endpoint.endpoint_timeout }}"
{{ else }}
  "timeout": "5000ms"
{{ end }}
```

## Supported Syntax

### Control Keywords

`if`, `else`, `end`, `with`, `range`, `define`, `template`, `block`, `break`, `continue`

### Built-in Functions

`and`, `call`, `html`, `index`, `slice`, `js`, `len`, `not`, `or`, `print`, `printf`, `println`, `urlquery`, `eq`, `ne`, `lt`, `le`, `gt`, `ge`

### Sprig Functions (70+)

Full support for all [Sprig template functions](https://masterminds.github.io/sprig/)!

**String Functions:** `trim`, `upper`, `lower`, `title`, `repeat`, `wrap`, `quote`, `cat`, `indent`, `replace`, `split`, `join`, `contains`, `hasPrefix`, `hasSuffix`, and more

**Math Functions:** `add`, `sub`, `mul`, `div`, `mod`, `max`, `min`, `ceil`, `floor`, `round`

**Date Functions:** `now`, `date`, `dateInZone`, `ago`, `dateModify`, `unixEpoch`

**Data Encoding:** `toJson`, `toPrettyJson`, `fromJson`, `toYaml`, `fromYaml`, `toToml`, `fromToml`, `b64enc`, `b64dec`

**Lists:** `list`, `first`, `last`, `rest`, `append`, `prepend`, `concat`, `reverse`, `uniq`, `sortAlpha`

**Dicts:** `dict`, `get`, `set`, `hasKey`, `keys`, `values`, `pick`, `omit`, `merge`, `deepCopy`

**And many more:** Type conversion, paths, UUIDs, crypto, semver, reflection, and more!

## Supported File Extensions

- `.gotmpl` - Go Template files
- `.tmpl` - Template files
- `.tpl` - Template files

## Configuration

The extension works out of the box with sensible defaults. You can customize editor behavior in your VS Code settings:

```json
{
  "[gotmpl]": {
    "editor.tabSize": 2,
    "editor.insertSpaces": true,
    "editor.formatOnSave": true
  }
}
```

### Custom Color Theme

For better syntax highlighting that matches the style shown in the screenshot, you can customize the colors in your `settings.json`. See `recommended-settings.json` for a complete configuration example.

Example color customization:

```json
{
  "editor.tokenColorCustomizations": {
    "textMateRules": [
      {
        "scope": "keyword.control.gotmpl",
        "settings": {
          "foreground": "#c792ea",
          "fontStyle": "italic"
        }
      },
      {
        "scope": "support.function.builtin.gotmpl",
        "settings": {
          "foreground": "#82aaff"
        }
      }
    ]
  }
}
```

## Snippets

The extension includes many helpful snippets. Just type the prefix and press Tab:

- `if` → If statement
- `range` → Range loop
- `define` → Define template
- `var` → Variable assignment
- `template` → Execute template
- And more!

## Configuration

- Formatting is basic and focuses on consistent spacing
- Context-specific variables are not currently analyzed
- Custom function definitions are not parsed from external files

## License

MIT

