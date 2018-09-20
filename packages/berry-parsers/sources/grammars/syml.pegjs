{
  const INDENT_STEP = 2;

  let indentLevel = 0;
}

Start
  = PropertyStatements

PropertyStatements
  = statements:PropertyStatement* { return Object.assign({}, ... statements) }

PropertyStatement
  = Samedent property:Name B? ":" B? value:Expression { return {[property]: value} }

Expression
  = EOL Indent statements:PropertyStatements Dedent { return statements }
  / expression:Literal EOL+ { return expression }

Samedent "correct indentation"
  = spaces:" "* &{ return spaces.length === indentLevel * INDENT_STEP }

Indent
  = &{ indentLevel++; return true }

Dedent
  = &{ indentLevel--; return true }

Name
  = string
  / pseudostring

Literal
  = string
  / pseudostring

/**
 */

pseudostring "pseudostring"
  = [a-z0-9\/.#@^~<=>+-]+(" "[a-z0-9\/.#@^~<=>+-]+)* B? { return text().replace(/^ *| *$/g, '') }

/**
 * String parsing
 */

string "string"
  = '"' '"' { return "";    }
  / '"' chars:chars '"' { return chars; }

chars
  = chars:char+ { return chars.join(""); }

char
  = [^"\\\0-\x1F\x7f]
  / '\\"' { return '"';  }
  / "\\\\" { return "\\"; }
  / "\\/" { return "/";  }
  / "\\b" { return "\b"; }
  / "\\f" { return "\f"; }
  / "\\n" { return "\n"; }
  / "\\r" { return "\r"; }
  / "\\t" { return "\t"; }
  / "\\u" h1:hexDigit h2:hexDigit h3:hexDigit h4:hexDigit {
      return String.fromCharCode(parseInt("0x" + h1 + h2 + h3 + h4));
    }

hexDigit
  = [0-9a-fA-F]

/**
 * Spaces
 */

B "blank space"
  = [ \t]+

S "white space"
  = [ \t\n\r]+

EOL
  = "\n"
