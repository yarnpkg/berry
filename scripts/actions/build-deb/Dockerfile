FROM node:10

LABEL "com.github.actions.name"="build-deb"
LABEL "com.github.actions.description"="Builds the Yarn Debian and RPM packages"
LABEL "com.github.actions.icon"="package"
LABEL "com.github.actions.color"="blue"

# Debian packages
RUN apt-get -y update && \
  apt-get install -y --no-install-recommends \
  fakeroot \
  lintian \
  rpm \
  ruby \
  ruby-dev \
  && \
  apt-get clean && \
  rm -rf /var/lib/apt/lists/*

# Ruby packages
RUN gem install fpm

ADD build-deb.sh /build-deb.sh
ENTRYPOINT ["/build-deb.sh"]
