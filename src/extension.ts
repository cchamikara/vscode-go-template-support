import * as vscode from 'vscode';

// Built-in Go template functions and keywords
const TEMPLATE_KEYWORDS = [
  'if', 'else', 'end', 'with', 'range', 'define', 'template', 'block', 'break', 'continue'
];

const BUILTIN_FUNCTIONS = [
  'and', 'call', 'html', 'index', 'slice', 'js', 'len', 'not', 'or',
  'print', 'printf', 'println', 'urlquery', 'eq', 'ne', 'lt', 'le', 'gt', 'ge'
];

// Sprig functions - https://masterminds.github.io/sprig/
const SPRIG_FUNCTIONS = {
  // String Functions
  strings: [
    'trim', 'trimAll', 'trimPrefix', 'trimSuffix', 'trimSuffix', 'upper', 'lower', 'title',
    'untitle', 'repeat', 'substr', 'nospace', 'trunc', 'abbrev', 'abbrevboth', 'initials',
    'randAlphaNum', 'randAlpha', 'randAscii', 'randNumeric', 'wrap', 'wrapWith', 'contains',
    'hasPrefix', 'hasSuffix', 'quote', 'squote', 'cat', 'indent', 'nindent', 'replace',
    'plural', 'snakecase', 'camelcase', 'kebabcase', 'swapcase', 'shuffle', 'regexMatch',
    'regexFindAll', 'regexFind', 'regexReplaceAll', 'regexReplaceAllLiteral', 'regexSplit'
  ],
  // String Slice Functions
  stringSlice: ['splitList', 'split', 'splitn', 'sortAlpha', 'join'],
  // Integer Math Functions
  intMath: ['add', 'add1', 'sub', 'mul', 'div', 'mod', 'max', 'min', 'biggest', 'ceil', 'floor', 'round'],
  // Integer Slice Functions
  intSlice: ['until', 'untilStep', 'seq'],
  // Float Math Functions
  floatMath: ['addf', 'add1f', 'subf', 'mulf', 'divf', 'maxf', 'minf'],
  // Date Functions
  date: [
    'now', 'ago', 'date', 'dateInZone', 'duration', 'durationRound', 'unixEpoch', 'dateModify',
    'htmlDate', 'htmlDateInZone', 'toDate', 'mustToDate'
  ],
  // Defaults Functions
  defaults: ['default', 'empty', 'coalesce', 'all', 'any', 'compact', 'mustCompact', 'fromJson', 'toJson', 'toPrettyJson', 'toRawJson', 'ternary'],
  // Encoding Functions
  encoding: [
    'b64enc', 'b64dec', 'b32enc', 'b32dec', 'encodeurl', 'decodeurl', 'urlParse', 'urlJoin'
  ],
  // Lists Functions
  lists: [
    'list', 'first', 'rest', 'last', 'initial', 'append', 'prepend', 'concat', 'reverse',
    'uniq', 'without', 'has', 'slice', 'chunk'
  ],
  // Dictionaries Functions
  dicts: [
    'dict', 'get', 'set', 'unset', 'hasKey', 'pluck', 'dig', 'merge', 'mergeOverwrite',
    'keys', 'pick', 'omit', 'values', 'deepCopy', 'mustDeepCopy'
  ],
  // Type Conversion Functions
  typeConversion: [
    'atoi', 'int', 'int64', 'float64', 'toString', 'toStrings', 'toDecimal', 'toBool'
  ],
  // Path and Filepath Functions
  path: ['base', 'dir', 'ext', 'clean', 'isAbs', 'osBase', 'osDir', 'osExt', 'osClean', 'osIsAbs'],
  // Flow Control Functions
  flow: ['fail'],
  // UUID Functions
  uuid: ['uuidv4'],
  // OS Functions
  os: ['env', 'expandenv'],
  // Version Comparison Functions
  semver: ['semver', 'semverCompare'],
  // Reflection Functions
  reflection: ['typeOf', 'typeIs', 'typeIsLike', 'kindOf', 'kindIs', 'deepEqual'],
  // Cryptographic Functions
  crypto: [
    'sha1sum', 'sha256sum', 'adler32sum', 'htpasswd', 'derivePassword', 'genPrivateKey',
    'buildCustomCert', 'genCA', 'genSelfSignedCert', 'genSignedCert', 'encryptAES', 'decryptAES'
  ],
  // Network Functions
  network: ['getHostByName'],
  // Data Structures
  dataStructures: ['toYaml', 'fromYaml', 'toToml', 'fromToml'],
};

