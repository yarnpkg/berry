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
  combinators::{empty, escaped_transform},
  utils::{from_utf8, from_utf8_to_owned},
};

// TODO:: Automatically detect indentation from input.
const INDENT_STEP: usize = 2;

pub type Input<'a> = &'a [u8];

pub type ParseResult<'input, O> = IResult<Input<'input>, O, ErrorTree<Input<'input>>>;

pub fn parse(input: Input) -> ParseResult<Value> {
  top_level_expression(input)
}

fn top_level_expression(input: Input) -> ParseResult<Value> {
  alt((
    |input| item_statements(input, 0),
    |input| property_statements(input, 0),
    terminated(flow_mapping, eol_any),
    terminated(flow_sequence, eol_any),
    terminated(scalar, eol_any),
  ))(input)
}

fn property_statements(input: Input, indent: usize) -> ParseResult<Value> {
  map(
    fold_many1(
      alt((map(comment, |_| Default::default()), |input| {
        property_statement(input, indent)
      })),
      Map::new,
      |mut acc, (key, value)| {
        if !key.is_null() {
          // TODO: handle duplicates
          // TODO: propagate the error
          acc.insert(key.as_str().unwrap().to_owned(), value);
        }
        acc
      },
    ),
    Value::Object,
  )(input)
}

fn property_statement(input: Input, indent: usize) -> ParseResult<(Value, Value)> {
  preceded(
    |input| indentation(input, indent),
    separated_pair(scalar, delimited(space0, char(':'), space0), |input| {
      expression(input, indent)
    }),
  )(input)
}

fn comment(input: Input) -> ParseResult<Option<Input>> {
  delimited(space0, opt(preceded(char('#'), not_line_ending)), eol_any)(input)
}

fn item_statements(input: Input, indent: usize) -> ParseResult<Value> {
  map(
    fold_many1(
      |input| item_statement(input, indent),
      Vec::new,
      |mut acc, value| {
        acc.push(value);
        acc
      },
    ),
    Value::Array,
  )(input)
}

fn item_statement(input: Input, indent: usize) -> ParseResult<Value> {
  preceded(
    |input| indentation(input, indent),
    preceded(terminated(char('-'), space1), |input| {
      expression(input, indent)
    }),
  )(input)
}

fn flow_mapping(input: Input) -> ParseResult<Value> {
  preceded(
    terminated(char('{'), multispace0),
    map(
      parse_separated_terminated(
        opt(flow_mapping_entry),
        delimited(multispace0, char(','), multispace0),
        preceded(multispace0, char('}')),
        Map::new,
        |mut acc, entry| {
          if let Some((key, value)) = entry {
            // TODO: handle duplicates
            // TODO: propagate the error
            acc.insert(key.as_str().unwrap().to_owned(), value);
          }
          acc
        },
      ),
      Value::Object,
    ),
  )(input)
}

fn flow_mapping_entry(input: Input) -> ParseResult<(Value, Value)> {
  separated_pair(
    scalar,
    delimited(space0, char(':'), space0),
    flow_expression,
  )(input)
}

fn flow_sequence(input: Input) -> ParseResult<Value> {
  preceded(
    terminated(char('['), multispace0),
    map(
      parse_separated_terminated(
        opt(alt((flow_compact_mapping, flow_expression))),
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

fn flow_compact_mapping(input: Input) -> ParseResult<Value> {
  map(flow_mapping_entry, |(key, value)| {
    let mut map = Map::new();
    map.insert(key.as_str().unwrap().to_owned(), value);

    Value::Object(map)
  })(input)
}

fn expression(input: Input, indent: usize) -> ParseResult<Value> {
  alt((
    preceded(line_ending, |input| {
      item_statements(input, indent + INDENT_STEP)
    }),
    preceded(line_ending, |input| {
      property_statements(input, indent + INDENT_STEP)
    }),
    flow_expression,
  ))(input)
}

fn flow_expression(input: Input) -> ParseResult<Value> {
  terminated(alt((flow_mapping, flow_sequence, scalar)), opt(eol_any))(input)
}

fn indentation(input: Input, indent: usize) -> ParseResult<Vec<char>> {
  count(char(' '), indent)(input)
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
