import {Configuration, FormatType} from '@yarnpkg/core';
import * as ts                     from 'typescript';

export enum CallType {
  REQUIRE,
  RESOLVE,
}

export function prettyNodeLocation(configuration: Configuration, node: ts.Node) {
  const {fileName} = node.getSourceFile();
  const {line, character} = ts.getLineAndCharacterOfPosition(
    node.getSourceFile(),
    node.getStart(),
  );

  return [
    `${configuration.format(fileName, FormatType.PATH)}`,
    `${configuration.format(`${line + 1}`, FormatType.NUMBER)}`,
    `${configuration.format(`${character + 1}`, FormatType.NUMBER)}`,
  ].join(`:`);
}

export function getCallType(call: ts.CallExpression) {
  switch (call.expression.kind) {
    // require(...)
    case ts.SyntaxKind.Identifier: {
      const ident = call.expression as ts.Identifier;
      if (ident.text !== `require`)
        return null;

      return CallType.REQUIRE;
    } break;

    // require.resolve(...)
    case ts.SyntaxKind.PropertyAccessExpression: {
      const access = call.expression as ts.PropertyAccessExpression;
      if (!ts.isIdentifier(access.expression))
        return null;

      const ident = access.expression as ts.Identifier;
      if (ident.text !== `require`)
        return null;

      if (access.name.text !== `resolve`)
        return null;

      return CallType.RESOLVE;
    } break;

    default: {
      return null;
    } break;
  }
}

export function extractStaticString(node: ts.Expression) {
  switch (node.kind) {
    case ts.SyntaxKind.NoSubstitutionTemplateLiteral: {
      const literal = node as ts.NoSubstitutionTemplateLiteral;
      return literal.text;
    } break;

    case ts.SyntaxKind.StringLiteral: {
      const literal = node as ts.StringLiteral;
      return literal.text;
    } break;

    default: {
      return null;
    } break;
  }
}

export function extractStaticName(node: ts.PropertyName) {
  switch (node.kind) {
    case ts.SyntaxKind.Identifier: {
      const identifier = node as ts.Identifier;
      return identifier.text;
    } break;

    case ts.SyntaxKind.StringLiteral: {
      const literal = node as ts.StringLiteral;
      return literal.text;
    } break;

    default: {
      return null;
    } break;
  }
}
