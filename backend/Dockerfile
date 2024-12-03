# backend/Dockerfile
FROM node:22

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY ./project-collabsphere/backend/package*.json ./
RUN npm i --force --loglevel verbose --no-audit

# Bundle app source
COPY ./project-collabsphere/backend/ .
COPY ./collabsphere.xyz ./collabsphere.xyz

# Command to run the app
CMD [ "node", "server.js" ]
