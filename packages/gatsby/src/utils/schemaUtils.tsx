// @ts-expect-error: missing declaration
import deref                                                                                                            from 'json-schema-deref-sync';
import type {JSONSchema7, JSONSchema7Definition, JSONSchema7Type}                                                       from 'json-schema';
import mergeWith                                                                                                        from 'lodash/mergeWith';
import marked                                                                                                           from 'marked';
import React                                                                                                            from 'react';

import {JsonContainer, JsonMain, JsonDictionary, JsonScalar, JsonScalarProperty, JsonObjectProperty, JsonArrayProperty} from '../components/json';
import {SymlContainer, SymlMain, SymlDictionary, SymlScalar, SymlScalarProperty, SymlObjectProperty, SymlArrayProperty} from '../components/syml';

declare module 'json-schema' {
  export interface JSONSchema7 {
    /**
     * Example items for arrays.
     */
    _exampleItems?: Array<unknown>;

    /**
     * Example keys for objects.
     */
    _exampleKeys?: Array<string>;

    /**
     * Used inside the configuration doc generation to set margins of objects.
     */
    _margin?: boolean;

    /**
     * Used inside the configuration doc generation to override properties in the data referenced by a $ref.
     */
    _overrides?: JSONSchema7;
  }
}

export enum SchemaMode {
  Json = `Json`,
  Syml = `Syml`,
}

const SYNTAX_COMPONENTS = {
  CONTAINERS: {JsonContainer, SymlContainer},
  MAINS: {JsonMain, SymlMain},
  SCALARS: {JsonScalar, SymlScalar},
  SCALAR_PROPERTIES: {JsonScalarProperty, SymlScalarProperty},
  OBJECT_PROPERTIES: {JsonObjectProperty, SymlObjectProperty},
  ARRAY_PROPERTIES: {JsonArrayProperty, SymlArrayProperty},
  DICTIONARIES: {JsonDictionary, SymlDictionary},
} as const;

export type SchemaState = {
  mode: SchemaMode;
  pathSegments: Array<string>;
  renderAnchor: boolean;
};

export const getAnchor = (state: SchemaState) => (
  state.renderAnchor ? state.pathSegments.join(`.`) : null
);

export const renderMarkdown = (markdown: string | undefined) => (
  typeof markdown === `string`
    ? <div dangerouslySetInnerHTML={{__html: marked(markdown)}} />
    : null
);

export const renderDescription = (name: string, definition: JSONSchema7) => (
  definition._overrides?.description ?? (
    definition.$ref
      ? renderMarkdown(`See [\`${name}\`](#${name}).`)
      : renderMarkdown(definition.description)
  )
);

export const renderScalar = (placeholder: JSONSchema7Type, state: SchemaState) => {
  const Scalar = SYNTAX_COMPONENTS.SCALARS[`${state.mode}Scalar` as keyof typeof SYNTAX_COMPONENTS.SCALARS];

  return (
    <Scalar placeholder={placeholder} />
  );
};

export const renderScalarProperty = (name: string, definition: JSONSchema7, state: SchemaState) => {
  const description = renderDescription(name, definition);

  const ScalarProperty = SYNTAX_COMPONENTS.SCALAR_PROPERTIES[`${state.mode}ScalarProperty` as keyof typeof SYNTAX_COMPONENTS.SCALAR_PROPERTIES];

  const examples = definition._overrides?.examples ?? definition.examples;

  const example = Array.isArray(examples) && typeof examples[0] !== `undefined`
    ? examples[0]
    : definition.default;

  if (typeof example === `undefined`)
    throw new Error(`Missing examples / default in definition of ${name}`);

  return (
    <ScalarProperty
      name={name}
      anchor={getAnchor(state)}
      placeholder={example}
      description={description}
    />
  );
};

export const renderObjectProperty = (name: string, definition: JSONSchema7, {mode, pathSegments, renderAnchor}: SchemaState) => {
  const exampleKeys = definition._overrides?._exampleKeys ?? definition._exampleKeys;
  if (!Array.isArray(exampleKeys))
    throw new Error(`Missing _exampleKeys in definition of ${name}`);

  const objectProperties = exampleKeys.map(propertyKey => {
    if (typeof propertyKey !== `string`)
      throw new Error(`Assertion failed: Expected the propertyKey to be a string, got "${typeof propertyKey}".`);

    if (typeof definition.properties === `object` && Object.prototype.hasOwnProperty.call(definition.properties, propertyKey)) {
      return renderProperty(propertyKey, definition.properties[propertyKey], {mode, pathSegments: [...pathSegments, propertyKey], renderAnchor: true});
    } else if (typeof definition.patternProperties === `object`) {
      for (const [patternPropertyKey, patternPropertyDefinition] of Object.entries(definition.patternProperties)) {
        if (new RegExp(patternPropertyKey).test(propertyKey)) {
          return renderProperty(propertyKey, patternPropertyDefinition, {mode, pathSegments: [...pathSegments], renderAnchor: false});
        }
      }

      throw new Error(`No patternProperties match "${propertyKey}"`);
    }

    throw new Error(`Unsupported object definition`);
  });

  const description = renderDescription(name, definition);

  const margin = definition._margin ?? (
    mode === SchemaMode.Syml
      ? typeof definition.description !== `undefined`
      : false
  );

  const ObjectProperty = SYNTAX_COMPONENTS.OBJECT_PROPERTIES[`${mode}ObjectProperty` as keyof typeof SYNTAX_COMPONENTS.OBJECT_PROPERTIES];

  return (
    <ObjectProperty
      name={name}
      anchor={getAnchor({mode, pathSegments, renderAnchor})}
      margin={margin}
      description={description}
    >
      {objectProperties}
    </ObjectProperty>
  );
};

