import {NodeElement} from './NodeElement';
import {NodeText}    from './NodeText';
import {Node}        from './Node';

/**
 * This symbol is meant to be used when a property must be inherited from its parent node styles.
 */

export const INHERITED_STYLE_PROPERTY = Symbol(`INHERITED_STYLE_PROPERTY`);

/**
 * Each style property listed in this map will see its value be converted to a better suited internal representation before being stored in the style manager.
 */

export type StyleConverter = (value: any) => any;

export const STYLE_CONVERTERS: Map<string, StyleConverter> = new Map([
  [ `zIndex`, (value: any) => {
    if (value === null) {
      return null;
    } else {
      return Number(value);
    }
  }],
]);

/**
 * The properties listed in this set will by default be inherited from their parents if possible.
 * If they have no such parent, they will instead default to the value specified in the DEFAULT_COMPUTED_STYLE map.
 */

export const DEFAULT_INHERITED_STYLES: Set<string> = new Set([
  `borderBackColor`,
  `borderFrontColor`,

  `backgroundBackColor`,
  `backgroundFrontColor`,

  `contentBackColor`,
  `contentFrontColor`,

  `background`,
]);

/**
 * If an element is missing a property, the value used will come from this map.
 * Note that the values here must be precomputed (they must have been transformed through the STYLE_CONVERTERS functions if applicable).
 */

export const DEFAULT_COMPUTED_STYLES: Map<string, any> = new Map([
  [`display`, `flex`],
  [`position`, `relative`],

  [`left`, undefined],
  [`right`, undefined],
  [`top`, undefined],
  [`bottom`, undefined],

  [`zIndex`, undefined],

  [`flexDirection`, `column`],
  [`flexWrap`, `no-wrap`],

  [`alignContent`, `stretch`],
  [`alignSelf`, `auto`],
  [`alignItems`, `stretch`],

  [`justifyContent`, `flex-start`],

  [`flexGrow`, 0],
  [`flexShrink`, 1],
  [`flexBasis`, undefined],

  [`width`, undefined],
  [`height`, undefined],

  [`minWidth`, undefined],
  [`minHeight`, undefined],

  [`maxWidth`, undefined],
  [`maxHeight`, undefined],

  [`marginLeft`, undefined],
  [`marginRight`, undefined],
  [`marginTop`, undefined],
  [`marginBottom`, undefined],

  [`borderLeft`, undefined],
  [`borderRight`, undefined],
  [`borderTop`, undefined],
  [`borderBottom`, undefined],

  [`borderTopLeft`, `+`],
  [`borderTopRight`, `+`],
  [`borderBottomLeft`, `+`],
  [`borderBottomRight`, `+`],

  [`paddingLeft`, undefined],
  [`paddingRight`, undefined],
  [`paddingTop`, undefined],
  [`paddingBottom`, undefined],

  [`borderBackColor`, undefined],
  [`borderFrontColor`, undefined],

  [`backgroundBackColor`, undefined],
  [`backgroundFrontColor`, undefined],

  [`backColor`, undefined],
  [`frontColor`, undefined],

  [`background`, ` `],
] as Array<[string, any]>);

/**
 * The functions from this map will be called after the associated style property was modified.
 */

export type StyleTrigger = (node: Node, value: any) => void;

