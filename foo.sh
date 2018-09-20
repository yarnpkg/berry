a() {
    node -p 'console.log(process.argv.slice(1))' -- "$@"
}

a x $@
a x "$@"
a x $*
a x "$*"
a x "[$*]"
a x "[$@][$@]"
