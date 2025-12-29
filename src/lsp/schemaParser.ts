import * as fs from 'fs';
import { CtxType } from './contextAnalyzer';

export interface SchemaProperty {
  type?: string | string[];
  description?: string;
  title?: string;
  default?: any;
  enum?: string[];
  properties?: { [key: string]: SchemaProperty };
  items?: SchemaProperty;
  $ref?: string;
  required?: string[];
}

export interface KrakenDSchema {
  properties: { [key: string]: SchemaProperty };
  definitions: { [key: string]: any };
}

export interface FieldInfo {
  name: string;
  type: string;
  description: string;
  default?: any;
  enum?: string[];
  required: boolean;
}

export class SchemaParser {
  private schema: KrakenDSchema | null = null;
  private endpointFields: Map<string, FieldInfo> = new Map();
  private backendFields: Map<string, FieldInfo> = new Map();
  private rootFields: Map<string, FieldInfo> = new Map();

  // Field mappings for custom prefixed fields
  private fieldMappings = new Map<string, string>([
    ['output_encoding', 'endpoint_output_encoding'],
    ['url', 'endpoint_url'],
    ['input_headers', 'endpoint_input_headers'],
    ['input_query_strings', 'endpoint_input_query_strings'],
    ['extra_config', 'endpoint_extra_config'],
    ['encoding', 'backend_encoding'],
    ['method', 'backend_method'],
    ['url_pattern', 'backend_url_pattern'],
    ['settings', 'backend_settings'],
  ]);

  constructor(private schemaPath: string) {
    this.loadSchema();
  }

  private loadSchema(): void {
    try {
      const schemaContent = fs.readFileSync(this.schemaPath, 'utf-8');
      this.schema = JSON.parse(schemaContent);
      this.parseSchema();
    } catch (error) {
      console.error('Failed to load KrakenD schema:', error);
    }
  }

  private parseSchema(): void {
    if (!this.schema) { return; }

    console.log('[SchemaParser] Starting schema parse...');
    console.log('[SchemaParser] Root properties:', Object.keys(this.schema.properties || {}).length);
    console.log('[SchemaParser] Definitions:', Object.keys(this.schema.definitions || {}).length);

    // Parse root-level fields
    this.parseFields(this.schema.properties, this.rootFields, []);
    console.log('[SchemaParser] Parsed root fields:', this.rootFields.size);

    // Parse endpoint fields
    const endpointRef = this.schema.properties.endpoints?.items?.$ref;
    console.log('[SchemaParser] Endpoint ref:', endpointRef);

    if (endpointRef) {
      const endpointDef = this.resolveRef(endpointRef);
      console.log('[SchemaParser] Endpoint def found:', !!endpointDef);

      if (endpointDef?.properties) {
        this.parseFields(endpointDef.properties, this.endpointFields, endpointDef.required || []);
        console.log('[SchemaParser] Parsed endpoint fields:', this.endpointFields.size);

        // Parse backend fields (from endpoint.backend array)
        const backendRef = endpointDef.properties.backend?.items?.$ref;
        console.log('[SchemaParser] Backend ref:', backendRef);

        if (backendRef) {
          const backendDef = this.resolveRef(backendRef);
          console.log('[SchemaParser] Backend def found:', !!backendDef);

          if (backendDef?.properties) {
            this.parseFields(backendDef.properties, this.backendFields, backendDef.required || []);
            console.log('[SchemaParser] Parsed backend fields:', this.backendFields.size);

            // Log specific fields for debugging
            console.log('[SchemaParser] Backend has is_collection:', this.backendFields.has('is_collection'));
            console.log('[SchemaParser] Backend has url_pattern:', this.backendFields.has('url_pattern'));
          }
        }
      }
    }

    console.log('[SchemaParser] Schema parse complete');
  }

