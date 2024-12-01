# frontend/Dockerfile
FROM node:22-alpine

# Create app directory
WORKDIR /usr/src/app/frontend

# Install app dependencies
COPY package*.json ./
RUN npm i --force --loglevel verbose --no-audit

# Install serve to serve the build
RUN npm install -g serve  --force --loglevel verbose --no-audit

# Bundle app source
COPY . .

# Build the app
RUN npm run build


# Expose the port the app runs on
EXPOSE 80

# Command to run the app
CMD ["serve", "--ssl-cert", "/etc/letsencrypt/live/collabsphere.xyz/cert.pem", "--ssl-key", "/etc/letsencrypt/live/collabsphere.xyz/privkey.pem", "-s", "dist", "-p", "443"]