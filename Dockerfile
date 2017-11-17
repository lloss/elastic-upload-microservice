FROM node:8.9.1

WORKDIR /usr/app/node_server

COPY . .

RUN yarn

EXPOSE 3000:3000

CMD [ "yarn", "start" ]