  private parseFields(
    properties: { [key: string]: SchemaProperty },
    targetMap: Map<string, FieldInfo>,
    required: string[]
  ): void {
    for (const [key, prop] of Object.entries(properties)) {
      const field: FieldInfo = {
        name: key,
        type: this.getTypeString(prop),
        description: prop.description || prop.title || '',
        default: prop.default,
        enum: prop.enum,
        required: required.includes(key),
      };
      targetMap.set(key, field);
    }
  }

  private getTypeString(prop: SchemaProperty): string {
    if (prop.$ref) {
      return 'object';
    }
    if (Array.isArray(prop.type)) {
      return prop.type.join(' | ');
    }
    if (prop.type === 'array' && prop.items) {
      const itemType = this.getTypeString(prop.items);
      return `${itemType}[]`;
    }
    return prop.type || 'any';
  }

  private resolveRef(ref: string): any {
    if (!this.schema) { return null; }

    // Handle internal references like "#/definitions/endpoint.json" or "#/definitions/https%3A~1~1www.krakend.io~1schema~1v2.12~1endpoint.json"
    let refPath = ref.replace('#/definitions/', '');

    // Try direct lookup first
    if (this.schema.definitions[refPath]) {
      return this.schema.definitions[refPath];
    }

    // If not found, try URL-encoding the path (KrakenD schema uses URL-encoded keys)
    // Convert / to ~1 and : to %3A
    const encodedPath = refPath.replace(/\//g, '~1').replace(/:/g, '%3A');
    if (this.schema.definitions[encodedPath]) {
      return this.schema.definitions[encodedPath];
    }

    // Also try decoding if the ref is already encoded
    try {
      const decodedPath = decodeURIComponent(refPath.replace(/~1/g, '/').replace(/%3A/g, ':'));
      if (this.schema.definitions[decodedPath]) {
        return this.schema.definitions[decodedPath];
      }
    } catch (e) {
      // Ignore decode errors
    }

    console.log('[SchemaParser] Could not resolve ref:', ref);
    console.log('[SchemaParser] Tried paths:', refPath, encodedPath);
    return null;
  }

  public getEndpointFields(): FieldInfo[] {
    const fields: FieldInfo[] = [];

    // Add original fields
    this.endpointFields.forEach(field => fields.push(field));

    // Add custom prefixed fields
    this.endpointFields.forEach(field => {
      const mapping = this.fieldMappings.get(field.name);
      if (mapping) {
        fields.push({
          ...field,
          name: mapping,
          description: `${field.description} (Custom field: maps to ${field.name})`,
        });
      }
    });

    return fields;
  }

  public getBackendFields(): FieldInfo[] {
    const fields: FieldInfo[] = [];

    // Add original fields
    this.backendFields.forEach(field => fields.push(field));

    // Add custom prefixed fields
    this.backendFields.forEach(field => {
      const mapping = this.fieldMappings.get(field.name);
      if (mapping) {
        fields.push({
          ...field,
          name: mapping,
          description: `${field.description} (Custom field: maps to ${field.name})`,
        });
      }
    });

    return fields;
  }

  public getRootFields(): FieldInfo[] {
    return Array.from(this.rootFields.values());
  }

  public getFieldInfo(context: CtxType, fieldName: string): FieldInfo | undefined {
    const map = context === 'endpoint' ? this.endpointFields :
      context === 'backend' ? this.backendFields :
        this.rootFields;

    // Check original field name
    let field = map.get(fieldName);
    if (field) { return field; }

    // Check if it's a prefixed field and find original
    for (const [original, prefixed] of this.fieldMappings.entries()) {
      if (prefixed === fieldName) {
        field = map.get(original);
        if (field) {
          return {
            ...field,
            name: prefixed,
            description: `${field.description} (Custom field: maps to ${original})`,
          };
        }
      }
    }

    return undefined;
  }

  public isValidField(context: CtxType, fieldName: string): boolean {
    return this.getFieldInfo(context, fieldName) !== undefined;
  }

  public getEnumValues(context: CtxType, fieldName: string): string[] | undefined {
    const field = this.getFieldInfo(context, fieldName);
    return field?.enum;
  }
}

