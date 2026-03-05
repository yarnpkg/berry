import {BaseCommand}                        from '@yarnpkg/cli';
import {PortablePath, npath, ppath, xfs}    from '@yarnpkg/fslib';
import {Usage, Command, Option, UsageError} from 'clipanion';
import type {Definition}                    from 'clipanion';
import {homedir}                            from 'os';

type Shell = `bash` | `zsh` | `fish` | `powershell`;

type CompletionEntry = {
  path: Array<string>;
  options: Array<string>;
};

const ROOT_KEY = `__root__`;
const SUPPORTED_SHELLS: Array<Shell> = [`bash`, `zsh`, `fish`, `powershell`];

// eslint-disable-next-line arca/no-default-export
export default class CompletionsCommand extends BaseCommand {
  static paths = [[`completions`]];

  static usage: Usage = Command.Usage({
    description: `generate shell completion scripts`,
    details: `
      This command outputs a shell completion script for Yarn's CLI.
      Use \`--install\` to write the script to the appropriate shell configuration directory.
    `,
    examples: [[
      `Print a ZSH completion script`,
      `$0 completions zsh`,
    ], [
      `Install Bash completions`,
      `$0 completions bash --install`,
    ]],
  });

  shell = Option.String({required: false});
  install = Option.Boolean(`--install`, false, {description: `Write the script to the shell's completions directory`});
  yes = Option.Boolean(`-y,--yes`, false, {description: `Overwrite existing script without prompting`});

  async execute() {
    const shell = this.normalizeShell(this.shell ?? this.detectShell());
    if (!shell)
      throw new UsageError(`Unsupported shell or unable to detect. Use one of: ${SUPPORTED_SHELLS.join(`, `)}`);

    const onBrokenPipe = (error: NodeJS.ErrnoException) => {
      if (error.code === `EPIPE`) return;
      throw error;
    };
    this.context.stdout.on(`error`, onBrokenPipe);

    try {
      const definitions = this.cli.definitions();
      const completionEntries = buildEntries(definitions);
      const script = renderScript({shell, binaryName: this.cli.binaryName, entries: completionEntries});

      if (!this.install) {
        this.context.stdout.write(`${script}\n`);
        return 0;
      }

      const target = this.getInstallPath(shell);
      if (xfs.existsSync(target) && !this.yes)
        throw new UsageError(`The completion script already exists at ${npath.fromPortablePath(target)} (use --yes to overwrite)`);

      await xfs.mkdirpPromise(ppath.dirname(target));
      await xfs.writeFilePromise(target, script, `utf8`);

      const hint = this.activationHint(shell, target);
      this.context.stdout.write(`Wrote completions to ${npath.fromPortablePath(target)}\n\n${hint}\n`);

      return 0;
    } finally {
      this.context.stdout.off(`error`, onBrokenPipe);
    }
  }

  private normalizeShell(candidate: string | null): Shell | null {
    const normalized = candidate?.toLowerCase();
    if (!normalized) return null;
    if (normalized.includes(`powershell`) || normalized === `pwsh`) return `powershell`;
    if ((SUPPORTED_SHELLS as Array<string>).includes(normalized)) return normalized as Shell;
    return null;
  }

  private detectShell(): string | null {
    const shellPath = process.env.SHELL;
    if (!shellPath) return null;
    return ppath.basename(npath.toPortablePath(shellPath));
  }

  private getXdgDataHome() {
    return process.env.XDG_DATA_HOME
      ? npath.toPortablePath(process.env.XDG_DATA_HOME)
      : ppath.join(npath.toPortablePath(homedir()), `.local/share`);
  }

  private getXdgConfigHome() {
    return process.env.XDG_CONFIG_HOME
      ? npath.toPortablePath(process.env.XDG_CONFIG_HOME)
      : ppath.join(npath.toPortablePath(homedir()), `.config`);
  }

  private getInstallPath(shell: Shell) {
    switch (shell) {
      case `bash`: return ppath.join(this.getXdgDataHome(), `yarn/completions/yarn.bash`);
      case `zsh`: return ppath.join(this.getXdgDataHome(), `yarn/completions/yarn.zsh`);
      case `fish`: return ppath.join(this.getXdgConfigHome(), `fish/completions/yarn.fish`);
      case `powershell`: return ppath.join(this.getXdgDataHome(), `yarn/completions/yarn.ps1`);
    }
    throw new Error(`Assertion failed: Unsupported shell`);
  }