export const renderArrayProperty = (name: string, definition: JSONSchema7, state: SchemaState) => {
  const exampleItems = definition._overrides?._exampleItems ?? definition._exampleItems ?? definition.default;
  if (!Array.isArray(exampleItems))
    throw new Error(`Missing _exampleItems / default in definition of ${name}`);

  const arrayProperties = exampleItems.map((arrayProperty, index) => {
    if (typeof arrayProperty === `object` && arrayProperty !== null) {
      const subDefinition = definition.items! as JSONSchema7;
      return <>{Object.keys(arrayProperty).map(name => {
        // @ts-expect-error
        return renderProperty(name, subDefinition.properties[name], {...state, pathSegments: [...state.pathSegments, `${index}`, name]});
      })}</>;
    } else {
      return renderScalar(arrayProperty, state);
    }
  });

  const description = renderDescription(name, definition);

  const ArrayProperty = SYNTAX_COMPONENTS.ARRAY_PROPERTIES[`${state.mode}ArrayProperty` as keyof typeof SYNTAX_COMPONENTS.ARRAY_PROPERTIES];

  return (
    <ArrayProperty
      name={name}
      anchor={getAnchor(state)}
      description={description}
    >
      {arrayProperties}
    </ArrayProperty>
  );
};

export const renderProperty = (name: string, definition: JSONSchema7Definition, state: SchemaState) => {
  if (typeof definition === `boolean`)
    throw new Error(`Assertion failed: Expected the definition not to be a boolean.`);

  if (definition.type === `object`) {
    return renderObjectProperty(name, definition, state);
  } else if (definition.type === `array`) {
    return renderArrayProperty(name, definition, state);
  } else {
    return renderScalarProperty(name, definition, state);
  }
};

export const convertSchemaToConfiguration = (schema: JSONSchema7, {mode}: {mode: SchemaMode}) => {
  // The way refs work:
  //
  // The schema parameter contains properties with refs and
  // overrides that will override the properties in the refs:
  //
  // "npmPublishRegistry": {
  //   "$ref": "#/properties/npmPublishRegistry",
  //   "examples": ["https://registry.yarnpkg.com"]
  // }
  //
  // We then dereference the original schema synchronously using json-schema-deref-sync,
  // which clones the schema (which causes it NOT to mutate the original) and which
  // *replaces* all properties containing refs with the data referenced by the ref.
  // This means that our overrides aren't preserved in the dereferenced schema.
  //
  // Because of this, we merge the original schema with the dereferenced schema, which
  // preserves the `$ref` property for future use and allows us to store the overrides
  // inside an `overrides` property so that we can apply them later.

  const dereferencedSchema: JSONSchema7 = deref(schema);

  const combinedSchema = mergeWith(schema, dereferencedSchema, (value, srcValue): JSONSchema7 | undefined => {
    if (typeof value !== `object` || value === null)
      return undefined;

    if (!Object.prototype.hasOwnProperty.call(value, `$ref`))
      return undefined;

    return {
      $ref: value.$ref,
      ...srcValue,
      _overrides: value,
    };
  });

  if (typeof combinedSchema.description === `undefined`)
    throw new Error(`Assertion failed: Expected the schema to have a description.`);

  if (typeof combinedSchema.properties === `undefined`)
    throw new Error(`Assertion failed: Expected the schema to have properties.`);

  const Container = SYNTAX_COMPONENTS.CONTAINERS[`${mode}Container` as keyof typeof SYNTAX_COMPONENTS.CONTAINERS];
  const Main = SYNTAX_COMPONENTS.MAINS[`${mode}Main` as keyof typeof SYNTAX_COMPONENTS.MAINS];

  return (
    <Container>
      <Main>
        {renderMarkdown(combinedSchema.description)}
      </Main>
      {Object.entries(combinedSchema.properties).map(
        ([name, definition]) => renderProperty(name, definition, {mode, pathSegments: [name], renderAnchor: true}),
      )}
    </Container>
  );
};
