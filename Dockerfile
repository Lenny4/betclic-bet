FROM dorowu/ubuntu-desktop-lxde-vnc:bionic

RUN apt-get -y update \
    && apt-get upgrade -y \
    && apt-get install -y curl gpg-agent

# region Node https://github.com/nodesource/distributions/blob/master/README.md
RUN curl -sL https://deb.nodesource.com/setup_14.x | sudo -E bash - \
    && apt-get install -y nodejs \
    && npm install -g nodemon pm2
# endregion Node

COPY docker/docker-entrypoint.sh /usr/local/bin/docker-entrypoint
RUN chmod +x /usr/local/bin/docker-entrypoint

WORKDIR /var/www/html

ENTRYPOINT ["docker-entrypoint"]
CMD ["/startup.sh"]
