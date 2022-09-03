FROM alpine:3.15

LABEL "com.github.actions.name"="make-commit"
LABEL "com.github.actions.description"="Generates a commit with the given message"
LABEL "com.github.actions.icon"="git-commit"
LABEL "com.github.actions.color"="green"

RUN apk add --no-cache bash git

ADD entrypoint.sh /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