// Flatten all Sprig functions into a single array
const ALL_SPRIG_FUNCTIONS = Object.values(SPRIG_FUNCTIONS).flat();

// Helper function for Sprig documentation (shared between providers)
function getSprigDocumentation(func: string): string | undefined {
  const docs: { [key: string]: string } = {
    // String functions
    'trim': 'Remove whitespace from both sides of a string',
    'upper': 'Convert string to uppercase',
    'lower': 'Convert string to lowercase',
    'title': 'Convert to title case',
    'repeat': 'Repeat a string multiple times',
    'substr': 'Get substring',
    'trunc': 'Truncate a string',
    'abbrev': 'Abbreviate a string with ellipsis',
    'wrap': 'Wrap text at given column',
    'quote': 'Wrap string in double quotes',
    'squote': 'Wrap string in single quotes',
    'cat': 'Concatenate strings with spaces',
    'indent': 'Indent every line',
    'nindent': 'Add newline then indent',
    'replace': 'Replace occurrences in string',
    'plural': 'Pluralize a word',
    'snakecase': 'Convert to snake_case',
    'camelcase': 'Convert to camelCase',
    'kebabcase': 'Convert to kebab-case',
    'contains': 'Test if string contains substring',
    'hasPrefix': 'Test if string has prefix',
    'hasSuffix': 'Test if string has suffix',
    // Math functions
    'add': 'Add numbers',
    'sub': 'Subtract numbers',
    'mul': 'Multiply numbers',
    'div': 'Divide numbers',
    'mod': 'Modulo operation',
    'max': 'Return maximum value',
    'min': 'Return minimum value',
    'ceil': 'Round up to nearest integer',
    'floor': 'Round down to nearest integer',
    'round': 'Round to nearest integer',
    // Date functions
    'now': 'Current date/time',
    'date': 'Format a date',
    'dateModify': 'Modify a date',
    'ago': 'Duration from now',
    'dateInZone': 'Parse date in timezone',
    'unixEpoch': 'Get Unix timestamp',
    // Default functions
    'default': 'Set default value if empty',
    'empty': 'Test if value is empty',
    'coalesce': 'Return first non-empty value',
    'ternary': 'Ternary operator: condition ? true : false',
    // Encoding functions
    'b64enc': 'Base64 encode',
    'b64dec': 'Base64 decode',
    'b32enc': 'Base32 encode',
    'b32dec': 'Base32 decode',
    'urlParse': 'Parse URL',
    'urlJoin': 'Join URL components',
    // Data structure functions
    'toJson': 'Convert to JSON',
    'toPrettyJson': 'Convert to pretty JSON',
    'toRawJson': 'Convert to raw JSON',
    'fromJson': 'Parse JSON',
    'toYaml': 'Convert to YAML',
    'fromYaml': 'Parse YAML',
    'toToml': 'Convert to TOML',
    'fromToml': 'Parse TOML',
    // List functions
    'list': 'Create a list',
    'first': 'Get first element',
    'last': 'Get last element',
    'rest': 'Get all but first element',
    'initial': 'Get all but last element',
    'append': 'Append to list',
    'prepend': 'Prepend to list',
    'concat': 'Concatenate lists',
    'reverse': 'Reverse a list',
    'uniq': 'Remove duplicates',
    'sortAlpha': 'Sort alphabetically',
    'join': 'Join list elements',
    'split': 'Split string into list',
    'splitList': 'Split string into list (deprecated)',
    // Dict functions
    'dict': 'Create a dictionary',
    'get': 'Get value from dict',
    'set': 'Set value in dict',
    'hasKey': 'Check if key exists',
    'pluck': 'Get values for key from list of dicts',
    'dig': 'Navigate nested dicts',
    'merge': 'Merge dictionaries',
    'keys': 'Get dictionary keys',
    'values': 'Get dictionary values',
    'pick': 'Select keys from dict',
    'omit': 'Remove keys from dict',
    'deepCopy': 'Deep copy a structure',
    // Type conversion
    'atoi': 'Convert string to integer',
    'int': 'Convert to integer',
    'int64': 'Convert to int64',
    'float64': 'Convert to float64',
    'toString': 'Convert to string',
    'toBool': 'Convert to boolean',
    // UUID
    'uuidv4': 'Generate UUIDv4',
    // OS
    'env': 'Get environment variable',
    'expandenv': 'Expand environment variables',
    // Crypto
    'sha1sum': 'SHA1 hash',
    'sha256sum': 'SHA256 hash',
    'htpasswd': 'Generate htpasswd entry',
    'derivePassword': 'Derive password from master',
    // Flow control
    'fail': 'Fail with error message',
    // Semver
    'semver': 'Parse semantic version',
    'semverCompare': 'Compare semantic versions',
    // Reflection
    'typeOf': 'Get type of value',
    'kindOf': 'Get kind of value',
    'typeIs': 'Test if value is type',
    'kindIs': 'Test if value is kind',
    'deepEqual': 'Deep equality comparison',
    // Integer slice
    'until': 'Generate list from 0 to n',
    'untilStep': 'Generate list with step',
    'seq': 'Generate sequence',
    // Path
    'base': 'Get base name of path',
    'dir': 'Get directory of path',
    'ext': 'Get file extension',
    'clean': 'Clean path',
    'isAbs': 'Test if path is absolute',
  };
  return docs[func];
}

