import {Configuration}  from './Configuration';
import * as formatUtils from './formatUtils';

const isError = (error: unknown): error is Error => {
  return typeof error === `object` && error !== null;
};

const excludeErrorProperties = ({name, message, stack, ...rest}: PropertyDescriptorMap) => rest;

export type EnhancedErrorField = {
  label: string;
  value: formatUtils.Tuple;
};

type FieldBuilder<T extends string> = T | ((previous: T) => T);

const applyFieldBuilder = <T extends string>(previous: T, builder: FieldBuilder<T> | undefined) => {
  if (typeof builder === `undefined`)
    return previous;

  if (typeof builder === `function`)
    return builder(previous);

  return builder;
};

export type EnhancedErrorBuilder = Partial<{
  name: FieldBuilder<string>;
  summary: FieldBuilder<string>;
  fields: Array<EnhancedErrorField>;
  includeStack: boolean;
}>;

export class EnhancedError extends Error {
  public readonly isEnhancedError = true;

  public summary: string;

  public fields: ReadonlyArray<EnhancedErrorField> = [];

  public includeStack: boolean = true;

  private configuration: Configuration | null = null;

  static isEnhancedError(error: unknown): error is EnhancedError {
    return isError(error) && Object.prototype.hasOwnProperty.call(error, `isEnhancedError`) && (error as EnhancedError).isEnhancedError;
  }

  static prettyField({label, value: [value, formatType]}: EnhancedErrorField, configuration: Configuration) {
    return `${formatUtils.pretty(configuration, label, formatUtils.Type.CODE)}: ${formatUtils.pretty(configuration, value, formatType)}`;
  }

  static jsonField({label, value: [value, formatType]}: EnhancedErrorField) {
    return `${formatUtils.json(label, formatUtils.Type.CODE)}: ${formatUtils.json(value, formatType)}`;
  }

  static enhance(enhancedError: EnhancedError, builder: EnhancedErrorBuilder) {
    enhancedError.name = applyFieldBuilder(enhancedError.name, builder.name);
    enhancedError.summary = applyFieldBuilder(enhancedError.summary, builder.summary);

    if (typeof builder.fields !== `undefined`) {
      for (const field of builder.fields) {
        enhancedError.addField(field);
      }
    }

    if (builder.includeStack === false || (builder.includeStack === undefined && !enhancedError.includeStack)) {
      delete enhancedError.stack;
      enhancedError.includeStack = false;
    } else {
      Error.captureStackTrace(enhancedError, EnhancedError.enhance);
      enhancedError.includeStack = true;
    }
  }

  constructor(error: unknown, builder: EnhancedErrorBuilder = {}, configuration?: Configuration) {
    super();

    if (!isError(error)) {
      this.summary = `Non-error exception ${JSON.stringify(error)} of type ${typeof error}`;
      return;
    }

    Object.defineProperties(this, excludeErrorProperties(Object.getOwnPropertyDescriptors(error)));

    this.name = error.name;
    this.summary = EnhancedError.isEnhancedError(error) ? error.summary : error.message;
    this.includeStack = EnhancedError.isEnhancedError(error) ? error.includeStack : true;
    this.fields = EnhancedError.isEnhancedError(error) ? error.fields : [];

    this.configuration = configuration ?? (EnhancedError.isEnhancedError(error) ? error.configuration : null);

    EnhancedError.enhance(this, builder);
  }

  get message() {
    let message = this.summary;

    for (const field of this.fields)
      // We can't use Configuration.create because of import cycles, so this is the best we can do
      message += `\n    ${this.configuration ? EnhancedError.prettyField(field, this.configuration) : EnhancedError.jsonField(field)}`;

    return message;
  }

  private addField(field: EnhancedErrorField) {
    this.fields = [...this.fields, field];
  }
}
