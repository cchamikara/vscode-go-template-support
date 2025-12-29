import * as vscode from 'vscode';
import * as path from 'path';
import { SchemaParser } from './lsp/schemaParser';
import { ContextAnalyzer } from './lsp/contextAnalyzer';
import { KrakenDCompletionProvider } from './lsp/krakenDCompletionProvider';
import { KrakenDHoverProvider } from './lsp/krakenDHoverProvider';
import { KrakenDDiagnosticsProvider } from './lsp/krakenDDiagnosticsProvider';

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

const SPRIG_DOCS: Record<string, { description: string; example: string }> = {
  'trim': { description: "The trim function removes space from either side of a string:", example: "trim \"   hello    \"" },
  'trimAll': { description: "Remove given characters from the front or back of a string:", example: "trimAll \"$\" \"$5.00\"" },
  'trimPrefix': { description: "Trim just the prefix from a string:", example: "trimPrefix \"-\" \"-hello\"" },
  'trimSuffix': { description: "Trim just the suffix from a string:", example: "trimSuffix \"-\" \"hello-\"" },
  'upper': { description: "Convert the entire string to uppercase:", example: "upper \"hello\"" },
  'lower': { description: "Convert the entire string to lowercase:", example: "lower \"HELLO\"" },
  'title': { description: "Convert to title case:", example: "title \"hello world\"" },
  'untitle': { description: "Remove title casing. untitle \"Hello World\" produces hello world.", example: "untitle \"Hello World\"" },
  'repeat': { description: "Repeat a string multiple times:", example: "repeat 3 \"hello\"" },
  'substr': { description: "Get a substring from a string. It takes three parameters:", example: "substr 0 5 \"hello world\"" },
  'nospace': { description: "Remove all whitespace from a string.", example: "nospace \"hello w o r l d\"" },
  'trunc': { description: "Truncate a string (and add no suffix)", example: "trunc 5 \"hello world\"" },
  'abbrev': { description: "Truncate a string with ellipses (...)", example: "abbrev 5 \"hello world\"" },
  'abbrevboth': { description: "Abbreviate both sides:", example: "abbrevboth 5 10 \"1234 5678 9123\"" },
  'initials': { description: "Given multiple words, take the first letter of each word and combine.", example: "initials \"First Try\"" },
  'randAlphaNum': { description: "Generate a random alphanumeric string.", example: "randAlphaNum 6" },
  'randAlpha': { description: "Generate a random alphabetic string.", example: "randAlpha 6" },
  'randAscii': { description: "Generate a random ASCII string.", example: "randAscii 6" },
  'randNumeric': { description: "Generate a random numeric string.", example: "randNumeric 6" },
  'wrap': { description: "Wrap text at a given column count:", example: "wrap 80 $someText" },
  'wrapWith': { description: "wrapWith works as wrap, but lets you specify the string to wrap with. (wrap uses \\n)", example: "wrapWith 5 \"\\t\" \"Hello World\"" },
  'contains': { description: "Test to see if one string is contained inside of another:", example: "contains \"cat\" \"catch\"" },
  'hasPrefix': { description: "The hasPrefix and hasSuffix functions test whether a string has a given prefix or suffix:", example: "hasPrefix \"cat\" \"catch\"" },
  'hasSuffix': { description: "Test whether a string has a given suffix.", example: "hasSuffix \"cat\" \"wildcat\"" },
  'quote': { description: "Wrap a string in double quotes.", example: "quote \"hello\"" },
  'squote': { description: "Wrap a string in single quotes.", example: "squote \"hello\"" },
  'cat': { description: "The cat function concatenates multiple strings together into one, separating them with spaces:", example: "cat \"hello\" \"beautiful\" \"world\"" },
  'indent': { description: "The indent function indents every line in a given string to the specified indent width. This is useful when aligning multi-line strings:", example: "indent 4 $lots_of_text" },
  'nindent': { description: "The nindent function is the same as the indent function, but prepends a new line to the beginning of the string.", example: "nindent 4 $lots_of_text" },
  'replace': { description: "Perform simple string replacement.", example: "\"I Am Henry VIII\" | replace \" \" \"-\"" },
  'plural': { description: "Pluralize a string.", example: "len $fish | plural \"one anchovy\" \"many anchovies\"" },
  'snakecase': { description: "Convert string from camelCase to snake_case.", example: "snakecase \"FirstName\"" },
  'camelcase': { description: "Convert string from snake_case to CamelCase", example: "camelcase \"http_server\"" },
  'kebabcase': { description: "Convert string from camelCase to kebab-case.", example: "kebabcase \"FirstName\"" },
  'swapcase': { description: "Swap the case of a string using a word based algorithm.", example: "swapcase \"This Is A.Test\"" },
  'shuffle': { description: "Shuffle a string.", example: "shuffle \"hello\"" },
  'regexMatch': { description: "Returns true if the input string contains any match of the regular expression.", example: "regexMatch \"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\\\.[A-Za-z]{2,}$\" \"test@acme.com\"" },
  'regexFindAll': { description: "Returns a slice of all matches of the regular expression in the input string. The last parameter n determines the number of substrings to return, where -1 means return all matches", example: "regexFindAll \"[2,4,6,8]\" \"123456789\" -1" },
  'regexFind': { description: "Return the first (left most) match of the regular expression in the input string", example: "regexFind \"[a-zA-Z][1-9]\" \"abcd1234\"" },
  'regexReplaceAll': { description: "Returns a copy of the input string, replacing matches of the Regexp with the replacement string replacement. Inside string replacement, $ signs are interpreted as in Expand, so for instance $1 represents the text of the first submatch", example: "regexReplaceAll \"a(x*)b\" \"-ab-axxb-\" \"${1}W\"" },
  'regexReplaceAllLiteral': { description: "Returns a copy of the input string, replacing matches of the Regexp with the replacement string replacement The replacement string is substituted directly, without using Expand", example: "regexReplaceAllLiteral \"a(x*)b\" \"-ab-axxb-\" \"${1}\"" },
  'regexSplit': { description: "Slices the input string into substrings separated by the expression and returns a slice of the substrings between those expression matches. The last parameter n determines the number of substrings to return, where -1 means return all matches", example: "regexSplit \"z+\" \"pizza\" -1" },
  'splitList': { description: "Split a string into a list of strings:", example: "splitList \"$\" \"foo$bar$baz\"" },
  'split': { description: "Split a string into a dict keyed by index.", example: "$a := split \"$\" \"foo$bar$baz\"" },
  'splitn': { description: "splitn function splits a string into a dict. It is designed to make it easy to use template dot notation for accessing members:", example: "$a := splitn \"$\" 2 \"foo$bar$baz\"" },
  'sortAlpha': { description: "Sort a list of strings into alphabetical order.", example: "sortAlpha (list \"b\" \"a\" \"c\")" },
  'join': { description: "Join a list of strings into a single string, with the given separator.", example: "list \"hello\" \"world\" | join \"_\"" },
  'add': { description: "Sum numbers with add. Accepts two or more inputs.", example: "add 1 2 3" },
  'add1': { description: "Increment by 1.", example: "add1 41" },
  'sub': { description: "Subtract numbers.", example: "sub 10 3" },
  'mul': { description: "Multiply with mul. Accepts two or more inputs.", example: "mul 1 2 3" },
  'div': { description: "Divide numbers.", example: "div 10 2" },
  'mod': { description: "Modulo of two numbers.", example: "mod 7 3" },
  'max': { description: "Return the largest of a series of integers:", example: "max 1 2 3" },
  'min': { description: "Return the smallest of a series of integers.", example: "min 1 2 3" },
  'biggest': { description: "Return the largest value.", example: "biggest 1 5 3" },
  'ceil': { description: "Returns the greatest float value greater than or equal to input value", example: "ceil 123.001" },
  'floor': { description: "Returns the greatest float value less than or equal to input value", example: "floor 123.9999" },
  'round': { description: "Returns a float value with the remainder rounded to the given number to digits after the decimal point.", example: "round 123.555555 3" },
  'until': { description: "The until function builds a range of integers.", example: "until 5" },
  'untilStep': { description: "Like until, untilStep generates a list of counting integers. But it allows you to define a start, stop, and step:", example: "untilStep 3 6 2" },
  'seq': { description: "Works like the bash seq command. * 1 parameter (end) - will generate all counting integers between 1 and end inclusive. * 2 parameters (start, end) - will generate all counting integers between start and end inclusive incrementing or decrementing by 1. * 3 parameters (start, step, end) - will generate all counting integers between start and end inclusive incrementing or decrementing by step.", example: "seq 5       => 1 2 3 4 5\nseq -3      => 1 0 -1 -2 -3\nseq 0 2     => 0 1 2\nseq 2 -2    => 2 1 0 -1 -2\nseq 0 2 10  => 0 2 4 6 8 10\nseq 0 -2 -5 => 0 -2 -4" },
  'addf': { description: "Sum numbers with addf", example: "addf 1.5 2 2" },
  'add1f': { description: "Increment a float by 1.", example: "add1f 1.5" },
  'subf': { description: "To subtract, use subf", example: "subf 7.5 2 3" },
  'mulf': { description: "Multiply with mulf", example: "mulf 1.5 2 2" },
  'divf': { description: "Perform integer division with divf", example: "divf 10 2 4" },
  'maxf': { description: "Return the largest of a series of floats:", example: "maxf 1 2.5 3" },
  'minf': { description: "Return the smallest of a series of floats.", example: "minf 1.5 2 3" },
  'now': { description: "The current date/time.", example: "now" },
  'ago': { description: "Return duration from time.Now in seconds resolution.", example: "ago .CreatedAt" },
  'date': { description: "The date function formats a date.", example: "now | date \"2006-01-02\"" },
  'dateInZone': { description: "Same as date, but with a timezone.", example: "dateInZone \"2006-01-02\" (now) \"UTC\"" },
  'duration': { description: "Formats a given amount of seconds as a time.Duration.", example: "duration \"95\"" },
  'durationRound': { description: "Rounds a given duration to the most significant unit. Strings and time.Duration gets parsed as a duration, while a time.Time is calculated as the duration since.", example: "durationRound \"2h10m5s\"" },
  'unixEpoch': { description: "Returns the seconds since the unix epoch for a time.Time.", example: "now | unixEpoch" },
  'dateModify': { description: "Modify a date by a duration string.", example: "now | dateModify \"-1.5h\"" },
  'htmlDate': { description: "The htmlDate function formats a date for inserting into an HTML date picker input field.", example: "now | htmlDate" },
  'htmlDateInZone': { description: "Same as htmlDate, but with a timezone.", example: "htmlDateInZone (now) \"UTC\"" },
  'toDate': { description: "toDate converts a string to a date. The first argument is the date layout and the second the date string. If the string can't be convert it returns the zero value. mustToDate will return an error in case the string cannot be converted.", example: "toDate \"2006-01-02\" \"2017-12-31\" | date \"02/01/2006\"" },
  'mustToDate': { description: "Convert a string to a date and return an error on failure.", example: "mustToDate \"2006-01-02\" \"2017-12-31\" | date \"02/01/2006\"" },
  'default': { description: "To set a simple default value, use default:", example: "default \"foo\" .Bar" },
  'empty': { description: "The empty function returns true if the given value is considered empty, and false otherwise. The empty values are listed in the default section.", example: "empty .Foo" },
  'coalesce': { description: "The coalesce function takes a list of values and returns the first non-empty one.", example: "coalesce 0 1 2" },
  'all': { description: "The all function takes a list of values and returns true if all values are non-empty.", example: "all 0 1 2" },
  'any': { description: "The any function takes a list of values and returns true if any value is non-empty.", example: "any 0 1 2" },
  'compact': { description: "Accepts a list and removes entries with empty values.", example: "$list := list 1 \"a\" \"foo\" \"\"\n$copy := compact $list" },
  'mustCompact': { description: "Remove empty values from a list and return an error on failure.", example: "mustCompact $list" },
  'fromJson': { description: "fromJson decodes a JSON document into a structure. If the input cannot be decoded as JSON the function will return an empty string. mustFromJson will return an error in case the JSON is invalid.", example: "fromJson \"{\\\"foo\\\": 55}\"" },
  'toJson': { description: "The toJson function encodes an item into a JSON string. If the item cannot be converted to JSON the function will return an empty string. mustToJson will return an error in case the item cannot be encoded in JSON.", example: "toJson .Item" },
  'toPrettyJson': { description: "The toPrettyJson function encodes an item into a pretty (indented) JSON string.", example: "toPrettyJson .Item" },
  'toRawJson': { description: "The toRawJson function encodes an item into JSON string with HTML characters unescaped.", example: "toRawJson .Item" },
  'ternary': { description: "Return one of two values based on a condition.", example: "ternary \"yes\" \"no\" (eq 1 1)" },
  'b64enc': { description: "Encode a string with Base64.", example: "b64enc \"hello\"" },
  'b64dec': { description: "Decode a Base64 string.", example: "b64dec \"aGVsbG8=\"" },
  'b32enc': { description: "Encode a string with Base32.", example: "b32enc \"hello\"" },
  'b32dec': { description: "Decode a Base32 string.", example: "b32dec \"NBSWY3DP\"" },
  'encodeurl': { description: "URL-encode a string.", example: "encodeurl \"https://example.com/a b\"" },
  'decodeurl': { description: "URL-decode a string.", example: "decodeurl \"https%3A%2F%2Fexample.com%2Fa%20b\"" },
  'urlParse': { description: "Parses string for URL and produces dict with URL parts", example: "urlParse \"http://admin:secret@server.com:8080/api?list=false#anchor\"" },
  'urlJoin': { description: "Joins map (produced by urlParse) to produce URL string", example: "urlJoin (dict \"fragment\" \"fragment\" \"host\" \"host:80\" \"path\" \"/path\" \"query\" \"query\" \"scheme\" \"http\")" },
  'list': { description: "Create a list of values.", example: "$myList := list 1 2 3 4 5" },
  'first': { description: "Return the first element of a list.", example: "first $myList" },
  'rest': { description: "Return all but the first element of a list.", example: "rest $myList" },
  'last': { description: "Return the last element of a list.", example: "last $myList" },
  'initial': { description: "Return all but the last element of a list.", example: "initial $myList" },
  'append': { description: "Append a new item to an existing list, creating a new list.", example: "$new = append $myList 6" },
  'prepend': { description: "Push an element onto the front of a list, creating a new list.", example: "prepend $myList 0" },
  'concat': { description: "Concatenate arbitrary number of lists into one.", example: "concat $myList ( list 6 7 ) ( list 8 )" },
  'reverse': { description: "Produce a new list with the reversed elements of the given list.", example: "reverse $myList" },
  'uniq': { description: "Generate a list with all of the duplicates removed.", example: "list 1 1 1 2 | uniq" },
  'without': { description: "The without function filters items out of a list.", example: "without $myList 3" },
  'has': { description: "Test to see if a list has a particular element.", example: "has 4 $myList" },
  'slice': { description: "To get partial elements of a list, use slice list [n] [m]. It is equivalent of list[n:m].", example: "slice list [n] [m]" },
  'chunk': { description: "To split a list into chunks of given size, use chunk size list. This is useful for pagination.", example: "chunk 3 (list 1 2 3 4 5 6 7 8)" },
  'dict': { description: "Creating dictionaries is done by calling the dict function and passing it a list of pairs.", example: "$myDict := dict \"name1\" \"value1\" \"name2\" \"value2\" \"name3\" \"value 3\"" },
  'get': { description: "Given a map and a key, get the value from the map.", example: "get $myDict \"name1\"" },
  'set': { description: "Use set to add a new key/value pair to a dictionary.", example: "$_ := set $myDict \"name4\" \"value4\"" },
  'unset': { description: "Given a map and a key, delete the key from the map.", example: "$_ := unset $myDict \"name4\"" },
  'hasKey': { description: "The hasKey function returns true if the given dict contains the given key.", example: "hasKey $myDict \"name1\"" },
  'pluck': { description: "The pluck function makes it possible to give one key and multiple maps, and get a list of all of the matches:", example: "pluck \"name1\" $myDict $myOtherDict" },
  'dig': { description: "The dig function traverses a nested set of dicts, selecting keys from a list of values. It returns a default value if any of the keys are not found at the associated dict.", example: "dig \"user\" \"role\" \"humanName\" \"guest\" $dict" },
  'merge': { description: "Merge two or more dictionaries into one, giving precedence to the dest dictionary:", example: "$newdict := merge $dest $source1 $source2" },
  'mergeOverwrite': { description: "Merge maps, overwriting keys from right to left.", example: "$newdict := mergeOverwrite $dest $source1 $source2" },
  'keys': { description: "The keys function will return a list of all of the keys in one or more dict types. Since a dictionary is _unordered_, the keys will not be in a predictable order. They can be sorted with sortAlpha.", example: "keys $myDict | sortAlpha" },
  'pick': { description: "The pick function selects just the given keys out of a dictionary, creating a new dict.", example: "$new := pick $myDict \"name1\" \"name2\"" },
  'omit': { description: "The omit function is similar to pick, except it returns a new dict with all the keys that _do not_ match the given keys.", example: "$new := omit $myDict \"name1\" \"name3\"" },
  'values': { description: "The values function is similar to keys, except it returns a new list with all the values of the source dict (only one dictionary is supported).", example: "$vals := values $myDict" },
  'deepCopy': { description: "The deepCopy and mustDeepCopy functions takes a value and makes a deep copy of the value. This includes dicts and other structures. deepCopy panics when there is a problem while mustDeepCopy returns an error to the template system when there is an error.", example: "dict \"a\" 1 \"b\" 2 | deepCopy" },
  'mustDeepCopy': { description: "Deep copy a structure and return an error on failure.", example: "$copy := mustDeepCopy $source" },
  'atoi': { description: "Convert a string to an integer.", example: "atoi \"123\"" },
  'int': { description: "Convert a value to an int.", example: "int 123.9" },
  'int64': { description: "Convert a value to an int64.", example: "int64 123.9" },
  'float64': { description: "Convert a value to a float64.", example: "float64 \"3.14\"" },
  'toString': { description: "Convert a value to a string.", example: "toString 123" },
  'toStrings': { description: "Given a list-like collection, produce a slice of strings.", example: "list 1 2 3 | toStrings" },
  'toDecimal': { description: "Given a unix octal permission, produce a decimal.", example: "\"0777\" | toDecimal" },
  'toBool': { description: "Convert a value to a boolean.", example: "toBool \"true\"" },
  'base': { description: "Return the last element of a path.", example: "base \"foo/bar/baz\"" },
  'dir': { description: "Return the directory, stripping the last part of the path. So dir \"foo/bar/baz\" returns foo/bar.", example: "dir \"foo/bar/baz\"" },
  'ext': { description: "Return the file extension.", example: "ext \"foo.bar\"" },
  'clean': { description: "Clean up a path.", example: "clean \"foo/bar/../baz\"" },
  'isAbs': { description: "Test whether a path is absolute.", example: "isAbs \"/usr/local\"" },
  'osBase': { description: "Return the last element of a filepath.", example: "osBase \"/foo/bar/baz\"\nosBase \"C:\\\\foo\\\\bar\\\\baz\"" },
  'osDir': { description: "Return the directory, stripping the last part of the path. So osDir \"/foo/bar/baz\" returns /foo/bar on Linux, and osDir \"C:\\\\foo\\\\bar\\\\baz\" returns C:\\\\foo\\\\bar on Windows.", example: "osDir \"/foo/bar/baz\"" },
  'osExt': { description: "Return the file extension.", example: "osExt \"/foo.bar\"\nosExt \"C:\\\\foo.bar\"" },
  'osClean': { description: "Clean up a path.", example: "osClean \"/foo/bar/../baz\"\nosClean \"C:\\\\foo\\\\bar\\\\..\\\\baz\"" },
  'osIsAbs': { description: "Test whether a file path is absolute.", example: "osIsAbs \"C:\\\\foo\\\\bar\"" },
  'fail': { description: "Unconditionally returns an empty string and an error with the specified text. This is useful in scenarios where other conditionals have determined that template rendering should fail.", example: "fail \"Please accept the end user license agreement\"" },
  'uuidv4': { description: "Generate a UUID v4.", example: "uuidv4" },
  'env': { description: "The env function reads an environment variable:", example: "env \"HOME\"" },
  'expandenv': { description: "To substitute environment variables in a string, use expandenv:", example: "expandenv \"Your path is set to $PATH\"" },
  'semver': { description: "The semver function parses a string into a Semantic Version:", example: "$version := semver \"1.2.3-alpha.1+123\"" },
  'semverCompare': { description: "Compare a version against a constraint.", example: "semverCompare \"^1.2.0\" \"1.2.3\"" },
  'typeOf': { description: "Return the underlying type of a value.", example: "typeOf $foo" },
  'typeIs': { description: "Test whether a value is of a given type.", example: "typeIs \"*bytes.Buffer\" $val" },
  'typeIsLike': { description: "Like typeIs, but dereferences pointers.", example: "typeIsLike \"*bytes.Buffer\" $val" },
  'kindOf': { description: "There are two Kind functions: kindOf returns the kind of an object.", example: "kindOf \"hello\"" },
  'kindIs': { description: "Test whether a value is of a given kind.", example: "kindIs \"int\" 123" },
  'deepEqual': { description: "deepEqual returns true if two values are [\"deeply equal\"](https://golang.org/pkg/reflect/#DeepEqual)", example: "deepEqual (list 1 2 3) (list 1 2 3)" },
  'sha1sum': { description: "The sha1sum function receives a string, and computes it's SHA1 digest.", example: "sha1sum \"Hello world!\"" },
  'sha256sum': { description: "The sha256sum function receives a string, and computes it's SHA256 digest.", example: "sha256sum \"Hello world!\"" },
  'adler32sum': { description: "The adler32sum function receives a string, and computes its Adler-32 checksum.", example: "adler32sum \"Hello world!\"" },
  'htpasswd': { description: "The htpasswd function takes a username, a password, and a hashAlgorithm and generates a bcrypt (recommended) or a base64 encoded and prefixed sha hash of the password. hashAlgorithm is optional and defaults to bcrypt. The result can be used for basic authentication on an [Apache HTTP Server](https://httpd.apache.org/docs/2.4/misc/password_encryptions.html#basic).", example: "htpasswd \"myUser\" \"myPassword\" [\"bcrypt\"|\"sha\"]" },
  'derivePassword': { description: "The derivePassword function can be used to derive a specific password based on some shared \"master password\" constraints. The algorithm for this is [well specified](https://spectre.app/spectre-algorithm.pdf).", example: "derivePassword 1 \"long\" \"password\" \"user\" \"example.com\"" },
  'genPrivateKey': { description: "Generate a private key encoded into a PEM block.", example: "genPrivateKey \"rsa\"" },
  'buildCustomCert': { description: "The buildCustomCert function allows customizing the certificate.", example: "$ca := buildCustomCert \"base64-encoded-ca-crt\" \"base64-encoded-ca-key\"" },
  'genCA': { description: "The genCA function generates a new, self-signed x509 certificate authority using a 2048-bit RSA private key.", example: "$ca := genCA \"foo-ca\" 365" },
  'genSelfSignedCert': { description: "The genSelfSignedCert function generates a new, self-signed x509 certificate using a 2048-bit RSA private key.", example: "$cert := genSelfSignedCert \"foo.com\" (list \"10.0.0.1\" \"10.0.0.2\") (list \"bar.com\" \"bat.com\") 365" },
  'genSignedCert': { description: "Generate a signed x509 certificate.", example: "$cert := genSignedCert \"foo.com\" (list \"10.0.0.1\") (list \"bar.com\") 365 $ca" },
  'encryptAES': { description: "The encryptAES function encrypts text with AES-256 CBC and returns a base64 encoded string.", example: "encryptAES \"secretkey\" \"plaintext\"" },
  'decryptAES': { description: "The decryptAES function receives a base64 string encoded by the AES-256 CBC algorithm and returns the decoded text.", example: "\"30tEfhuJSVRhpG97XCuWgz2okj7L8vQ1s6V9zVUPeDQ=\" | decryptAES \"secretkey\"" },
  'getHostByName': { description: "The getHostByName receives a domain name and returns the ip address.", example: "getHostByName \"www.google.com\" would return the corresponding ip address of www.google.com" },
  'toYaml': { description: "Convert a value to YAML.", example: "dict \"name\" \"demo\" | toYaml" },
  'fromYaml': { description: "Parse YAML into a map.", example: "fromYaml \"name: demo\"" },
  'toToml': { description: "Convert a value to TOML.", example: "dict \"name\" \"demo\" | toToml" },
  'fromToml': { description: "Parse TOML into a map.", example: "fromToml \"name = \\\"demo\\\"\"" },
};

