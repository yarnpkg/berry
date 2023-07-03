#![feature(lint_reasons)]

mod combinators;
mod parser;
mod utils;

use wasm_bindgen::prelude::*;

/// # Safety
///
/// **Everything** assumes that the bytes passed in are valid UTF-8 and very bad things will happen if they aren't.
#[wasm_bindgen]
pub fn parse(input: &[u8], overwrite_duplicate_entries: bool) -> Result<String, JsError> {
  let value = parser::parse(input, overwrite_duplicate_entries)?;
  let result = serde_json::to_string(&value)?;

  Ok(result)
}
