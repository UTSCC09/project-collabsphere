import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';
import {ExpressPeerServer} from 'peer';
import { Server } from 'socket.io';
import cors from 'cors';
import { readFileSync } from "fs";
import http from 'http';
import { createServer } from "https";
import cookieParser from 'cookie-parser';
dotenv.config();

const app = express();

app.use(cors({
  origin: process.env.FRONTEND,
  credentials: true,
}));

app.use(express.json());

app.use(cookieParser())


const privateKey = readFileSync( 'server.key' );
const certificate = readFileSync( 'server.crt' );
const config = {
        key: privateKey,
        cert: certificate
};

const customGenerationFunction = () =>
  (Math.random().toString(36) + "0000000000000000000").substring(2, 16);

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", process.env.FRONTEND);
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "*");
  next();
});

// * Primary server
const server = createServer(config, app);

// * Peer server
// TODO: Replace when we get a signed certificate
const httpPeerServer = http.createServer(app);

const io = new Server(httpPeerServer, {
  cors: {
    origin: process.env.FRONTEND,
    methods: ["GET", "POST"],
    credentials: true,
  }
});

httpPeerServer.listen(3030);

const pServer = app.listen(443);
const peerServer = ExpressPeerServer(pServer, {
  debug: true,
  proxied: true,
  allow_discovery: true,
  path: "/app",
  generateClientId: customGenerationFunction,
});

app.use(peerServer);

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected successfully'))
.catch((error) => console.error('MongoDB connection error:', error));

// Routes
app.use('/api', authRoutes);
app.use('/api', sessionRoutes);

// Error handling
app.use((req, res, next) => {
  res.status(404).json({ message: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error' });
});

// only start the server if not running tests
if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 4000;
  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
  
}

io.on("connection", (socket) => {
  console.log("Connection Request");
  socket.on("join_session", (sessionId, id, username) => {
    console.log("Received join request");
    socket.join(sessionId);
    socket.to(sessionId).emit("user_connection", id, username);

    socket.on("leave_session", () => {
      socket.to(sessionId).emit("user_disconnection", id);
      socket.leave(sessionId);
    });

    socket.on("send_file", (file) => {
      socket.to(sessionId).emit("send_file", file);
    });
  });
});

// server.listen(3030);
// export the app for testing
export default app;
