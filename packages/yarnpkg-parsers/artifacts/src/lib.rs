mod combinators;
mod parser;
mod utils;

use combinators::final_parser;
use wasm_bindgen::prelude::*;

/// # Safety
///
/// **Everything** assumes that the bytes passed in are valid UTF-8 and very bad things will happen if they aren't.
#[wasm_bindgen]
pub fn parse(input: &[u8]) -> Result<JsValue, JsError> {
  let mut parse_syml = final_parser(parser::parse);

  let value = parse_syml(input)?;

  let result = JsValue::from_serde(&value)?;

  Ok(result)
}
