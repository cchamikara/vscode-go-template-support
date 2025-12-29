import * as vscode from 'vscode';
import { SchemaParser } from './schemaParser';
import { ContextAnalyzer } from './contextAnalyzer';

export class KrakenDHoverProvider implements vscode.HoverProvider {
  constructor(
    private schemaParser: SchemaParser,
    private contextAnalyzer: ContextAnalyzer
  ) {}

  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Hover> {
    // Get the word at cursor position
    const range = this.contextAnalyzer.getFieldWordRange(document, position);
    if (!range) {
      return undefined;
    }

    const word = document.getText(range);

    // Check if this is a field reference
    const context = this.contextAnalyzer.analyzeContext(document, position);
    
    if (context.type === 'unknown') {
      return undefined;
    }

    // Try to get field info from schema
    const fieldInfo = this.schemaParser.getFieldInfo(context.type, word);
    
    if (!fieldInfo) {
      return undefined;
    }

    const markdown = new vscode.MarkdownString();
    markdown.isTrusted = true;

    // Title
    markdown.appendMarkdown(`### ${fieldInfo.name}\n\n`);
    
    // Context badge
    markdown.appendMarkdown(`\`${context.type}\` field`);
    if (fieldInfo.required) {
      markdown.appendMarkdown(` • **Required**`);
    }
    markdown.appendMarkdown(`\n\n---\n\n`);

    // Type
    markdown.appendMarkdown(`**Type:** \`${fieldInfo.type}\`\n\n`);

    // Default value
    if (fieldInfo.default !== undefined) {
      markdown.appendMarkdown(`**Default:** \`${JSON.stringify(fieldInfo.default)}\`\n\n`);
    }

    // Description
    if (fieldInfo.description) {
      markdown.appendMarkdown(`${fieldInfo.description}\n\n`);
    }

    // Enum values
    if (fieldInfo.enum && fieldInfo.enum.length > 0) {
      markdown.appendMarkdown(`**Valid values:**\n\n`);
      fieldInfo.enum.forEach(value => {
        markdown.appendMarkdown(`- \`${value}\`\n`);
      });
      markdown.appendMarkdown(`\n`);
    }

    // Documentation link
    markdown.appendMarkdown(`---\n\n`);
    markdown.appendMarkdown(`[📚 KrakenD Documentation](https://www.krakend.io/docs/)\n\n`);
    
    // Add specific doc links based on context
    if (context.type === 'endpoint') {
      markdown.appendMarkdown(`[Endpoint Configuration](https://www.krakend.io/docs/endpoints/)\n\n`);
    } else if (context.type === 'backend') {
      markdown.appendMarkdown(`[Backend Configuration](https://www.krakend.io/docs/backends/)\n\n`);
    }

    markdown.appendMarkdown(`[Template Syntax](https://www.krakend.io/docs/configuration/templates/)`);

    return new vscode.Hover(markdown, range);
  }
}

