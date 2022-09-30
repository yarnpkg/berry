use nom::{
  branch::alt,
  bytes::complete::{is_not, take_while_m_n},
  character::complete::{char, line_ending, multispace0, not_line_ending, space0, space1},
  combinator::{map, map_opt, map_res, opt, recognize, value},
  multi::{count, fold_many1, many0_count},
  sequence::{delimited, preceded, separated_pair, terminated},
  AsChar, IResult,
};
use nom_supreme::{error::ErrorTree, multi::parse_separated_terminated};

// Note: Don't use the `json!` macro - the bundle will be larger and the code will likely be slower.
use serde_json::{Map, Value};

use crate::{
  combinators::{empty, escaped_transform, final_parser},
  utils::{from_utf8, from_utf8_to_owned},
};

// TODO: Automatically detect indentation from input.
const INDENT_STEP: usize = 2;

pub type Input<'a> = &'a [u8];

pub type ParseResult<'input, O> = IResult<Input<'input>, O, ErrorTree<Input<'input>>>;

#[derive(Clone, Copy)]
struct Context {
  indent: usize,
  overwrite_duplicates: bool,
}

fn parser<O>(
  parser: impl Fn(Input, Context) -> ParseResult<O>,
  ctx: Context,
) -> impl Fn(Input) -> ParseResult<O> {
  move |input| parser(input, ctx)
}

pub fn parse(input: Input, overwrite_duplicates: bool) -> Result<Value, ErrorTree<&str>> {
  let ctx = Context {
    indent: 0,
    overwrite_duplicates,
  };

  let mut parse = final_parser(parser(start, ctx));

  parse(input)
}

fn start(input: Input, ctx: Context) -> ParseResult<Value> {
  parser(top_level_expression, ctx)(input)
}

fn top_level_expression(input: Input, ctx: Context) -> ParseResult<Value> {
  alt((
    parser(item_statements, ctx),
    parser(property_statements, ctx),
    parser(flow_expression, ctx),
  ))(input)
}

fn property_statements(input: Input, ctx: Context) -> ParseResult<Value> {
  map(
    fold_many1(
      alt((
        map(comment, |_| Default::default()),
        parser(property_statement, ctx),
      )),
      Map::new,
      |mut acc, (key, value)| {
        if let Value::String(key) = key {
          let existing = acc.insert(key, value);
          if existing.is_some() && !ctx.overwrite_duplicates {
            // TODO: Don't panic.
            // TODO: Better error message.
            panic!("Duplicate key");
          }
        }
        acc
      },
    ),
    Value::Object,
  )(input)
}

fn property_statement(input: Input, ctx: Context) -> ParseResult<(Value, Value)> {
  preceded(
    parser(indentation, ctx),
    separated_pair(
      scalar,
      delimited(space0, char(':'), space0),
      parser(expression, ctx),
    ),
  )(input)
}

fn comment(input: Input) -> ParseResult<Option<Input>> {
  delimited(space0, opt(preceded(char('#'), not_line_ending)), eol_any)(input)
}

fn item_statements(input: Input, ctx: Context) -> ParseResult<Value> {
  map(
    fold_many1(parser(item_statement, ctx), Vec::new, |mut acc, value| {
      acc.push(value);
      acc
    }),
    Value::Array,
  )(input)
}

fn item_statement(input: Input, ctx: Context) -> ParseResult<Value> {
  preceded(
    parser(indentation, ctx),
    preceded(terminated(char('-'), space1), parser(expression, ctx)),
  )(input)
}

fn flow_mapping(input: Input, ctx: Context) -> ParseResult<Value> {
  preceded(
    terminated(char('{'), multispace0),
    map(
      parse_separated_terminated(
        opt(parser(flow_mapping_entry, ctx)),
        delimited(multispace0, char(','), multispace0),
        preceded(multispace0, char('}')),
        Map::new,
        |mut acc, entry| {
          if let Some((Value::String(key), value)) = entry {
            let existing = acc.insert(key, value);
            if existing.is_some() && !ctx.overwrite_duplicates {
              // TODO: Don't panic.
              // TODO: Better error message.
              panic!("Duplicate key");
            }
          }
          acc
        },
      ),
      Value::Object,
    ),
  )(input)
}

