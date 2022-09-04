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
  match err {
    ErrorTree::Base { location, kind } => ErrorTree::Base {
      location: from_utf8(location),
      kind,
    },
    ErrorTree::Stack { base, contexts } => ErrorTree::Stack {
      base: Box::new(convert_error_tree(*base)),
      contexts: contexts
        .into_iter()
        .map(|(location, context)| (from_utf8(location), context))
        .collect(),
    },
    ErrorTree::Alt(errors) => ErrorTree::Alt(errors.into_iter().map(convert_error_tree).collect()),
  }
}
