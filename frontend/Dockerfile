# frontend/Dockerfile
FROM node:22

# Create app directory
WORKDIR /usr/src/app
# Install app dependencies
COPY ./project-collabsphere/frontend/package*.json ./
RUN npm i --force --loglevel verbose --no-audit

# Bundle app source
COPY ./project-collabsphere/frontend/ .
COPY ./collabsphere.xyz ./collabsphere.xyz

# Build the app
RUN npm run build

# Install serve to serve the build
RUN npm install -g serve --force --loglevel verbose --no-audit

# Expose the port the app runs on
EXPOSE 80
EXPOSE 443

# Command to run the app
CMD ["serve", "--ssl-cert", "/usr/src/app/collabsphere.xyz/cert.pem", "--ssl-key", "/usr/src/app/collabsphere.xyz/privkey.pem", "-s", "dist", "-p", "443"]
