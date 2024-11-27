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
import mediasoup from 'mediasoup';

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

// const pServer = app.listen(1234);
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
	sslkey: `C:/Users/talba/Documents/Miscellaneous Shared/GitHub/project-collabsphere/ssl/privkey.pem`,
	sslcert: `C:/Users/talba/Documents/Miscellaneous Shared/GitHub/project-collabsphere/ssl/cert.pem`,

	// sslkey: '/etc/letsencrypt/live/collabsphere.xyz/privkey.pem',
	// sslcert: '/etc/letsencrypt/live/collabsphere.xyz/cert.pem',
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

import {createWorker, ms_router, ms_worker, ms_routerOptions} from './mediasoup-setup.js';

(async () => {
  await createWorker();
})();

const rooms = new Map();

const get_room = (sessionId) => {
  return rooms.get(sessionId) || { transports: [], producers: [], consumers: [] };
}

io.on("connection", (socket) => {
	socket.on("join_session", async (sessionId, id) => {

		console.log("Received join request from", id);
		socket.join(sessionId);

		socket.to(sessionId).emit("user_connection", id);


		socket.on("note", (note) => {
			socket.to(sessionId).emit("note", note);
		});

		socket.on("disconnect", () => {
      console.log("Client Disconnected:", id);

      delete rooms[socket.id];

			socket.to(sessionId).emit("user_disconnection", id);
			socket.leave(sessionId);
		});

		/* Media Soup */
    bind_mediasoup(socket, sessionId, id);

  });
});


const bind_mediasoup = (socket, sessionId, id) => {

  socket.on("join_stream_room", async (callback) => {
    // Create a Router for the room if it doesn't exist
    if (!ms_router[sessionId]) {
      ms_router[sessionId] = await ms_worker.createRouter({ mediaCodecs: ms_routerOptions.mediaCodecs });
    }

    const room = get_room(sessionId);
    rooms.set(sessionId, room);

    const producerIds = room.producers.map((producer) => producer.id);

    callback({ 
      routerRtpCapabilities: ms_router[sessionId].rtpCapabilities,
      producerIds 
    });
  });


  /* Media Soup Internal */
  socket.on("create_transport", async (callback) => {
    const transport = await createWebRtcTransport(ms_router);
    callback({
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    });
 
    socket.on("connect_transport", async ({dtlsParameters}, callback) => {
      console.log(dtlsParameters.fingerprints)
      console.log("Transport connected");
      await transport.connect({ dtlsParameters });
      callback();
    });  

    socket.on("produce", async ({kind, rtpParameters}, callback) => {
      console.log("Producer requested");

      const room = get_room(sessionId);
      
      const producer = await transport.produce({ kind, rtpParameters });

      
      room.producers.push(producer);
      rooms.set(sessionId, room);
      
      socket.to(sessionId).emit("new_producer", { 
        params: producer.rtpParameters,
        producerId: producer.id, kind });

      console.log("Producer created");
      callback({ id: producer.id });
    })

    socket.on("consume", async ({ producerId, rtpCapabilities }, callback) => {

      console.log("Consumer requested");
      const router = ms_router; //[sessionId];
      console.log(router);
      // const transport = rooms[socket.id].transports.find((t) => t.appData?.consumer);
      console.log("RTP Capabilities", rtpCapabilities)
      
      if (!router.canConsume({producerId, rtpCapabilities})) {
        console.log("Cannot Consume");
        return callback({error: 'Cannot consume'});
      }

      const consumer = await transport.consume({
        producerId,
        rtpCapabilities,
        paused: false,
      });
      
      const room = get_room(sessionId);
      room.consumers.push(consumer);
      rooms.set(sessionId, room);

      
      callback({ 
        id: consumer.id,
        consumerId: consumer.id, 
        producerId,
        kind: consumer.kind,
        params: consumer.rtpParameters,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
        rtpParameters: consumer.rtpParameters,
        
      
      });
    });

  });
}


const createWebRtcTransport = async (router) => {
  const transport = await router.createWebRtcTransport({
    listenIps: [{ ip: '127.0.0.1', announcedIp: null }], // 127.0.0.1 incompatible with Firefox
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
  });


  transport.on('dtlsstatechange', dtlsState => {
    if (dtlsState === 'closed') {
      transport.close();
    }
  });

  transport.on('close', () => {
    console.log('Transport closed');
  });

  return transport;
};

// server.listen(3030);
// export the app for testing
export default app;
