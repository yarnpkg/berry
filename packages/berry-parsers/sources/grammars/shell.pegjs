Start
  = line:ShellLine? { return line ? line : [] }

ShellLine
  = main:CommandLine then:ShellLineThen? { return [ main ].concat(then || []) }

ShellLineThen
  = S* ';' S* then:ShellLine S* { return then }

CommandLine
  = chain:CommandChain then:CommandLineThen? { return then ? { chain, then } : { chain } }

CommandLineThen
  = S* type:CommandLineType S* then:CommandLine S* { return { type, line: then } }

CommandLineType
  = '&&'
  / '||'

CommandChain
  = main:Command then:CommandChainThen? { return then ? { ...main, then } : main }

CommandChainThen
  = S* type:CommandChainType S* then:CommandChain S* { return { type, chain: then } }

CommandChainType
  = '|&'
  / '|'

Command
  = S* "(" S* subshell:ShellLine S* ")" S* { return { type: `subshell`, subshell } }
  / S* args:Argument+ S* { return { type: `command`, args } }

Argument
  = S* segments:ArgumentSegment+ { return [].concat(... segments) }

ArgumentSegment
  = string:SglQuoteString { return string }
  / string:DblQuoteString { return string }
  / string:PlainString { return string }

SglQuoteString
  = "'" text:SglQuoteStringText "'" { return [ text ] }

DblQuoteString
  = '"' segments:DblQuoteStringSegment* '"' { return [ ... segments ] }

PlainString
  = segments:PlainStringSegment+ { return segments }

DblQuoteStringSegment
  = shell:Subshell { return { type: `shell`, shell, quoted: true } }
  / name:Variable { return { type: `variable`, name, quoted: true } }
  / DblQuoteStringText

PlainStringSegment
  = shell:Subshell { return { type: `shell`, shell, quoted: false } }
  / name:Variable { return { type: `variable`, name, quoted: false } }
  / PlainStringText

SglQuoteStringText
  = chars:('\\' c:. { return c } / [^'])+ { return chars.join(``) }

DblQuoteStringText
  = chars:('\\' c:. { return c } / [^$"])+ { return chars.join(``) }

PlainStringText
  = chars:('\\' c:. { return c } / !SpecialShellChars c:. { return c })+ { return chars.join(``) }

Subshell
  = '$(' command:ShellLine ')' { return command }

Variable
  = '${' name:Identifier '}' { return name }
  / '$' name:Identifier { return name }

Identifier
  = [@*?#a-zA-Z0-9_-]+ { return text() }

SpecialShellChars
  = [()$|<>&; \t"']

S = [ \t]+