  private activationHint(shell: Shell, target: PortablePath) {
    const path = npath.fromPortablePath(target);
    switch (shell) {
      case `bash`: return `Add to ~/.bashrc or ~/.profile:\n  source ${path}`;
      case `zsh`: return `Add to ~/.zshrc:\n  source ${path}`;
      case `fish`: return `Restart your shell. Fish autoloads from ${ppath.dirname(target)}.`;
      case `powershell`: return `Add to your $PROFILE:\n  . "${path}"`;
    }
    throw new Error(`Assertion failed: Unsupported shell`);
  }
}

function buildEntries(definitions: Array<Definition>): Array<CompletionEntry> {
  const entries: Array<CompletionEntry> = [];
  for (const definition of definitions) {
    const path = definition.path.split(` `).slice(1).filter(Boolean);
    const options = new Set<string>();

    for (const option of definition.options)
      for (const name of option.nameSet)
        options.add(name);

    entries.push({path, options: Array.from(options).sort()});
  }
  return entries;
}

function buildChildMap(entries: Array<CompletionEntry>) {
  const children = new Map<string, Set<string>>();
  for (const entry of entries) {
    for (let idx = 0; idx < entry.path.length; idx++) {
      const prefix = entry.path.slice(0, idx);
      const prefixKey = formatKey(prefix);
      const nextToken = entry.path[idx];

      const bucket = children.get(prefixKey) ?? new Set<string>();
      bucket.add(nextToken);
      children.set(prefixKey, bucket);
    }
  }
  return children;
}

function buildOptionsMap(entries: Array<CompletionEntry>) {
  const options = new Map<string, Set<string>>();
  for (const entry of entries) {
    const key = formatKey(entry.path);
    const bucket = options.get(key) ?? new Set<string>();
    for (const opt of entry.options) bucket.add(opt);
    options.set(key, bucket);
  }
  return options;
}

function formatKey(segments: Array<string>) {
  return segments.length === 0 ? ROOT_KEY : segments.join(` `);
}

function sanitizeKeyForIdentifier(key: string) {
  return key.replace(/[^A-Za-z0-9]/g, `_`);
}

function renderScript(ctx: {shell: Shell, binaryName: string, entries: Array<CompletionEntry>}) {
  const childMap = buildChildMap(ctx.entries);
  const optionsMap = buildOptionsMap(ctx.entries);

  switch (ctx.shell) {
    case `bash`: return renderBash({...ctx, childMap, optionsMap, zshCompatible: false});
    case `zsh`: return renderBash({...ctx, childMap, optionsMap, zshCompatible: true});
    case `fish`: return renderFish({...ctx, childMap, optionsMap});
    case `powershell`: return renderPowerShell({...ctx, childMap, optionsMap});
  }
  throw new Error(`Assertion failed: Unsupported shell`);
}

function renderBash({binaryName, childMap, optionsMap, zshCompatible}: {binaryName: string, childMap: Map<string, Set<string>>, optionsMap: Map<string, Set<string>>, zshCompatible: boolean}) {
  const generateCase = (map: Map<string, Set<string>>) => {
    return Array.from(map.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, values]) => `    "${key}") echo "${Array.from(values).sort().join(` `)}";;`)
      .join(`\n`);
  };

  return `
${zshCompatible ? `if [[ -n \${ZSH_VERSION-} ]]; then
  __yarn_zsh_bashcompinit() {
    emulate -L zsh
    autoload -Uz bashcompinit
    bashcompinit
  }
  __yarn_zsh_bashcompinit
  unset -f __yarn_zsh_bashcompinit
fi` : ``}

__yarn_get_children() {
  case "$1" in
${generateCase(childMap)}
  esac
}

__yarn_get_options() {
  case "$1" in
${generateCase(optionsMap)}
  esac
}

_yarn_completions() {
  if [[ -n \${ZSH_VERSION-} ]]; then
    setopt localoptions KSH_ARRAYS
  fi
  local cur="\${COMP_WORDS[COMP_CWORD]}"
  local prev=""
  if [[ $COMP_CWORD -gt 0 ]]; then
    prev="\${COMP_WORDS[COMP_CWORD-1]}"
  fi
  local cmd_tokens=()
  local i

  if [[ $prev == --cwd ]]; then
    COMPREPLY=()
    return
  fi
  
  for ((i=1; i<COMP_CWORD; i++)); do
    local word="\${COMP_WORDS[i]}"
    [[ $word == --cwd ]] && { ((i++)); continue; }
    [[ $word == -* ]] && continue
    cmd_tokens+=("$word")
  done

  local prefix="${ROOT_KEY}"
  if [[ \${#cmd_tokens[@]} -gt 0 ]]; then
    prefix="\${cmd_tokens[*]}"
  fi

  if [[ $cur == -* ]]; then
    local opts="$(__yarn_get_options "$prefix")"
    
    if [[ -z "$opts" ]]; then
       opts="$(__yarn_get_options '${ROOT_KEY}')"
    fi
    
    COMPREPLY=( $(compgen -W "$opts" -- "$cur") )
    return
  fi

  local children="$(__yarn_get_children "$prefix")"
  
  if [[ $prefix == "completions" ]]; then
     children="${SUPPORTED_SHELLS.join(` `)}"
  fi

  if [[ -n "$children" ]]; then
    COMPREPLY=( $(compgen -W "$children" -- "$cur") )
  fi
}

complete -o default -F _yarn_completions ${binaryName}
`.trim();
}

