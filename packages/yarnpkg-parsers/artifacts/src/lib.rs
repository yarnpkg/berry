#![warn(clippy::nursery)]

mod parser;

use nom::{error::convert_error, Finish};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn parse(input: &str) -> Result<JsValue, JsError> {
  let (rest, value) = parser::parse(input)
    .finish()
    .map_err(|err| JsError::new(&convert_error(input, err)))?;

  if !rest.is_empty() {
    let message = if rest == input {
      format!("Failed to parse input: \"{rest}\"")
    } else {
      format!("Expected end of input, but \"{rest}\" found")
    };

    return Err(JsError::new(&message));
  }

  let result = JsValue::from_serde(&value)?;

  Ok(result)
}