export const STYLE_TRIGGERS: Map<string, StyleTrigger> = new Map([
  [`display`, elementsOnly((element: NodeElement, value: any) => {
    element.yoga.display = getYogaEnum(element.env.yoga, `display`, value);
    element.markDirtyLayout();
  })],

  [`position`, elementsOnly((element: NodeElement, value: any) => {
    element.yoga.position = getYogaEnum(element.env.yoga, `position`, value);
    element.markDirtyLayout();
  })],

  [`left`, elementsOnly((element: NodeElement, value: any) => {
    element.yoga.left = getYogaUnit(element.env.yoga, value);
    element.markDirtyLayout();
  })],

  [`right`, elementsOnly((element: NodeElement, value: any) => {
    element.yoga.right = getYogaUnit(element.env.yoga, value);
    element.markDirtyLayout();
  })],

  [`top`, elementsOnly((element: NodeElement, value: any) => {
    element.yoga.top = getYogaUnit(element.env.yoga, value);
    element.markDirtyLayout();
  })],

  [`bottom`, elementsOnly((element: NodeElement, value: any) => {
    element.yoga.bottom = getYogaUnit(element.env.yoga, value);
    element.markDirtyLayout();
  })],

  [`zIndex`, elementsOnly((element: NodeElement, value: any) => {
    element.markDirtyRender();
  })],

  [`flexDirection`, elementsOnly((element: NodeElement, value: any) => {
    element.yoga.flexDirection = getYogaEnum(element.env.yoga, `flexDirection`, value);
    element.markDirtyLayout();
  })],

  [`flexWrap`, elementsOnly((element: NodeElement, value: any) => {
    element.yoga.flexWrap = getYogaEnum(element.env.yoga, `wrap`, value);
    element.markDirtyLayout();
  })],

  [`alignContent`, elementsOnly((element: NodeElement, value: any) => {
    element.yoga.alignContent = getYogaEnum(element.env.yoga, `align`, value);
    element.markDirtyLayout();
  })],

  [`alignSelf`, elementsOnly((element: NodeElement, value: any) => {
    element.yoga.alignSelf = getYogaEnum(element.env.yoga, `align`, value);
    element.markDirtyLayout();
  })],

  [`alignItems`, elementsOnly((element: NodeElement, value: any) => {
    element.yoga.alignItems = getYogaEnum(element.env.yoga, `align`, value);
    element.markDirtyLayout();
  })],

  [`justifyContent`, elementsOnly((element: NodeElement, value: any) => {
    element.yoga.justifyContent = getYogaEnum(element.env.yoga, `justify`, value);
    element.markDirtyLayout();
  })],

  [`flexGrow`, elementsOnly((element: NodeElement, value: any) => {
    element.yoga.flexGrow = value;
    element.markDirtyLayout();
  })],

  [`flexShrink`, elementsOnly((element: NodeElement, value: any) => {
    element.yoga.flexShrink = value;
    element.markDirtyLayout();
  })],

  [`flexBasis`, elementsOnly((element: NodeElement, value: any) => {
    element.yoga.flexBasis = getYogaUnit(element.env.yoga, value);
    element.markDirtyLayout();
  })],

  [`width`, elementsOnly((element: NodeElement, value: any) => {
    element.yoga.width = getYogaUnit(element.env.yoga, value);
    element.markDirtyLayout();
  })],

  [`height`, elementsOnly((element: NodeElement, value: any) => {
    element.yoga.height = getYogaUnit(element.env.yoga, value);
    element.markDirtyLayout();
  })],

  [`minWidth`, elementsOnly((element: NodeElement, value: any) => {
    element.yoga.minWidth = getYogaUnit(element.env.yoga, value);
    element.markDirtyLayout();
  })],

  [`minHeight`, elementsOnly((element: NodeElement, value: any) => {
    element.yoga.minHeight = getYogaUnit(element.env.yoga, value);
    element.markDirtyLayout();
  })],

  [`maxWidth`, elementsOnly((element: NodeElement, value: any) => {
    element.yoga.maxWidth = getYogaUnit(element.env.yoga, value);
    element.markDirtyLayout();
  })],

  [`maxHeight`, elementsOnly((element: NodeElement, value: any) => {
    element.yoga.maxHeight = getYogaUnit(element.env.yoga, value);
    element.markDirtyLayout();
  })],

  [`marginLeft`, elementsOnly((element: NodeElement, value: any) => {
    element.yoga.marginLeft = getYogaUnit(element.env.yoga, value);
    element.markDirtyLayout();
  })],

  [`marginRight`, elementsOnly((element: NodeElement, value: any) => {
    element.yoga.marginRight = getYogaUnit(element.env.yoga, value);
    element.markDirtyLayout();
  })],

  [`marginTop`, elementsOnly((element: NodeElement, value: any) => {
    element.yoga.marginTop = getYogaUnit(element.env.yoga, value);
    element.markDirtyLayout();
  })],

  [`marginBottom`, elementsOnly((element: NodeElement, value: any) => {
    element.yoga.marginBottom = getYogaUnit(element.env.yoga, value);
    element.markDirtyLayout();
  })],

  [`borderLeft`, elementsOnly((element: NodeElement, value: any) => {
    element.yoga.borderLeft = value ? 1 : 0;
    element.markDirtyLayout();
  })],

  [`borderRight`, elementsOnly((element: NodeElement, value: any) => {
    element.yoga.borderRight = value ? 1 : 0;
    element.markDirtyLayout();
  })],

  [`borderTop`, elementsOnly((element: NodeElement, value: any) => {
    element.yoga.borderTop = value ? 1 : 0;
    element.markDirtyLayout();
  })],

  [`borderBottom`, elementsOnly((element: NodeElement, value: any) => {
    element.yoga.borderBottom = value ? 1 : 0;
    element.markDirtyLayout();
  })],

  [`paddingLeft`, elementsOnly((element: NodeElement, value: any) => {
    element.yoga.paddingLeft = getYogaUnit(element.env.yoga, value);
    element.markDirtyLayout();
  })],

  [`paddingRight`, elementsOnly((element: NodeElement, value: any) => {
    element.yoga.paddingRight = getYogaUnit(element.env.yoga, value);
    element.markDirtyLayout();
  })],

  [`paddingTop`, elementsOnly((element: NodeElement, value: any) => {
    element.yoga.paddingTop = getYogaUnit(element.env.yoga, value);
    element.markDirtyLayout();
  })],

  [`paddingBottom`, elementsOnly((element: NodeElement, value: any) => {
    element.yoga.paddingBottom = getYogaUnit(element.env.yoga, value);
    element.markDirtyLayout();
  })],

  [`borderBackColor`, (node: Node, value: any) => {
    node.markDirtyRender();
  }],

  [`borderFrontColor`, (node: Node, value: any) => {
    node.markDirtyRender();
  }],

  [`backgroundBackColor`, (node: Node, value: any) => {
    node.markDirtyRender();
  }],

  [`backgroundFrontColor`, (node: Node, value: any) => {
    node.markDirtyRender();
  }],

  [`contentBackColor`, (node: Node, value: any) => {
    node.markDirtyRender();
  }],

  [`contentFrontColor`, (node: Node, value: any) => {
    node.markDirtyRender();
  }],
]);

