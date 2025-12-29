import * as vscode from 'vscode';
import { SchemaParser, FieldInfo } from './schemaParser';
import { ContextAnalyzer, CtxType } from './contextAnalyzer';

export class KrakenDCompletionProvider implements vscode.CompletionItemProvider {
  constructor(
    private schemaParser: SchemaParser,
    private contextAnalyzer: ContextAnalyzer
  ) { }

  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
    const line = document.lineAt(position.line).text;
    const textBefore = line.substring(0, position.character);

    // Check if we're typing after a dot (field access)
    const dotMatch = textBefore.match(/\$(\w+)\.(\w*)$/);
    if (dotMatch) {
      const variableName = dotMatch[1];
      const partialField = dotMatch[2];

      // Determine context type
      const templateContext = this.contextAnalyzer.analyzeContext(document, position);

      console.log('[KrakenD] Completion triggered');
      console.log('  Variable:', variableName);
      console.log('  Context type:', templateContext.type);
      console.log('  Partial field:', partialField);

      if (templateContext.type !== 'unknown') {
        const items = this.getFieldCompletions(templateContext.type, partialField);
        console.log('  Returning', items.length, 'KrakenD field completions');

        // Return as CompletionList with high sortText to prioritize over other providers
        return new vscode.CompletionList(items, false);
      } else {
        console.log('  Context unknown - no KrakenD suggestions');
      }
    }

    // Check if we're in a string value context for enum suggestions
    const enumContext = this.detectEnumContext(document, position);
    if (enumContext) {
      return this.getEnumCompletions(enumContext.context, enumContext.field);
    }

    return undefined;
  }

  private getFieldCompletions(
    contextType: CtxType,
    partialField: string
  ): vscode.CompletionItem[] {
    const fields = contextType === 'endpoint' ? this.schemaParser.getEndpointFields() :
      contextType === 'backend' ? this.schemaParser.getBackendFields() :
        this.schemaParser.getRootFields();

    return fields
      .filter(field => field.name.toLowerCase().includes(partialField.toLowerCase()))
      .map(field => this.createFieldCompletionItem(field, contextType));
  }

  private createFieldCompletionItem(field: FieldInfo, context: string): vscode.CompletionItem {
    const item = new vscode.CompletionItem(field.name, vscode.CompletionItemKind.Field);

    item.detail = `${field.type}${field.required ? ' (required)' : ''} - KrakenD ${context}`;

    const doc = new vscode.MarkdownString();
    doc.appendMarkdown(`**${field.name}** (KrakenD ${context})\n\n`);
    doc.appendMarkdown(`Type: \`${field.type}\`\n\n`);

    if (field.description) {
      doc.appendMarkdown(`${field.description}\n\n`);
    }

    if (field.default !== undefined) {
      doc.appendMarkdown(`Default: \`${JSON.stringify(field.default)}\`\n\n`);
    }

    if (field.enum && field.enum.length > 0) {
      doc.appendMarkdown(`Valid values: ${field.enum.map(v => `\`${v}\``).join(', ')}\n\n`);
    }

    doc.appendMarkdown(`[KrakenD Documentation](https://www.krakend.io/docs/)`);
    doc.isTrusted = true;

    item.documentation = doc;

    // Set sort text to prioritize KrakenD fields over Sprig functions
    // Use prefix "!" to ensure these appear first
    item.sortText = field.required ? `!0_${field.name}` : `!1_${field.name}`;

    // Add filter text to help with partial matching
    item.filterText = field.name;

    return item;
  }

  private detectEnumContext(
    document: vscode.TextDocument,
    position: vscode.Position
  ): { context: CtxType; field: string } | undefined {
    const line = document.lineAt(position.line).text;
    const textBefore = line.substring(0, position.character);

    // Try to detect patterns like: "method": "{{ $endpoint.method }}"
    // or "encoding": "{{ $backend.encoding }}"
    const jsonFieldMatch = textBefore.match(/"(\w+)":\s*"[^"]*$/);
    if (jsonFieldMatch) {
      const jsonField = jsonFieldMatch[1];

      // Look backwards to find the context
      const context = this.contextAnalyzer.analyzeContext(document, position);

      if (context.type !== 'unknown') {
        return { context: context.type, field: jsonField };
      }
    }

    return undefined;
  }

  private getEnumCompletions(
    contextType: CtxType,
    fieldName: string
  ): vscode.CompletionItem[] {
    const enumValues = this.schemaParser.getEnumValues(contextType, fieldName);

    if (!enumValues || enumValues.length === 0) {
      return [];
    }

    return enumValues.map(value => {
      const item = new vscode.CompletionItem(value, vscode.CompletionItemKind.EnumMember);
      item.detail = `Valid ${fieldName} value`;
      item.insertText = value;
      return item;
    });
  }
}

