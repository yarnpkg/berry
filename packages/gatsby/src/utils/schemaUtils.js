// @ts-check

import jref                                                                                             from 'json-ref-lite';
import {cloneDeep, merge}                                                                               from 'lodash';
import marked                                                                                           from 'marked';

import React                                                                                            from 'react';

import {SymlContainer, SymlMain, SymlScalar, SymlScalarProperty, SymlObjectProperty, SymlArrayProperty} from '../components/syml';


export const defaultCommentConfiguration = {
  /** @type {boolean | undefined} */
  margin: undefined,
  /** @type {string | undefined} */
  anchor: undefined,
  overrides: {
    /** @type {unknown} */
    default: undefined,
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
 * @returns {JSX.Element}
 */
export const renderScalar = (placeholder) => (
  <SymlScalar
    placeholder={placeholder}
  />
);

/**
 * @param {[string, import('json-schema').JSONSchema7]} entry
 * @returns {JSX.Element}
 */
export const renderScalarProperty = (entry) => {
  const overrides = /** @type {defaultCommentConfiguration['overrides']} */ (getCommentConfigurationKey(entry[1].$comment, `overrides`));
  const overriddenDefault = getOverriddenProperty(overrides, `default`);
  return (
    <SymlScalarProperty
      name={entry[0]}
      anchor={
        entry[1].$ref
          ? getCommentConfigurationKey(entry[1].$comment, `anchor`)
          : undefined
      }
      placeholder={
        entry[1].$ref && overriddenDefault
          ? overriddenDefault
          : entry[1].default
      }
      description={
        entry[1].$ref
          ? renderHtmlFromMarkdown(`See [\`${entry[0]}\`](#${entry[0]}).`)
          : renderHtmlFromMarkdown(entry[1].description)
      }
    />
  );
};

/**
 * @param {[string, import('json-schema').JSONSchema7]} entry
 * @returns {JSX.Element}
 */
export const renderObjectProperty = (entry) => {
  /** @type {JSX.Element[]} */
  const objectProperties = [];
  if (typeof entry[1].default === `object`) {
    Object.keys(entry[1].default).map((propertyKey) => {
      if (entry[1].properties && Object.prototype.hasOwnProperty.call(entry[1].properties, propertyKey)) {
        objectProperties.push(renderProperty([propertyKey, entry[1].properties[propertyKey]]));
      } else if (entry[1].patternProperties) {
        Object.keys(entry[1].patternProperties).forEach((patternPropertyKey) => {
          if (new RegExp(patternPropertyKey).test(propertyKey)) {
            objectProperties.push(renderProperty([propertyKey, entry[1].patternProperties[patternPropertyKey]]));
          }
        });
      }
    });
  }
  const margin = getCommentConfigurationKey(entry[1].$comment, `margin`);
  return (
    <SymlObjectProperty
      name={entry[0]}
      margin={
        typeof margin !== `undefined`
          ? margin
          : !!entry[1].description
      }
      description={
        entry[1].$ref
          ? renderHtmlFromMarkdown(`See [\`${entry[0]}\`](#${entry[0]}).`)
          : renderHtmlFromMarkdown(entry[1].description)
      }
    >
      {objectProperties}
    </SymlObjectProperty>
  );
};


/**
 * @param {[string, import('json-schema').JSONSchema7]} entry
 * @returns {JSX.Element}
 */
export const renderArrayProperty = (entry) => {
  /** @type {JSX.Element[]} */
  const arrayProperties = [];
  if (Array.isArray(entry[1].default)) {
    entry[1].default.forEach((arrayProperty) => {
      arrayProperties.push(renderScalar(arrayProperty));
    });
  }
  return (
    <SymlArrayProperty
      name={entry[0]}
      description={
        entry[1].$ref
          ? renderHtmlFromMarkdown(`See [\`${entry[0]}\`](#${entry[0]}).`)
          : renderHtmlFromMarkdown(entry[1].description)
      }
    >
      {arrayProperties}
    </SymlArrayProperty>
  );
};

/**
 * @param {[string, import('json-schema').JSONSchema7Definition]} entry
 * @returns {JSX.Element}
 */
export const renderProperty = (entry) => {
  if (typeof entry[1] === `boolean`)
    return;

  if (entry[1].type === `object`) {
    return renderObjectProperty(/** @type {[string, import('json-schema').JSONSchema7]} */ (entry));
  } else if (entry[1].type === `array`) {
    return renderArrayProperty(/** @type {[string, import('json-schema').JSONSchema7]} */ (entry));
  } else {
    return renderScalarProperty(/** @type {[string, import('json-schema').JSONSchema7]} */ (entry));
  }
};

/**
 * @param {import('json-schema').JSONSchema7} schema
 * @returns {JSX.Element}
 */
export const convertSchemaToConfiguration = (schema) => {
  /** @type {import('json-schema').JSONSchema7} */
  const dereferencedSchema = jref.resolve(
    // Required because json-ref-lite mutates its argument
    cloneDeep(schema)
  );
  // Recursive merge is needed
  const combinedSchema = merge(schema, dereferencedSchema);
  return (
    <SymlContainer>
      <SymlMain>
        {renderHtmlFromMarkdown(combinedSchema.description)}
      </SymlMain>
      {Object.entries(combinedSchema.properties).map((entry) => renderProperty(entry))}
    </SymlContainer>
  );
};
