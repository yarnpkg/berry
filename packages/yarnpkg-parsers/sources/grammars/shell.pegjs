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

VariableAssignment
  = name:EnvVariable '=' arg:StrictValueArgument S* { return { name, args: [arg] } }
  / name:EnvVariable '=' S* { return { name, args: [] } }

Command
  = S* "(" S* subshell:ShellLine S* ")" S* args:RedirectArgument* S* { return { type: `subshell`, subshell, args } }
  / S* envs:VariableAssignment* S* args:Argument+ S* { return { type: `command`, args, envs } }
  / S* envs:VariableAssignment+ S* { return { type: `envs`, envs } }

CommandString
  = S* args:ValueArgument+ S* { return args }

Argument
  = S* arg:RedirectArgument { return arg }
  / S* arg:ValueArgument { return arg }

RedirectArgument
  = S* redirect:(">>" / ">" / "<<<" / "<") arg:ValueArgument { return { type: `redirection`, subtype: redirect, args: [arg] } }

ValueArgument
  = S* arg:StrictValueArgument { return arg }

StrictValueArgument
  = segments:ArgumentSegment+ { return { type: `argument`, segments: [].concat(... segments) } }

ArgumentSegment
  = string:SglQuoteString { return string }
  / string:DblQuoteString { return string }
  / string:PlainString { return string }

SglQuoteString
  = "'" text:SglQuoteStringText "'" { return [ { type: `text`, text } ] }

DblQuoteString
  = '"' segments:DblQuoteStringSegment* '"' { return segments }

PlainString
  = segments:PlainStringSegment+ { return segments }

DblQuoteStringSegment
  = shell:Subshell { return { type: `shell`, shell, quoted: true } }
  / variable:Variable { return { type: `variable`, ...variable, quoted: true } }
  / text:DblQuoteStringText { return { type: `text`, text } }

PlainStringSegment
  = shell:Subshell { return { type: `shell`, shell, quoted: false } }
  / variable:Variable { return { type: `variable`, ...variable, quoted: false } }
  / text:PlainStringText { return { type: `text`, text } }

SglQuoteStringText
  = chars:('\\' c:. { return c } / [^'])* { return chars.join(``) }

DblQuoteStringText
  = chars:('\\' c:. { return c } / [^$"])+ { return chars.join(``) }

PlainStringText
  = chars:('\\' c:. { return c } / !SpecialShellChars c:. { return c })+ { return chars.join(``) }

Subshell
  = '$(' command:ShellLine ')' { return command }

Variable
  = '${' name:Identifier ':-' arg:CommandString '}' { return { name, defaultValue: arg } }
  / '${' name:Identifier ':-}' { return { name, defaultValue: [] } }
  / '${' name:Identifier '}' { return { name } }
  / '$' name:Identifier { return { name } }

EnvVariable
  = [a-zA-Z0-9_]+ { return text() }

Identifier
  = [@*?#a-zA-Z0-9_-]+ { return text() }

SpecialShellChars
  = [(){}<>$|&; \t"']

S = [ \t]+
