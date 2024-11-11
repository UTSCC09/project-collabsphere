# frontend/Dockerfile
FROM node:22

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm install

# Bundle app source
COPY . .

# Build the app
RUN npm run build

# Install serve to serve the build
RUN npm install -g serve

# Expose the port the app runs on
EXPOSE 80

# Command to run the app
CMD ["serve", "serve", "--ssl-cert", "/etc/letsencrypt/live/collabsphere.xyz/cert.pem", "--ssl-key", "/etc/letsencrypt/live/collabsphere.xyz/privkey.pem", "-s", "dist", "-p", "443"]