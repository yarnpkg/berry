FROM alpine:latest

LABEL "com.github.actions.name"="local-yarn-command"
LABEL "com.github.actions.description"="Run a Yarn command using the checked-in build"
LABEL "com.github.actions.icon"="package"
LABEL "com.github.actions.color"="blue"

RUN apk add --no-cache bash nodejs rsync git

# For building Sharp
RUN apk add fftw-dev build-base autoconf python2 imagemagick --update-cache \
    --repository https://alpine.global.ssl.fastly.net/alpine/edge/testing/ \
    --repository https://alpine.global.ssl.fastly.net/alpine/edge/main

ADD entrypoint.sh /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