function elementsOnly(trigger: (element: NodeElement, value: any) => void) {
  return (node: Node, value: any) => {
    if (node instanceof NodeElement) {
      trigger(node, value);
    }
  };
}

function getYogaEnum(yoga: any, type: string, value: any) {
  if (typeof value !== `string`)
    throw new Error(`Invalid value type (${typeof value})`);
  if (!Object.prototype.hasOwnProperty.call(yoga.Constants, type))
    throw new Error(`Invalid enumeration type ("${type}")`);
  if (!Object.prototype.hasOwnProperty.call(yoga.Constants[type], value))
    throw new Error(`Invalid enumeration value ("${value}")`);
  return yoga.Constants[type][value];
}

function getYogaUnit(yoga: any, value: any) {
  if (value === `auto`) {
    return {value: 0, unit: yoga.Constants.unit.auto};
  } else if (typeof value === `string` && value.charAt(value.length - 1) === `%`) {
    return {value: parseFloat(value), unit: yoga.Constants.unit.percent};
  } else if (typeof value === `number` || parseFloat(value) == value) {
    return {value: parseFloat(value), unit: yoga.Constants.unit.point};
  } else if (value == null) {
    return {value: 0, unit: yoga.Constants.unit.undefined};
  } else {
    throw new Error(`Unknown value`);
  }
}

/**
 * Style properties listed in the COMPOSITE_STYLES map will get expanded to whatever the linked function will return.\
 * The original property will not be in the final computed style set.
 */

const FLEX_SHORTHANDS: Map<string, any> = new Map([
  [`initial`, {
    flexGrow: 0,
    flexShrink: 1,
  }],

  [`none`, {
    flexGrow: 0,
    flexShrink: 0,
  }],

  [`auto`, {
    flexGrow: 1,
    flexShrink: 1,
  }],
]);

export type CompositeStyle = (value: any) => {[key: string]: any};

export const COMPOSITE_STYLES: Map<string, CompositeStyle> = new Map([
  [`borderColor`, (value: any) => {
    return { borderFrontColor: value };
  }],

  [`backgroundColor`, (value: any) => {
    return { backgroundBackColor: value };
  }],

  [`color`, (value: any) => {
    return { contentFrontColor: value };
  }],

  [`margin`, (value: any) => {
    return handleEdgeShorthand(`margin`, value);
  }],

  [`padding`, (value: any) => {
    return handleEdgeShorthand(`padding`, value);
  }],

  [`border`, (value: any) => {
    return handleBorderShorthand(value);
  }],

  [`flex`, (value: any) => {
    const shorthand = FLEX_SHORTHANDS.get(value);
    if (shorthand) {
      return shorthand;
    } else {
      return { flexGrow: value, flexShrink: 1, flexBasis: 0 };
    }
  }],
]);

/**
 * Generate the sub-properties for the "margin"/"padding" shorthands
 */

function handleEdgeShorthand(base: string, n: any) {
  if (typeof n === `number` || typeof n === `string`)
    n = [n, n];
  if (n.length === 2)
    n = [n[0], n[1], n[0], n[1]];

  return {
    [`${base}Top`]: n[0],
    [`${base}Right`]: n[1],
    [`${base}Bottom`]: n[2],
    [`${base}Left`]: n[3],
  };
}

/**
 * Generate the sub-properties for the "border" shorthands
 */

const BUILTIN_BORDERS = new Map([
  [`legacy`, [`-`, `|`, `-`, `|`, `+`, `+`, `+`, `+`]],
  [`solid`, [`─`, `│`, `─`, `│`, `┌`, `┐`, `└`, `┘`]],
  [`double`, [`═`, `║`, `═`, `║`, `╔`, `╗`, `╚`, `╝`]],
  [`strong`, [`━`, `┃`, `━`, `┃`, `┏`, `┓`, `┗`, `┛`]],
  [`rounded`, [`─`, `│`, `─`, `│`, `╭`, `╮`, `╰`, `╯`]],
]);

function handleBorderShorthand(n: any) {
  const builtin = BUILTIN_BORDERS.get(n);
  if (builtin)
    n = builtin;

  if (typeof n === `string`)
    n = [n];
  if (n.length === 1)
    n = [n[0], n[0]];
  if (n.length === 2)
    n = [n[0], n[1], n[0], n[1]];
  if (n.length === 6)
    n = [n[0], n[1], n[0], n[1], n[2], n[3], n[4], n[5]];

  return {
    borderTop: n[0],
    borderRight: n[1],
    borderBottom: n[2],
    borderLeft: n[3],

    borderTopLeft: n[4],
    borderTopRight: n[5],
    borderBottomLeft: n[6],
    borderBottomRight: n[7],
  };
}
