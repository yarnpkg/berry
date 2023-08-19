//! Various reusable generic combinators.

use std::{borrow::Cow, ops::RangeFrom};

use nom::{
  error::{ErrorKind, ParseError},
  AsChar, Err, IResult, InputIter, InputLength, Offset, Parser, Slice,
};
use nom_supreme::{
  error::ErrorTree,
  final_parser::{ExtractContext, Location},
  ParserExt,
};

use crate::utils::{convert_error_tree, from_utf8};

/// A more ergonomic version of `success` that skips the extra allocation via clone
/// and returns the default value for the inferred output.
pub fn empty<I, O: Default, E: ParseError<I>>(input: I) -> IResult<I, O, E> {
  Ok((input, O::default()))
}

/// Returns a parser that executes `first` on the first invocation and `rest` on the subsequent ones.
pub fn different_first_parser<I, O, E>(
  mut first: impl Parser<I, O, E>,
  mut rest: impl Parser<I, O, E>,
) -> impl FnMut(I) -> IResult<I, O, E> {
  let mut executed_once = false;
  move |input| {
    if executed_once {
      rest.parse(input)
    } else {
      executed_once = true;
      first.parse(input)
    }
  }
}

/// Original implementation: https://docs.rs/nom-supreme/0.8.0/src/nom_supreme/final_parser.rs.html#229-243
///
/// This is a modified version that converts the `ErrorTree<&[u8]>` to `ErrorTree<&str>` so that it can be displayed and so that context can be extracted from it.
pub fn final_parser<'input, O>(
  parser: impl Parser<&'input [u8], O, ErrorTree<&'input [u8]>>,
) -> impl FnMut(&'input [u8]) -> Result<O, ErrorTree<Location>> {
  let mut parser = parser.complete().all_consuming();

  move |input| match parser.parse(input) {
    Ok((_, parsed)) => Ok(parsed),
    Err(Err::Error(err)) | Err(Err::Failure(err)) => {
      Err(convert_error_tree(err).extract_context(from_utf8(input)))
    }
    Err(Err::Incomplete(..)) => {
      unreachable!("Complete combinator should make this impossible")
    }
  }
}

/// Original implementation: https://docs.rs/nom/7.1.1/src/nom/bytes/complete.rs.html#623-705
///
/// Issues:
/// - https://github.com/Geal/nom/issues/1522
/// - https://github.com/Geal/nom/issues/1069
pub fn escaped_transform<'input, Input, Error, F, G>(
  mut normal: F,
  control_char: char,
  mut transform: G,
) -> impl FnMut(Input) -> IResult<Input, Cow<'input, str>, Error>
where
  Input: Clone + Offset + InputLength + Slice<RangeFrom<usize>> + InputIter,
  <Input as InputIter>::Item: AsChar,
  F: Parser<Input, &'input str, Error>,
  G: Parser<Input, char, Error>,
  Error: ParseError<Input>,
{
  move |input: Input| {
    let mut index = 0;
    let mut res = Cow::default();

    #[allow(clippy::redundant_clone, reason = "False positive")]
    let i = input.clone();

    while index < i.input_len() {
      let current_len = i.input_len();
      let remainder = i.slice(index..);
      match normal.parse(remainder.clone()) {
        Ok((i2, o)) => {
          res += o;
          if i2.input_len() == 0 {
            return Ok((i.slice(i.input_len()..), res));
          } else if i2.input_len() == current_len {
            return Ok((remainder, res));
          } else {
            index = input.offset(&i2);
          }
        }
        Err(Err::Error(_)) => {
          // unwrap() should be safe here since index < $i.input_len()
          if remainder.iter_elements().next().unwrap().as_char() == control_char {
            let next = index + control_char.len_utf8();
            let input_len = input.input_len();

            if next >= input_len {
              return Err(Err::Error(Error::from_error_kind(
                remainder,
                ErrorKind::EscapedTransform,
              )));
            } else {
              match transform.parse(i.slice(next..)) {
                Ok((i2, o)) => {
                  res.to_mut().push(o);
                  if i2.input_len() == 0 {
                    return Ok((i.slice(i.input_len()..), res));
                  } else {
                    index = input.offset(&i2);
                  }
                }
                Err(e) => return Err(e),
              }
            }
          } else {
            if index == 0 {
              return Err(Err::Error(Error::from_error_kind(
                remainder,
                ErrorKind::EscapedTransform,
              )));
            }
            return Ok((remainder, res));
          }
        }
        Err(e) => return Err(e),
      }
    }
    Ok((input.slice(index..), res))
  }
}