function renderFish({binaryName, childMap, optionsMap}: {binaryName: string, childMap: Map<string, Set<string>>, optionsMap: Map<string, Set<string>>}) {
  const generateSwitch = (map: Map<string, Set<string>>) => {
    return Array.from(map.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, values]) => {
        const safeKey = key === ROOT_KEY ? `` : key;
        return `    case "${safeKey}"\n      echo ${Array.from(values).sort().join(` `)}`;
      }).join(`\n`);
  };

  return `
function __yarn_get_children
  switch "$argv[1]"
${generateSwitch(childMap)}
  end
end

function __yarn_get_options
  switch "$argv[1]"
${generateSwitch(optionsMap)}
  end
end

function __yarn_complete
  set -l tokens (commandline -opc)
  set -e tokens[1]
  set -l cur (commandline -ct)
  
  set -l cmd_tokens
  set -l skip_next 0
  for t in $tokens
    if test $skip_next -eq 1
      set skip_next 0
      continue
    end
    if test "$t" = "--cwd"
      set skip_next 1
      continue
    end
    if string match -q -- "-*" "$t"
      continue
    end
    set cmd_tokens $cmd_tokens $t
  end

  set -l key (string join " " $cmd_tokens)

  if string match -q -- "-*" "$cur"
    set -l opts (__yarn_get_options "$key")
    if test -z "$opts"
      set opts (__yarn_get_options "")
    end
    for opt in $opts; echo $opt; end
    return
  end

  set -l children (__yarn_get_children "$key")
  
  if test "$key" = "completions"
    for s in ${SUPPORTED_SHELLS.join(` `)}; echo $s; end
    return
  end

  for child in $children; echo $child; end
end

complete -c ${binaryName} -f -a "(__yarn_complete)"
`.trim();
}

function renderPowerShell({binaryName, childMap, optionsMap}: {binaryName: string, childMap: Map<string, Set<string>>, optionsMap: Map<string, Set<string>>}) {
  const toEntries = (map: Map<string, Set<string>>) =>
    Array.from(map.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, val]) => `    "${sanitizeKeyForIdentifier(key)}" = @(${Array.from(val).sort().map(v => `'${v}'`).join(`, `)})`)
      .join(`\n`);
  const supportedShells = SUPPORTED_SHELLS.map(shell => `'${shell}'`).join(`, `);

  return `
$__yarnChildren = @{
${toEntries(childMap)}
}

$__yarnOptions = @{
${toEntries(optionsMap)}
}

Register-ArgumentCompleter -CommandName ${binaryName} -ScriptBlock {
  param($wordToComplete, $commandAst, $cursorPosition)
  
  $elements = $commandAst.CommandElements | ForEach-Object { $_.Value }
  $parts = @()
  $skipNext = $false
  
  foreach ($element in $elements) {
    if ($element -eq '${binaryName}') { continue }
    if ([string]::IsNullOrWhiteSpace($element)) { continue }
    if ($skipNext) { $skipNext = $false; continue }
    
    if ($element -eq '--cwd') { $skipNext = $true; continue }
    if ($element.StartsWith('-')) { continue }
    
    $parts += $element
  }

  $prefixParts = $parts
  if ($wordToComplete -ne '' -and $wordToComplete -notlike '-*' -and $parts.Length -gt 0) {
    $prefixParts = $parts[0..($parts.Length - 2)]
  }
  
  $prefixKey = if ($prefixParts.Length -gt 0) { ($prefixParts -join ' ') -replace '[^A-Za-z0-9]', '_' } else { "${ROOT_KEY}" }
  
  if ($wordToComplete -like '-*') {
    if ($__yarnOptions.ContainsKey($prefixKey)) {
      $__yarnOptions[$prefixKey] | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
        [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterName', $_)
      }
    }
  } else {
    if ($prefixKey -eq "completions") {
      ${supportedShells} | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
        [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_)
      }
      return
    }
    if ($__yarnChildren.ContainsKey($prefixKey)) {
      $__yarnChildren[$prefixKey] | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
        [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_)
      }
    }
  }
}
`.trim();
}
