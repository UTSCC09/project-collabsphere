## Collabsphere
Collabsphere is a collaborative platform for users that hosts online study sessions for students and teachers. Collabsphere not only supports PDF sharing, but also live annotations, notes, video, audio and cursors.

__None of your non-account data is stored on the backend__, with all data being sent between users using WebRTC. Because of this, there must always be a user in the session to store the data.

### Live demo
[https://collabsphere.xyz](https://collabsphere.xyz)

## Getting started
### Frontend
First, you need to initialize the environment variables. Create a .env file in the frontend folder. To run the application non-locally, change VITE_PUBLIC_BACKEND and VITE_PUBLIC_SOCKET. VITE_SSL_PRIVATE_KEY_PATH and VITE_SSL_CERTIFICATE_PATH are only needed for HTTPS. VITE_GOOGLE_CLIENT_ID is only needed for Google OAuth 2.0 login.
```
VITE_PUBLIC_BACKEND=https://localhost:4000
VITE_PUBLIC_SOCKET=https://localhost:3030
VITE_SSL_PRIVATE_KEY_PATH=pathToPrivateKey.pem
VITE_SSL_CERTIFICATE_PATH=pathToCertificate.pem
VITE_GOOGLE_CLIENT_ID=00000000000-00000000000000000000000000000000.apps.googleusercontent.com
```
To run the frontend locally:
```
// in frontend folder
npm install
npm run dev
```

### Backend

First, you need to initialize the environment variables. Create a .env file in the backend folder. To run the application non-locally, change FRONTEND. GOOGLE_CLIENT_ID is only needed for Google OAuth 2.0 login.
```
MONGODB_URI=yourMongoDBURI
JWT_SECRET=yourJWTSecret
FRONTEND=https://localhost:5173
GOOGLE_CLIENT_ID=00000000000-00000000000000000000000000000000.apps.googleusercontent.com
```
To run the backend locally:
```
// in backend folder
npm install
npm run start
```

### Deployment with Docker

Run the following command inside the main project folder to run the application in the background using Docker:
```
sudo docker-compose up --detach
```