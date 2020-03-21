// @ts-check

import jref               from 'json-ref-lite';
import {cloneDeep, merge} from 'lodash';
import marked             from 'marked';

import React              from 'react';

import {
  JsonContainer,
  JsonMain,
  JsonScalar,
  JsonScalarProperty,
  JsonObjectProperty,
  JsonArrayProperty,
} from '../components/json';

import {
  SymlContainer,
  SymlMain,
  SymlScalar,
  SymlScalarProperty,
  SymlObjectProperty,
  SymlArrayProperty,
} from '../components/syml';


const dynamicComponents = {
  containers: {JsonContainer, SymlContainer},
  mains: {JsonMain, SymlMain},
  scalars: {JsonScalar, SymlScalar},
  scalarProperties: {JsonScalarProperty, SymlScalarProperty},
  objectProperties: {JsonObjectProperty, SymlObjectProperty},
  arrayProperties: {JsonArrayProperty, SymlArrayProperty},
};

export const defaultCommentConfiguration = {
  /** @type {boolean | undefined} */
  margin: undefined,
  /** @type {string | undefined} */
  anchor: undefined,
  overrides: {
    /** @type {unknown} */
    default: undefined,
    /** @type {string | undefined} */
    description: ``,
  },
};

/**
 * @param {string} [markdown]
 * @returns {JSX.Element | undefined}
 */
export const renderHtmlFromMarkdown = (markdown) => (
  markdown
    ? <div dangerouslySetInnerHTML={{__html: marked(markdown)}} />
    : undefined
);

/**
 * @param {string} comment
 * @returns {typeof defaultCommentConfiguration | {}}
 */
export const parseCommentAsJson = (comment) => {
  try {
    return JSON.parse(comment);
  } catch {
    return {};
  }
};

/**
 * @param {string | undefined} rawComment
 * @param {keyof typeof defaultCommentConfiguration} key
 * @returns {typeof defaultCommentConfiguration[key]}
 */
export const getCommentConfigurationKey = (rawComment, key) => {
  const parsedComment = rawComment && parseCommentAsJson(rawComment);
  const property = typeof parsedComment === `object` && Object.prototype.hasOwnProperty.call(parsedComment, key)
    ? parsedComment[key]
    : undefined;
  return typeof property !== `undefined`
    ? property
    : defaultCommentConfiguration[key];
};

/**
 * @template T
 * @param {T} overrides
 * @param {keyof T} key
 */
export const getOverriddenProperty = (overrides, key) => (
  typeof overrides === `object`
    && Object.prototype.hasOwnProperty.call(overrides, key)
    && overrides[key]
);

/**
 * @param {import('json-schema').JSONSchema7Type} placeholder
 * @param {`Json` | `Syml`} mode
 * @returns {JSX.Element}
 */
export const renderScalar = (placeholder, mode) => {
  const Scalar = dynamicComponents.scalars[`${mode}Scalar`];

  return (
    <Scalar
      placeholder={placeholder}
    />
  );
};

/**
 * @param {[string, import('json-schema').JSONSchema7]} entry
 * @param {`Json` | `Syml`} mode
 * @param {boolean} isNested
 * @returns {JSX.Element}
 */
export const renderScalarProperty = (entry, mode, isNested) => {
  const overrides = /** @type {defaultCommentConfiguration['overrides']} */ (getCommentConfigurationKey(entry[1].$comment, `overrides`));
  const overriddenDefault = getOverriddenProperty(overrides, `default`);
  const overriddenDescription = getOverriddenProperty(overrides, `description`);

  const description = entry[1].$ref
    ? renderHtmlFromMarkdown(`See [\`${entry[0]}\`](#${entry[0]}).`)
    : renderHtmlFromMarkdown(entry[1].description);

  const ScalarProperty = dynamicComponents.scalarProperties[`${mode}ScalarProperty`];

  return (
    <ScalarProperty
      name={entry[0]}
      anchor={
        entry[1].$ref || isNested
          ? getCommentConfigurationKey(entry[1].$comment, `anchor`)
          : undefined
      }
      placeholder={
        entry[1].$ref && overriddenDefault
          ? overriddenDefault
          : entry[1].default
      }
      description={
        entry[1].$ref && overriddenDescription
          ? renderHtmlFromMarkdown(/** @type {string}*/ (overriddenDescription))
          : description
      }
    />
  );
};

/**
 * @param {[string, import('json-schema').JSONSchema7]} entry
 * @param {`Json` | `Syml`} mode
 * @returns {JSX.Element}
 */
