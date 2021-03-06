FROM node:6

WORKDIR '/opt/pulsar-rest-api'

RUN apt-get update && apt-get install -y ruby
RUN gem install bundler
COPY Gemfile ./
COPY Gemfile.lock ./
RUN bundle install

RUN npm install -g bower
COPY bower.json .bowerrc ./
RUN bower install --allow-root

COPY package.json ./
RUN npm install --only=production

COPY . ./

EXPOSE 8001
CMD ["./bin/pulsar-rest-api"]
