use std::str;

use nom_supreme::error::ErrorTree;

// This function should propagate the unsafe instead of abstracting it away.
// TODO: Propagate the unsafe if the parser is ever used outside of WASM.

pub fn from_utf8(input: &[u8]) -> &str {
  unsafe { str::from_utf8_unchecked(input) }
}

pub fn convert_error_tree(err: ErrorTree<&[u8]>) -> ErrorTree<&str> {
  err.map_locations(from_utf8)
}