export const renderObjectProperty = (entry, mode) => {
  /** @type {JSX.Element[]} */
  const objectProperties = [];
  if (typeof entry[1].default === `object`) {
    Object.keys(entry[1].default).map((propertyKey) => {
      if (entry[1].properties && Object.prototype.hasOwnProperty.call(entry[1].properties, propertyKey)) {
        objectProperties.push(renderProperty([propertyKey, entry[1].properties[propertyKey]], mode, true));
      } else if (entry[1].patternProperties) {
        for (const patternPropertyKey of Object.keys(entry[1].patternProperties)) {
          if (new RegExp(patternPropertyKey).test(propertyKey)) {
            objectProperties.push(renderProperty([propertyKey, entry[1].patternProperties[patternPropertyKey]], mode, true));
            break;
          }
        }
      }
    });
  }
  const overrides = /** @type {defaultCommentConfiguration['overrides']} */ (getCommentConfigurationKey(entry[1].$comment, `overrides`));
  const overriddenDescription = getOverriddenProperty(overrides, `description`);

  const description = entry[1].$ref
    ? renderHtmlFromMarkdown(`See [\`${entry[0]}\`](#${entry[0]}).`)
    : renderHtmlFromMarkdown(entry[1].description);

  const margin = getCommentConfigurationKey(entry[1].$comment, `margin`);

  const defaultMargin = (mode === `Syml`) ? !!entry[1].description : false;

  const ObjectProperty = dynamicComponents.objectProperties[`${mode}ObjectProperty`];

  return (
    <ObjectProperty
      name={entry[0]}
      margin={
        typeof margin !== `undefined`
          ? margin
          : defaultMargin
      }
      description={
        entry[1].$ref && overriddenDescription
          ? renderHtmlFromMarkdown(/** @type {string}*/ (overriddenDescription))
          : description
      }
    >
      {objectProperties}
    </ObjectProperty>
  );
};


/**
 * @param {[string, import('json-schema').JSONSchema7]} entry
 * @param {`Json` | `Syml`} mode
 * @returns {JSX.Element}
 */
export const renderArrayProperty = (entry, mode) => {
  /** @type {JSX.Element[]} */
  const arrayProperties = [];
  if (Array.isArray(entry[1].default)) {
    entry[1].default.forEach((arrayProperty) => {
      arrayProperties.push(renderScalar(arrayProperty, mode));
    });
  }

  const overrides = /** @type {defaultCommentConfiguration['overrides']} */ (getCommentConfigurationKey(entry[1].$comment, `overrides`));
  const overriddenDescription = getOverriddenProperty(overrides, `description`);

  const description = entry[1].$ref
    ? renderHtmlFromMarkdown(`See [\`${entry[0]}\`](#${entry[0]}).`)
    : renderHtmlFromMarkdown(entry[1].description);


  const ArrayProperty = dynamicComponents.arrayProperties[`${mode}ArrayProperty`];

  return (
    <ArrayProperty
      name={entry[0]}
      description={
        entry[1].$ref && overriddenDescription
          ? renderHtmlFromMarkdown(/** @type {string}*/ (overriddenDescription))
          : description
      }
    >
      {arrayProperties}
    </ArrayProperty>
  );
};

/**
 * @param {[string, import('json-schema').JSONSchema7Definition]} entry
 * @param {`Json` | `Syml`} mode
 * @param {boolean} isNested
 * @returns {JSX.Element}
 */
export const renderProperty = (entry, mode, isNested) => {
  if (typeof entry[1] === `boolean`)
    return;

  if (entry[1].type === `object`) {
    return renderObjectProperty(/** @type {[string, import('json-schema').JSONSchema7]} */ (entry), mode);
  } else if (entry[1].type === `array`) {
    return renderArrayProperty(/** @type {[string, import('json-schema').JSONSchema7]} */ (entry), mode);
  } else {
    return renderScalarProperty(/** @type {[string, import('json-schema').JSONSchema7]} */ (entry), mode, isNested);
  }
};

/**
 * @param {import('json-schema').JSONSchema7} schema
 * @param {`Json` | `Syml`} mode
 * @returns {JSX.Element}
 */
export const convertSchemaToConfiguration = (schema, mode) => {
  /** @type {import('json-schema').JSONSchema7} */
  const dereferencedSchema = jref.resolve(
    // Required because json-ref-lite mutates its argument
    cloneDeep(schema)
  );
  // Recursive merge is needed
  const combinedSchema = merge(schema, dereferencedSchema);

  const Container = dynamicComponents.containers[`${mode}Container`];
  const Main = dynamicComponents.mains[`${mode}Main`];

  return (
    <Container>
      <Main>
        {renderHtmlFromMarkdown(combinedSchema.description)}
      </Main>
      {Object.entries(combinedSchema.properties).map((entry) => renderProperty(entry, mode, false))}
    </Container>
  );
};
