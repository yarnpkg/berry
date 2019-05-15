FROM alpine:latest

LABEL "com.github.actions.name"="if-path-changed"
LABEL "com.github.actions.description"="Only lets the workflow continue if a regex matches the changed files"
LABEL "com.github.actions.icon"="filter"
LABEL "com.github.actions.color"="gray-dark"

RUN apk add --no-cache bash jq
RUN apk add --no-cache --upgrade grep

ADD entrypoint.sh /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
