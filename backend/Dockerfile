# backend/Dockerfile
FROM node:22

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm i --force --loglevel verbose --no-audit

# Bundle app source
COPY . .

# Expose the port the app runs on
EXPOSE 4000

# Command to run the app
CMD [ "node", "server.js" ]
