mod combinators;
mod parser;
mod utils;

use nom::{error::convert_error, Finish};
use utils::{convert_verbose_error, from_utf8};
use wasm_bindgen::prelude::*;

/// # Safety
///
/// **Everything** assumes that the bytes passed in are valid UTF-8 and very bad things will happen if they aren't.
#[wasm_bindgen]
pub fn parse(input: &[u8]) -> Result<JsValue, JsError> {
  let (rest, value) = parser::parse(input)
    .finish()
    .map_err(|err| JsError::new(&convert_error(from_utf8(input), convert_verbose_error(err))))?;

  if !rest.is_empty() {
    let rest_str = from_utf8(rest);

    let message = if rest == input {
      format!("Failed to parse input: \"{rest_str}\"")
    } else {
      format!("Expected end of input, but \"{rest_str}\" found")
    };

    return Err(JsError::new(&message));
  }

  let result = JsValue::from_serde(&value)?;

  Ok(result)
}
