use std::str;

use nom_supreme::error::ErrorTree;

// These 2 functions should propagate the unsafe instead of abstracting it away.
// TODO: Propagate the unsafe if the parser is ever used outside of WASM.

pub fn from_utf8(input: &[u8]) -> &str {
  unsafe { str::from_utf8_unchecked(input) }
}

pub fn from_utf8_to_owned(input: &[u8]) -> String {
  unsafe { String::from_utf8_unchecked(input.to_owned()) }
}

pub fn convert_error_tree(err: ErrorTree<&[u8]>) -> ErrorTree<&str> {
  err.map_locations(from_utf8)
}
