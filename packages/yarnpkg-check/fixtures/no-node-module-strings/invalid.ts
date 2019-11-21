// StringLiteral
var foo1 = "../../node_modules";
var foo2 = "./node_modules/module-x/node_modules";
var foo3 = "node_modules/module-x";
var foo4 = "node_modules";
var foo5 = require("../node_modules/module-x");

// TemplateLiteral
var foo6 = `../node_modules/lodash`;

// TemplateExpression
var moduleName = "lodash";
var foo7 = `../node_modules/${moduleName}`;
var module = require(`../node_modules/${moduleName}`) as NodeModule;
