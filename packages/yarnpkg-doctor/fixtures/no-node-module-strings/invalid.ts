// StringLiteral
var a = "../../node_modules/module-x";
var b = "./node_modules/module-x/node_modules/module-y";
var c = require("../node_modules/module-x");

// TemplateLiteral
var d = `../node_modules/module-x`;

// TemplateExpression
var moduleName = "module-x";
var e = `../node_modules/${moduleName}`;
var f = require(`../node_modules/${moduleName}`) as NodeModule;