function getSprigCategory(func: string): string {
  for (const [category, functions] of Object.entries(SPRIG_FUNCTIONS)) {
    if (functions.includes(func)) {
      return category.replace(/([A-Z])/g, ' $1').trim();
    }
  }
  return 'function';
}

class GoTemplateCompletionProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
    _context: vscode.CompletionContext
  ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
    const linePrefix = document.lineAt(position).text.substr(0, position.character);

    // Check if we're inside a template action {{ }}
    const lastOpenBrace = linePrefix.lastIndexOf('{{');
    const lastCloseBrace = linePrefix.lastIndexOf('}}');

    if (lastOpenBrace === -1 || lastCloseBrace > lastOpenBrace) {
      return undefined;
    }

    const completionItems: vscode.CompletionItem[] = [];

    // Add control keywords
    TEMPLATE_KEYWORDS.forEach(keyword => {
      const item = new vscode.CompletionItem(keyword, vscode.CompletionItemKind.Keyword);
      item.detail = 'Template control keyword';
      item.insertText = new vscode.SnippetString(`${keyword} $1$0`);
      completionItems.push(item);
    });

    // Add built-in functions
    BUILTIN_FUNCTIONS.forEach(func => {
      const item = new vscode.CompletionItem(func, vscode.CompletionItemKind.Function);
      item.detail = 'Built-in template function';

      // Add specific documentation for common functions
      switch (func) {
        case 'printf':
          item.documentation = 'Format and print a string';
          item.insertText = new vscode.SnippetString(`${func} "$1" $2`);
          break;
        case 'index':
          item.documentation = 'Access element at index';
          item.insertText = new vscode.SnippetString(`${func} $1 $2`);
          break;
        case 'len':
          item.documentation = 'Return length of item';
          item.insertText = new vscode.SnippetString(`${func} $1`);
          break;
        default:
          item.insertText = func;
      }

      completionItems.push(item);
    });

    // Add Sprig functions
    ALL_SPRIG_FUNCTIONS.forEach(func => {
      const item = new vscode.CompletionItem(func, vscode.CompletionItemKind.Function);
      item.detail = 'Sprig template function';
      item.documentation = getSprigDocumentation(func);
      item.insertText = func;
      completionItems.push(item);
    });

    // Add variable suggestions
    if (linePrefix.includes('$')) {
      const dollarItem = new vscode.CompletionItem('$', vscode.CompletionItemKind.Variable);
      dollarItem.detail = 'Root context';
      dollarItem.documentation = 'Reference to the root data object';
      completionItems.push(dollarItem);
    }

    return completionItems;
  }
}

class GoTemplateHoverProvider implements vscode.HoverProvider {
  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Hover> {
    const range = document.getWordRangeAtPosition(position);
    const word = document.getText(range);

    if (TEMPLATE_KEYWORDS.includes(word)) {
      return new vscode.Hover(this.getKeywordDocumentation(word));
    }

    if (BUILTIN_FUNCTIONS.includes(word)) {
      return new vscode.Hover(this.getFunctionDocumentation(word));
    }

    if (ALL_SPRIG_FUNCTIONS.includes(word)) {
      return new vscode.Hover(this.getSprigHoverDocumentation(word));
    }

    return undefined;
  }

