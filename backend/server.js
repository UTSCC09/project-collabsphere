import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';
import { ExpressPeerServer } from 'peer';
import { Server } from 'socket.io';
import cors from 'cors';
import { readFileSync } from "fs";
import { createServer } from "https";
import cookieParser from 'cookie-parser';
import Session from "./models/Session.js";
import jwt from 'jsonwebtoken';

dotenv.config();

const app = express();

app.use(cors({
  origin: process.env.FRONTEND,
  credentials: true,
}));

app.use(express.json());

app.use(cookieParser())

const privateKey = readFileSync(process.env.SSL_PRIVATE_KEY_PATH || '/etc/letsencrypt/live/collabsphere.xyz/privkey.pem');
const certificate = readFileSync(process.env.SSL_CERTIFICATE_PATH || '/etc/letsencrypt/live/collabsphere.xyz/cert.pem');

const config = {
  key: privateKey,
  cert: certificate
};
 
const customGenerationFunction = () => (Math.random().toString(36) + "0000000000000000000").substring(2, 16);

app.use(function (req, res, next) {
	res.header("Access-Control-Allow-Origin", process.env.FRONTEND);
	res.header("Access-Control-Allow-Headers", "Content-Type");
	res.header("Access-Control-Allow-Methods", "*");
	next();
});

// * Primary server
const server = createServer(config, app);

// * Peer server
const httpsSocketServer = createServer(config, app);

const io = new Server(httpsSocketServer, {
	cors: {
		origin: process.env.FRONTEND,
		methods: ["GET", "POST"],
		credentials: true,
	},
});

httpsSocketServer.listen(3030);

const peerServer = ExpressPeerServer(server, {
	// debug: true,
	// proxied: true,
	allow_discovery: true,
	path: "/app",
	port: 4000,
	// ssl: {
	//   key: config.key,
	//   cert: config.cert
	// },
	sslkey: process.env.SSL_PRIVATE_KEY_PATH || "/etc/letsencrypt/live/collabsphere.xyz/privkey.pem",
	sslcert: process.env.SSL_CERTIFICATE_PATH || "/etc/letsencrypt/live/collabsphere.xyz/cert.pem",
	generateClientId: customGenerationFunction,
});

app.use(peerServer);

// MongoDB connection
mongoose
	.connect(process.env.MONGODB_URI, {
		useNewUrlParser: true,
		useUnifiedTopology: true,
	})
	.then(() => console.log("MongoDB connected successfully"))
	.catch((error) => console.error("MongoDB connection error:", error));

// Routes
app.use("/api", authRoutes);
app.use("/api", sessionRoutes);

// Error handling
app.use((req, res, next) => {
	res.status(404).json({ message: "Route not found" });
});

app.use((err, req, res, next) => {
	console.error(err.stack);
	res.status(500).json({ message: "Internal server error" });
});

// only start the server if not running tests
if (process.env.NODE_ENV !== "test") {
	const PORT = process.env.PORT || 4000;
	server.listen(PORT, () => {
		console.log(`Server running on http://localhost:${PORT}`);
	});
}

import { ms_bind, ms_client_disconnect } from "./mediasoup-handler.js";

io.on("connection", (socket) => {
  console.log("Connection Request");
  socket.on("join_session", async (sessionId, id) => {
    console.log("Received join request from " + id);
    socket.join(sessionId);
    socket.to(sessionId).emit("user_connection", id);

    const userId = jwt.verify(socket.request.headers.cookie.split('=')[1], process.env.JWT_SECRET).id;
    const session = await Session.findById(sessionId);

    // TODO remove for optimization
    // if current user is host, emit their connection id
    if (userId === session.host.toString()) {
      session.connId = id;
      await session.save();
      // io instead of socket so the host also receives the message
      io.to(sessionId).emit("new_host", id);
    }

    socket.on("note", (note) => {
      socket.to(sessionId).emit("note", note);
    });

    socket.on("host_application", async () => {
      const session = await Session.findById(sessionId);
      // !session.connId prevents a socket from emitting host_application while host exists
      // also, only allows the first to respond (typically the best internet speed)
      if (!session.connId) {
        session.host = userId;
        session.connId = id;
        await session.save();
        // io instead of socket so the host also receives the message
        io.emit("new_host", id);
      }
    });

    socket.on("disconnect", async () => {
      socket.to(sessionId).emit("user_disconnection", id);
      socket.leave(sessionId);

      const session = await Session.findById(sessionId);
      if (userId === session.host.toString()) {
        session.connId = "";
        await session.save();
        socket.to(sessionId).emit("host_left");
      }

      ms_client_disconnect(sessionId, id);
    });

    
    /* Media Soup */
    ms_bind(socket, sessionId, id);
  });
});


// server.listen(3030);
// export the app for testing
export default app;