// Helper function for Sprig documentation (shared between providers)
function getSprigDocumentation(func: string): string | undefined {
  const doc = SPRIG_DOCS[func];
  if (!doc) {
    return undefined;
  }
  return `${doc.description}\n\nExample:\n\`\`\`\n${doc.example}\n\`\`\``;
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

  // Initialize KrakenD schema-based providers
  const schemaPath = path.join(context.extensionPath, 'krakendSchema.json');
  const schemaParser = new SchemaParser(schemaPath);
  const contextAnalyzer = new ContextAnalyzer();

  // KrakenD schema-based completion provider - REGISTER FIRST with higher priority
  const krakenDCompletionProvider = vscode.languages.registerCompletionItemProvider(
    documentSelector,
    new KrakenDCompletionProvider(schemaParser, contextAnalyzer),
    '.', ' '  // Trigger on dot and space
  );

  // Register original completion provider (for Sprig functions and keywords) - LOWER priority
  const completionProvider = vscode.languages.registerCompletionItemProvider(
    documentSelector,
    new GoTemplateCompletionProvider(),
    '{', ' ', '.'
  );

  const krakenDHoverProvider = vscode.languages.registerHoverProvider(
    documentSelector,
    new KrakenDHoverProvider(schemaParser, contextAnalyzer)
  );

  // Register hover provider (for keywords and Sprig functions)
  const hoverProvider = vscode.languages.registerHoverProvider(
    documentSelector,
    new GoTemplateHoverProvider()
  );

  const krakenDDiagnostics = new KrakenDDiagnosticsProvider(schemaParser, contextAnalyzer);

  // Update diagnostics on document change
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(event => {
      if (event.document.languageId === 'gotmpl') {
        krakenDDiagnostics.updateDiagnostics(event.document);
      }
    })
  );

  // Update diagnostics on document open
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(document => {
      if (document.languageId === 'gotmpl') {
        krakenDDiagnostics.updateDiagnostics(document);
      }
    })
  );

  // Update diagnostics for already open documents
  vscode.workspace.textDocuments.forEach(document => {
    if (document.languageId === 'gotmpl') {
      krakenDDiagnostics.updateDiagnostics(document);
    }
  });

  // Register formatting provider
  const formattingProvider = vscode.languages.registerDocumentFormattingEditProvider(
    documentSelector,
    new GoTemplateFormattingProvider()
  );

  context.subscriptions.push(
    krakenDCompletionProvider,  // KrakenD schema fields - FIRST (highest priority)
    completionProvider,         // Sprig/keywords - SECOND
    krakenDHoverProvider,       // KrakenD hover - FIRST
    hoverProvider,              // Generic hover - SECOND
    krakenDDiagnostics,
    formattingProvider
  );
}

export function deactivate() { }