  private getSprigHoverDocumentation(func: string): vscode.MarkdownString {
    const description = getSprigDocumentation(func) || 'Sprig template function';
    const category = getSprigCategory(func);

    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**${func}** (Sprig ${category})\n\n`);
    md.appendMarkdown(`${description}\n\n`);
    md.appendMarkdown(`[Sprig Documentation](https://masterminds.github.io/sprig/)`);
    md.isTrusted = true;
    return md;
  }

  private getKeywordDocumentation(keyword: string): vscode.MarkdownString {
    const docs: { [key: string]: string } = {
      'if': '`{{ if pipeline }} T1 {{ end }}`\n\nConditional execution',
      'else': '`{{ if pipeline }} T1 {{ else }} T0 {{ end }}`\n\nAlternative branch',
      'range': '`{{ range pipeline }} T1 {{ end }}`\n\nIterate over array, slice, map, or channel',
      'with': '`{{ with pipeline }} T1 {{ end }}`\n\nSet dot (.) to the value of pipeline',
      'define': '`{{ define "name" }} T1 {{ end }}`\n\nDefine a named template',
      'template': '`{{ template "name" pipeline }}`\n\nExecute a named template',
      'block': '`{{ block "name" pipeline }} T1 {{ end }}`\n\nDefine and execute a template',
      'end': 'Ends a control structure (if, with, range, define, block)'
    };

    const md = new vscode.MarkdownString(docs[keyword] || keyword);
    md.isTrusted = true;
    return md;
  }

  private getFunctionDocumentation(func: string): vscode.MarkdownString {
    const docs: { [key: string]: string } = {
      'printf': '`printf format args...`\n\nFormats according to a format specifier',
      'print': '`print args...`\n\nPrints arguments',
      'println': '`println args...`\n\nPrints arguments with newline',
      'len': '`len item`\n\nReturns the length of item',
      'index': '`index collection key`\n\nReturns indexed element',
      'eq': '`eq arg1 arg2...`\n\nReturns true if arg1 == arg2',
      'ne': '`ne arg1 arg2`\n\nReturns true if arg1 != arg2',
      'lt': '`lt arg1 arg2`\n\nReturns true if arg1 < arg2',
      'le': '`le arg1 arg2`\n\nReturns true if arg1 <= arg2',
      'gt': '`gt arg1 arg2`\n\nReturns true if arg1 > arg2',
      'ge': '`ge arg1 arg2`\n\nReturns true if arg1 >= arg2',
      'and': '`and arg1 arg2...`\n\nLogical AND',
      'or': '`or arg1 arg2...`\n\nLogical OR',
      'not': '`not arg`\n\nLogical NOT'
    };

    const md = new vscode.MarkdownString(docs[func] || func);
    md.isTrusted = true;
    return md;
  }
}

class GoTemplateFormattingProvider implements vscode.DocumentFormattingEditProvider {
  provideDocumentFormattingEdits(
    document: vscode.TextDocument,
    _options: vscode.FormattingOptions,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.TextEdit[]> {
    const edits: vscode.TextEdit[] = [];
    const text = document.getText();

    // Basic formatting: ensure proper spacing around template delimiters
    let formatted = text;

    // Add space after opening braces if not present
    formatted = formatted.replace(/\{\{(?!\s|-)([^\s}])/g, '{{ $1');

    // Add space before closing braces if not present
    formatted = formatted.replace(/([^\s{])(?<!-)\}\}/g, '$1 }}');

    // Ensure single space after control keywords
    formatted = formatted.replace(
      /\{\{\s*(if|else|end|with|range|define|template|block)\s+/g,
      '{{ $1 '
    );

    if (formatted !== text) {
      const lastLine = document.lineAt(document.lineCount - 1);
      const range = new vscode.Range(
        new vscode.Position(0, 0),
        new vscode.Position(document.lineCount - 1, lastLine.text.length)
      );
      edits.push(vscode.TextEdit.replace(range, formatted));
    }

    return edits;
  }
}

export function activate(context: vscode.ExtensionContext) {
  console.log('Go Template Support extension is now active');

  const documentSelector: vscode.DocumentSelector = {
    language: 'gotmpl',
    scheme: 'file'
  };

  // Register completion provider
  const completionProvider = vscode.languages.registerCompletionItemProvider(
    documentSelector,
    new GoTemplateCompletionProvider(),
    '{', ' ', '.'
  );

  // Register hover provider
  const hoverProvider = vscode.languages.registerHoverProvider(
    documentSelector,
    new GoTemplateHoverProvider()
  );

  // Register formatting provider
  const formattingProvider = vscode.languages.registerDocumentFormattingEditProvider(
    documentSelector,
    new GoTemplateFormattingProvider()
  );

  context.subscriptions.push(completionProvider, hoverProvider, formattingProvider);
}

export function deactivate() { }
