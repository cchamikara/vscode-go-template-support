import * as vscode from 'vscode';

export type CtxType = 'endpoint' | 'backend' | 'unknown';

export interface TemplateContext {
  type: CtxType;
  variableName?: string;
  fieldPath?: string[];
  range?: vscode.Range;
}

export class ContextAnalyzer {
  /**
   * Analyzes the template context at the given position
   */
  public analyzeContext(document: vscode.TextDocument, position: vscode.Position): TemplateContext {
    const line = document.lineAt(position.line).text;
    const charBeforeCursor = position.character;
    const textBeforeCursor = line.substring(0, charBeforeCursor);

    // Check if we're inside template delimiters {{ }}
    const lastOpen = textBeforeCursor.lastIndexOf('{{');
    const lastClose = textBeforeCursor.lastIndexOf('}}');

    if (lastOpen === -1 || lastClose > lastOpen) {
      return { type: 'unknown' };
    }

    // Extract the expression inside {{ }}
    const expression = textBeforeCursor.substring(lastOpen + 2).trim();

    // Parse variable reference: $variableName.field1.field2
    const varMatch = expression.match(/\$(\w+)((?:\.\w+)*)/);
    if (varMatch) {
      const variableName = varMatch[1];
      const fieldPath = varMatch[2] ? varMatch[2].substring(1).split('.').filter(f => f) : [];

      // Determine context type - PRIORITIZE range expression over variable name
      let type: CtxType;

      // First, try to infer from surrounding context (most reliable)
      type = this.inferContextFromSurrounding(document, position);

      // If still unknown, try variable name hints
      if (type === 'unknown') {
        if (variableName === 'endpoint' || variableName.toLowerCase().includes('endpoint')) {
          type = 'endpoint';
        } else if (variableName === 'backend' || variableName.toLowerCase().includes('backend')) {
          type = 'backend';
        }
      }

      return {
        type,
        variableName,
        fieldPath,
      };
    }

    return { type: 'unknown' };
  }

  /**
   * Infer context from surrounding range statements
   */
  private inferContextFromSurrounding(document: vscode.TextDocument, position: vscode.Position): CtxType {
    const textBefore = document.getText(new vscode.Range(
      new vscode.Position(Math.max(0, position.line - 50), 0),
      position
    ));

    // Look for range statements that might give us context
    // Match both simple and nested ranges: {{ range $x := .endpoints }} and {{ range $idx, $x := .endpoints }}
    const rangeMatches = textBefore.matchAll(/\{\{\s*range\s+(?:\$\w+,\s*)?\$(\w+)\s*:=\s*([^\}]+)\}\}/g);
    const matches = Array.from(rangeMatches);

    if (matches.length > 0) {
      const lastRange = matches[matches.length - 1];
      const variableName = lastRange[1];
      const rangeExpression = lastRange[2];

      // Check if the range expression contains endpoint or backend keywords
      if (rangeExpression.includes('endpoints') || rangeExpression.includes('.endpoints')) {
        return 'endpoint';
      } else if (rangeExpression.includes('backends') || rangeExpression.includes('.backends') || rangeExpression.includes('frontend_backends')) {
        return 'backend';
      }

      // Also check variable names for hints
      if (variableName.toLowerCase().includes('endpoint')) {
        return 'endpoint';
      } else if (variableName.toLowerCase().includes('backend')) {
        return 'backend';
      }
    }

    return 'unknown';
  }

  /**
   * Get the word range at position, considering template syntax
   */
  public getFieldWordRange(document: vscode.TextDocument, position: vscode.Position): vscode.Range | undefined {
    const line = document.lineAt(position.line).text;
    const char = position.character;

    // Find the field name boundaries
    let start = char;
    let end = char;

    // Move start backwards to find the beginning of the word
    while (start > 0 && this.isFieldChar(line[start - 1])) {
      start--;
    }

    // Move end forwards to find the end of the word
    while (end < line.length && this.isFieldChar(line[end])) {
      end++;
    }

    if (start === end) {
      return undefined;
    }

    return new vscode.Range(
      new vscode.Position(position.line, start),
      new vscode.Position(position.line, end)
    );
  }

  private isFieldChar(char: string): boolean {
    return /[a-zA-Z0-9_]/.test(char);
  }

  /**
   * Check if position is inside template delimiters
   */
  public isInsideTemplateDelimiters(document: vscode.TextDocument, position: vscode.Position): boolean {
    const line = document.lineAt(position.line).text;
    const textBefore = line.substring(0, position.character);
    const textAfter = line.substring(position.character);

    const lastOpen = textBefore.lastIndexOf('{{');
    const lastClose = textBefore.lastIndexOf('}}');
    const nextClose = textAfter.indexOf('}}');

    return lastOpen !== -1 && (lastClose === -1 || lastClose < lastOpen) && nextClose !== -1;
  }

  /**
   * Extract variable name and field from a reference like $endpoint.field_name
   */
  public parseFieldReference(text: string): { variable: string; field: string } | undefined {
    const match = text.match(/\$(\w+)\.(\w+)/);
    if (match) {
      return {
        variable: match[1],
        field: match[2],
      };
    }
    return undefined;
  }

  /**
   * Get the full expression context from cursor position
   */
  public getExpressionAtPosition(document: vscode.TextDocument, position: vscode.Position): string | undefined {
    const line = document.lineAt(position.line).text;
    const textBefore = line.substring(0, position.character);

    const lastOpen = textBefore.lastIndexOf('{{');
    if (lastOpen === -1) {
      return undefined;
    }

    const expression = textBefore.substring(lastOpen + 2).trim();
    return expression;
  }
}

