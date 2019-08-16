FROM alpine:latest

LABEL "com.github.actions.name"="if-repo-dirty"
LABEL "com.github.actions.description"="Only lets the workflow continue if the repository is dirty"
LABEL "com.github.actions.icon"="filter"
LABEL "com.github.actions.color"="gray-dark"

RUN apk add --no-cache bash jq
RUN apk add --no-cache --upgrade grep

ADD entrypoint.sh /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
