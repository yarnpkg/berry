use std::str;

use nom::error::VerboseError;

// These 2 functions should propagate the unsafe instead of abstracting it away.
// TODO: Propagate the unsafe if the parser is ever used outside of WASM.

pub fn from_utf8(input: &[u8]) -> &str {
  unsafe { str::from_utf8_unchecked(input) }
}

pub fn from_utf8_to_owned(input: &[u8]) -> String {
  unsafe { String::from_utf8_unchecked(input.to_owned()) }
}

pub fn convert_verbose_error(err: VerboseError<&[u8]>) -> VerboseError<&str> {
  VerboseError {
    errors: err
      .errors
      .into_iter()
      .map(|(input, kind)| (from_utf8(input), kind))
      .collect(),
  }
}
