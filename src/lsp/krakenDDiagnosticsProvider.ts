import * as vscode from 'vscode';
import { SchemaParser } from './schemaParser';
import { ContextAnalyzer, CtxType } from './contextAnalyzer';

export class KrakenDDiagnosticsProvider {
  private diagnosticCollection: vscode.DiagnosticCollection;

  constructor(
    private schemaParser: SchemaParser,
    private contextAnalyzer: ContextAnalyzer
  ) {
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('krakend-gotmpl');
  }

  public updateDiagnostics(document: vscode.TextDocument): void {
    if (document.languageId !== 'gotmpl') {
      return;
    }

    const diagnostics: vscode.Diagnostic[] = [];
    const text = document.getText();

    // Find all field references: {{ $variable.field }}
    const fieldPattern = /\{\{\s*\$(\w+)\.(\w+)/g;
    let match;

    while ((match = fieldPattern.exec(text)) !== null) {
      const variableName = match[1];
      const fieldName = match[2];
      const matchStart = match.index + match[0].indexOf(`$${variableName}.${fieldName}`);
      const position = document.positionAt(matchStart);

      // Use context analyzer to determine actual context
      const context = this.contextAnalyzer.analyzeContext(document, position);

      // Skip validation if context is unknown
      if (context.type === 'unknown') {
        continue;
      }

      // Check if field is valid in this context
      if (!this.schemaParser.isValidField(context.type, fieldName)) {
        const range = new vscode.Range(
          position,
          document.positionAt(matchStart + `$${variableName}.${fieldName}`.length)
        );

        const diagnostic = new vscode.Diagnostic(
          range,
          `Field '${fieldName}' does not exist in ${context.type} schema`,
          vscode.DiagnosticSeverity.Warning
        );

        diagnostic.source = 'KrakenD Schema';
        diagnostic.code = 'unknown-field';

        // Add a suggested fix if it's close to a valid field
        const suggestions = this.findSimilarFields(context.type, fieldName);
        if (suggestions.length > 0) {
          diagnostic.message += `. Did you mean: ${suggestions.slice(0, 3).join(', ')}?`;
        }

        diagnostics.push(diagnostic);
      }
    }

    // Validate enum values in JSON strings
    this.validateEnumValues(document, diagnostics);
    this.validateTemplateJsonCommas(document, diagnostics);

    this.diagnosticCollection.set(document.uri, diagnostics);
  }

  private validateEnumValues(document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]): void {
    const text = document.getText();
    const lines = text.split('\n');

    lines.forEach((line, lineIndex) => {
      // Look for patterns like "method": "GET"
      const jsonValuePattern = /"(\w+)":\s*"([^"]+)"/g;
      let match;

      while ((match = jsonValuePattern.exec(line)) !== null) {
        const fieldName = match[1];
        const value = match[2];

        // Check if this value is from a template variable - if so, skip validation
        if (value.includes('{{')) {
          continue;
        }

        // Try to determine context and validate enum
        const position = new vscode.Position(lineIndex, 0);
        const context = this.contextAnalyzer.analyzeContext(document, position);

        if (context.type !== 'unknown') {
          const enumValues = this.schemaParser.getEnumValues(context.type, fieldName);

          if (enumValues && enumValues.length > 0 && !enumValues.includes(value)) {
            const valueStart = match.index + match[0].indexOf(`"${value}"`);
            const range = new vscode.Range(
              new vscode.Position(lineIndex, valueStart),
              new vscode.Position(lineIndex, valueStart + value.length + 2)
            );

            const diagnostic = new vscode.Diagnostic(
              range,
              `Invalid value '${value}' for field '${fieldName}'. Expected one of: ${enumValues.join(', ')}`,
              vscode.DiagnosticSeverity.Error
            );

            diagnostic.source = 'KrakenD Schema';
            diagnostic.code = 'invalid-enum-value';

            diagnostics.push(diagnostic);
          }
        }
      }
    });
  }

  private findSimilarFields(contextType: CtxType, fieldName: string): string[] {
    const fields = contextType === 'endpoint' ? this.schemaParser.getEndpointFields() :
      contextType === 'backend' ? this.schemaParser.getBackendFields() :
        this.schemaParser.getRootFields();

    // Simple similarity check based on Levenshtein distance
    return fields
      .map(f => ({
        name: f.name,
        distance: this.levenshteinDistance(fieldName.toLowerCase(), f.name.toLowerCase()),
      }))
      .filter(item => item.distance <= 3)
      .sort((a, b) => a.distance - b.distance)
      .map(item => item.name);
  }

  private validateTemplateJsonCommas(document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]): void {
    if (!document.fileName.endsWith('.json.tmpl')) {
      return;
    }

    const rawLines = document.getText().split('\n');
    const cleanedLines = rawLines.map(line => this.cleanTemplateLine(line));

    for (let i = 0; i < cleanedLines.length; i++) {
      const line = cleanedLines[i];
      if (!line) {
        continue;
      }

      const trimmed = line.trim();
      if (!trimmed || trimmed === ',') {
        continue;
      }

      if (!this.isJsonPropertyLine(trimmed)) {
        continue;
      }

      if (this.lineAllowsNoComma(trimmed)) {
        continue;
      }

      const nextIndex = this.findNextNonEmptyLine(cleanedLines, i + 1);
      if (nextIndex === -1) {
        continue;
      }

      const nextLine = cleanedLines[nextIndex].trim();
      if (nextLine === ',') {
        continue;
      }

      if (nextLine.startsWith('"')) {
        const range = new vscode.Range(
          new vscode.Position(i, Math.max(rawLines[i].length - 1, 0)),
          new vscode.Position(i, rawLines[i].length)
        );

        const diagnostic = new vscode.Diagnostic(
          range,
          'Possible missing comma before next JSON property',
          vscode.DiagnosticSeverity.Error
        );

        diagnostic.source = 'Template JSON';
        diagnostic.code = 'missing-comma';
        diagnostics.push(diagnostic);
      }
    }
  }

  private cleanTemplateLine(line: string): string {
    const templateOnly = /^\s*\{\{[\s\S]*\}\}\s*$/.test(line);
    if (templateOnly) {
      return line.includes(',') ? ',' : '';
    }

    const cleaned = line.replace(/\{\{[\s\S]*?\}\}/g, '0');
    return cleaned.trim() ? cleaned : '';
  }

  private isJsonPropertyLine(line: string): boolean {
    return /"\s*[^"]+"\s*:/.test(line);
  }

  private lineAllowsNoComma(line: string): boolean {
    return /[{\[,]\s*$/.test(line);
  }

  private findNextNonEmptyLine(lines: string[], start: number): number {
    for (let i = start; i < lines.length; i++) {
      if (lines[i].trim()) {
        return i;
      }
    }
    return -1;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  public dispose(): void {
    this.diagnosticCollection.dispose();
  }
}
