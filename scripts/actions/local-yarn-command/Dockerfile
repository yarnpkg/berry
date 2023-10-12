FROM alpine:3.18

LABEL "com.github.actions.name"="local-yarn-command"
LABEL "com.github.actions.description"="Run a Yarn command using the checked-in build"
LABEL "com.github.actions.icon"="package"
LABEL "com.github.actions.color"="blue"

RUN apk add --no-cache bash nodejs rsync git

ADD entrypoint.sh /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
