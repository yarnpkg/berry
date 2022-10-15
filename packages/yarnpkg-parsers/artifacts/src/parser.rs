use nom::{
  branch::alt,
  bytes::complete::{is_not, take_while_m_n},
  character::complete::{char, line_ending, multispace0, not_line_ending, space0, space1},
  combinator::{eof, map, map_opt, map_res, not, opt, peek, recognize, value},
  multi::{count, many0_count},
  sequence::{delimited, preceded, separated_pair, terminated},
  AsChar, IResult,
};
use nom_supreme::{
  error::ErrorTree,
  multi::{
    collect_separated_terminated, parse_separated_terminated, parse_separated_terminated_res,
  },
};

// Note: Don't use the `json!` macro - the bundle will be larger and the code will likely be slower.
use serde_json::{Map, Value};

use crate::{
  combinators::{different_first_parser, empty, escaped_transform, final_parser},
  utils::{from_utf8, from_utf8_to_owned},
};

// TODO: Automatically detect indentation from input.
const INDENT_STEP: usize = 2;

pub type Input<'a> = &'a [u8];

pub type ParseResult<'input, O> = IResult<Input<'input>, O, ErrorTree<Input<'input>>>;

#[derive(Clone, Copy)]
struct Context {
  indent: usize,
  indent_next: bool,
  overwrite_duplicate_entries: bool,
}

fn parser<'input, O>(
  parser: impl Fn(Input<'input>, Context) -> ParseResult<'input, O>,
  ctx: Context,
) -> impl Fn(Input<'input>) -> ParseResult<'input, O> {
  move |input| parser(input, ctx)
}

pub fn parse(input: Input, overwrite_duplicate_entries: bool) -> Result<Value, ErrorTree<&str>> {
  let ctx = Context {
    indent: 0,
    indent_next: true,
    overwrite_duplicate_entries,
  };

  let mut parse = final_parser(parser(start, ctx));

  parse(input)
}

fn start(input: Input, ctx: Context) -> ParseResult<Value> {
  terminated(
    map(opt(parser(top_level_expression, ctx)), |value| {
      value.unwrap_or_else(|| Value::Object(Map::new()))
    }),
    opt(comments),
  )(input)
}

fn top_level_expression(input: Input, ctx: Context) -> ParseResult<Value> {
  alt((parser(block_expression, ctx), parser(flow_expression, ctx)))(input)
}

fn block_expression(input: Input, ctx: Context) -> ParseResult<Value> {
  alt((parser(block_mapping, ctx), parser(block_sequence, ctx)))(input)
}

fn block_mapping(input: Input, ctx: Context) -> ParseResult<Value> {
  let subsequent_ctx = Context {
    // Subsequent entries are always indented
    indent_next: true,
    ..ctx
  };

  map(
    parse_separated_terminated_res(
      different_first_parser(
        parser(block_mapping_entry, ctx),
        parser(block_mapping_entry, subsequent_ctx),
      ),
      eol_any,
      parser(block_terminator, subsequent_ctx),
      Map::new,
      |mut acc, (key, value)| {
        let existing = acc.insert(key, value);
        if existing.is_some() && !ctx.overwrite_duplicate_entries {
          // TODO: Better error message.
          return Err("Duplicate key");
        }
        Ok(acc)
      },
    ),
    Value::Object,
  )(input)
}

fn block_mapping_entry(input: Input, ctx: Context) -> ParseResult<(String, Value)> {
  preceded(
    comments,
    preceded(
      parser(indentation, ctx),
      separated_pair(
        scalar,
        delimited(space0, char(':'), space0),
        parser(
          block_mapping_entry_expression,
          Context {
            // Child expressions are always indented
            indent_next: true,
            ..ctx
          },
        ),
      ),
    ),
  )(input)
}

fn block_mapping_entry_expression(input: Input, ctx: Context) -> ParseResult<Value> {
  alt((
    preceded(
      line_ending,
      parser(
        block_expression,
        Context {
          indent: ctx.indent + INDENT_STEP,
          ..ctx
        },
      ),
    ),
    parser(flow_expression, ctx),
  ))(input)
}

fn block_sequence(input: Input, ctx: Context) -> ParseResult<Value> {
  let subsequent_ctx = Context {
    // Subsequent entries are always indented
    indent_next: true,
    ..ctx
  };

  map(
    collect_separated_terminated(
      different_first_parser(
        parser(block_sequence_entry, ctx),
        parser(block_sequence_entry, subsequent_ctx),
      ),
      eol_any,
      parser(block_terminator, subsequent_ctx),
    ),
    Value::Array,
  )(input)
}

fn block_sequence_entry(input: Input, ctx: Context) -> ParseResult<Value> {
  preceded(
    comments,
    preceded(
      parser(indentation, ctx),
      preceded(
        terminated(char('-'), space1),
        parser(
          block_sequence_entry_expression,
          Context {
            // Child expressions are never indented because, according to the YAML 1.2.2 spec:
            // "both the “-” indicator and the following spaces are considered to be part of the indentation of the nested collection"
            indent_next: false,
            ..ctx
          },
        ),
      ),
    ),
  )(input)
}

fn block_sequence_entry_expression(input: Input, ctx: Context) -> ParseResult<Value> {
  alt((
    parser(
      block_expression,
      Context {
        indent: ctx.indent + INDENT_STEP,
        ..ctx
      },
    ),
    parser(flow_expression, ctx),
  ))(input)
}

fn block_terminator(input: Input, ctx: Context) -> ParseResult<Input> {
  peek(terminated(eol_any, |input| {
    if ctx.indent == 0 {
      value((), eof)(input)
    } else {
      not(parser(indentation, ctx))(input)
    }
  }))(input)
}

fn flow_expression(input: Input, ctx: Context) -> ParseResult<Value> {
  alt((
    parser(flow_mapping, ctx),
    parser(flow_sequence, ctx),
    flow_scalar,
  ))(input)
}

fn flow_mapping(input: Input, ctx: Context) -> ParseResult<Value> {
  preceded(
    terminated(char('{'), multispace0),
    map(
      parse_separated_terminated_res(
        opt(parser(flow_mapping_entry, ctx)),
        delimited(multispace0, char(','), multispace0),
        preceded(multispace0, char('}')),
        Map::new,
        |mut acc, entry| {
          if let Some((key, value)) = entry {
            let existing = acc.insert(key, value);
            if existing.is_some() && !ctx.overwrite_duplicate_entries {
              // TODO: Better error message.
              return Err("Duplicate key");
            }
          }
          Ok(acc)
        },
      ),
      Value::Object,
    ),
  )(input)
}

fn flow_mapping_entry(input: Input, ctx: Context) -> ParseResult<(String, Value)> {
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
    map.insert(key, value);

    Value::Object(map)
  })(input)
}

fn flow_scalar(input: Input) -> ParseResult<Value> {
  map(scalar, Value::String)(input)
}

fn scalar(input: Input) -> ParseResult<String> {
  alt((double_quoted_scalar, single_quoted_scalar, plain_scalar))(input)
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

fn comments(input: Input) -> ParseResult<usize> {
  many0_count(comment)(input)
}

fn comment(input: Input) -> ParseResult<Option<Input>> {
  delimited(space0, opt(preceded(char('#'), not_line_ending)), eol_any)(input)
}

fn eol_any(input: Input) -> ParseResult<Input> {
  terminated(line_ending, many0_count(preceded(space0, line_ending)))(input)
}

fn indentation(input: Input, ctx: Context) -> ParseResult<Vec<char>> {
  count(char(' '), if ctx.indent_next { ctx.indent } else { 0 })(input)
}