fn flow_mapping_entry(input: Input, ctx: Context) -> ParseResult<(Value, Value)> {
  separated_pair(
    scalar,
    delimited(space0, char(':'), space0),
    parser(flow_expression, ctx),
  )(input)
}

fn flow_sequence(input: Input, ctx: Context) -> ParseResult<Value> {
  preceded(
    terminated(char('['), multispace0),
    map(
      parse_separated_terminated(
        opt(alt((
          parser(flow_compact_mapping, ctx),
          parser(flow_expression, ctx),
        ))),
        delimited(multispace0, char(','), multispace0),
        preceded(multispace0, char(']')),
        Vec::new,
        |mut acc, value| {
          if let Some(value) = value {
            acc.push(value);
          }
          acc
        },
      ),
      Value::Array,
    ),
  )(input)
}

fn flow_compact_mapping(input: Input, ctx: Context) -> ParseResult<Value> {
  map(parser(flow_mapping_entry, ctx), |(key, value)| {
    let mut map = Map::new();
    if let Value::String(key) = key {
      // It's impossible for an existing entry to exist since we've just created the map.
      map.insert(key, value);
    }

    Value::Object(map)
  })(input)
}

fn expression(input: Input, ctx: Context) -> ParseResult<Value> {
  alt((
    preceded(
      line_ending,
      parser(
        item_statements,
        Context {
          indent: ctx.indent + INDENT_STEP,
          ..ctx
        },
      ),
    ),
    preceded(
      line_ending,
      parser(
        property_statements,
        Context {
          indent: ctx.indent + INDENT_STEP,
          ..ctx
        },
      ),
    ),
    parser(flow_expression, ctx),
  ))(input)
}

fn flow_expression(input: Input, ctx: Context) -> ParseResult<Value> {
  terminated(
    alt((
      parser(flow_mapping, ctx),
      parser(flow_sequence, ctx),
      scalar,
    )),
    opt(eol_any),
  )(input)
}

fn indentation(input: Input, ctx: Context) -> ParseResult<Vec<char>> {
  count(char(' '), ctx.indent)(input)
}

fn scalar(input: Input) -> ParseResult<Value> {
  map(
    alt((double_quoted_scalar, single_quoted_scalar, plain_scalar)),
    Value::String,
  )(input)
}

fn double_quoted_scalar(input: Input) -> ParseResult<String> {
  delimited(
    char('"'),
    alt((double_quoted_scalar_text, empty)),
    char('"'),
  )(input)
}

fn double_quoted_scalar_text(input: Input) -> ParseResult<String> {
  escaped_transform(
    // TODO: "\0-\x1F" was part of the original regexp
    map(is_not("\"\\\x7f"), from_utf8),
    '\\',
    alt((
      value('"', char('"')),
      value('\\', char('\\')),
      value('/', char('/')),
      value('\n', char('n')),
      value('\r', char('r')),
      value('\t', char('t')),
      // Rust doesn't support the following ascii escape sequences in string literals.
      value('\x08', char('b')),
      value('\x0c', char('f')),
      // Unicode escape sequences
      preceded(char('u'), unicode_escape_digits),
    )),
  )(input)
}

fn unicode_escape_digits(input: Input) -> ParseResult<char> {
  map_opt(
    map_res(
      take_while_m_n(4, 4, |byte: u8| byte.is_hex_digit()),
      |hex| u32::from_str_radix(from_utf8(hex), 16),
    ),
    char::from_u32,
  )(input)
}

fn single_quoted_scalar(input: Input) -> ParseResult<String> {
  delimited(
    char('\''),
    alt((single_quoted_scalar_text, empty)),
    char('\''),
  )(input)
}

fn single_quoted_scalar_text(input: Input) -> ParseResult<String> {
  map(is_not("'"), from_utf8_to_owned)(input)
}

fn plain_scalar(input: Input) -> ParseResult<String> {
  map(
    recognize(preceded(
      is_not("\r\n\t ?:,][{}#&*!|>'\"%@`-"),
      many0_count(preceded(space0, is_not("\r\n\t ,][{}:#\"'"))),
    )),
    from_utf8_to_owned,
  )(input)
}

fn eol_any(input: Input) -> ParseResult<Input> {
  terminated(line_ending, many0_count(preceded(space0, line_ending)))(input)
}
