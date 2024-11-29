import mediasoup from "mediasoup";

import dotenv from "dotenv";

dotenv.config();

// https://mediasoup.org/documentation/v3/mediasoup/api/#WorkerSettings
const workerSettings = {
	logLevel: "warn",
	logTags: ["info", "ice", "dtls", "rtp", "srtp", "rtcp", "rbe", "rtx"],
	rtcMinPort: 40000,
	rtcMaxPort: 49000,
	dtlsCertificateFile: process.env.SSL_CERTIFICATE_PATH,
	dtlsPrivateKeyFile: process.env.SSL_PRIVATE_KEY_PATH,
};


// https://mediasoup.org/documentation/v3/mediasoup/api/#RouterOptions
const ms_routerOptions = {
	logLevel: "warn",
	logTags: ["info", "ice", "dtls", "rtp", "srtp", "rtcp", "rbe", "rtx"],
	rtcIPv4: true,
	rtcIPv6: true,
	mediaCodecs: [
		{
			kind: "audio",
			mimeType: "audio/opus",
			clockRate: 48000,
			channels: 2,
		},
		{
			kind: "audio",
			mimeType: "audio/PCMU",
			clockRate: 8000,
			channels: 1,
		},
		{
			kind: "video",
			mimeType: "video/VP8",
			clockRate: 90000,
			parameters: {
				"x-google-start-bitrate": 1000,
			},
		},
		{
			kind: "video",
			mimeType: "video/VP9",
			clockRate: 90000,
		},
		{
			kind: "video",
			mimeType: "video/H264",
			clockRate: 90000,
			parameters: {
				"packetization-mode": 1,
				"profile-level-id": "42e01f",
				"level-asymmetry-allowed": 1,
			},
		},
	],
	// mediasoup per Peer max sending bitrate (in bps).
	maxBitrate: 500000,
};

let ms_worker;
let ms_router;

const rooms = new Map();

const get_room = (sessionId) => {
	return rooms.get(sessionId) || { producers: [], consumers: [], clients: new Map() };
};

const transports = new Map();

const createWorker = async () => {
	ms_worker = await mediasoup.createWorker(workerSettings);
	ms_worker.on("died", () => {
		console.error("MediaSoup worker has died");
	});

	ms_router = await ms_worker.createRouter(ms_routerOptions);

	// Print rtc min and max ports
	console.log(`Worker: rtcMinPort = ${workerSettings.rtcMinPort}`);
	console.log(`Worker: rtcMaxPort = ${workerSettings.rtcMaxPort}`);
};



/* Create a new Router for the room if it doesn't exist. */
const get_router = async (sessionId) => {
	if (!ms_router[sessionId]) {
		console.log(`(join_stream_room) Creating new router for room ${sessionId}`);
		ms_router[sessionId] = await ms_worker.createRouter({ mediaCodecs: ms_routerOptions.mediaCodecs });
	}
	return ms_router[sessionId];
};

/* Remove the Router for the room if it exists. */
const remove_router = async (sessionId) => {
	try {
		if (!ms_router[sessionId]) {
			return console.log(`(remove_router) Router for room ${sessionId} does not exist`);
		}

		await ms_router[sessionId].close();
		delete ms_router[sessionId];
		console.log(`(remove_router) Router for room ${sessionId} removed`);
	} catch (error) {
		console.error("Error removing router:", error);
	}
};

/* 	This should eventually establish two transports for the client.
	One for sending and one for receiving.
*/
const bind_mediasoup = (socket, sessionId, id) => {
	// Shortened label for logging
	let label = `SKT(${Math.random().toString(36).substring(7)})`;

	// HELPER FUNCTIONS --------------------------------------------
	// ? Placed here to reuse parent scope variables

	/* Returns a boolean indicating whether the transport belongs to the client */
	const transport_belongs_to_self = (transportId) => {
		try {
			// Validate that the transportID belongs to the socket client
			const client = room.clients.get(id);
			if (!client) {
				console.error("Client not found");
				callback({ error: "Client not found" });
				return false;
			}

			if (client.transports && !client.transports.includes(transportId)) {
				console.error("Client Transport ID does not match");
				callback({ error: "Client Transport ID does not match" });
				return true;
			}
		}
		catch (error) {
			console.error("Error:", error);
		}
		return false;
	};

	// EVENT HANDLERS ----------------------------------------------

	/* Return the mediasoup Router RTP capabilities. */
	socket.on("get_rtp_capabilities", (callback) => {
		const rtpCapabilities = ms_router.rtpCapabilities;
		callback({ rtpCapabilities });
	});

	/* Establish a connection to the room:
	1. Create a new Router for the room if it doesn't exist.
	2. Add the client to the room.
	3. Return the client's ID and the Router's RTP capabilities along 
		with the existing producer IDs.
	*/
	socket.on("join_stream_room", async (callback) => {
		// Create a Router for the room if it doesn't exist
		const router = await get_router(sessionId);

		const room = get_room(sessionId);
		room.clients.set(id, { socket });
		rooms.set(sessionId, room);

		const producerIds = room.producers.map((producer) => {
			return {
				id: producer.id,
				producerId: producer.id,
				params: {
					id: producer.id,
					kind: producer.kind,
					rtpParameters: producer.rtpParameters,
				},
				appData: producer.appData,
			};
		});

		callback({
			id: id,
			routerRtpCapabilities: router.rtpCapabilities,
			producerIds,
		});
	});

	/* Create a WebRTCTransport  */
	socket.on("create_transport", async (callback) => {
		const router = await get_router(sessionId);
		const transport = await createWebRtcTransport(sessionId, id, router);
		const transport_callback_data = {
			id: transport.id,
			iceParameters: transport.iceParameters,
			iceCandidates: transport.iceCandidates,
			dtlsParameters: transport.dtlsParameters,
		};

		callback(transport_callback_data);
	});

	/* Establish a DTLS connection between client and server.*/
	socket.on("connect_transport", async ({ transportId, dtlsParameters }, callback) => {
		if (!transport_belongs_to_self(transportId)) {
			console.error("Transport does not belong to client");
			callback({ error: "Transport does not belong to client" });
			return;
		}

		console.log(`${label}(tr=${transportId})\n\t -> Transport connected to room ${sessionId}`);
		const transport = transports.get(transportId);
		if (!transport) {
			console.error("Transport not found");
			return;
		}
		await transport.connect({ dtlsParameters });
		callback();
	});

	/* 	Produce a track to the room. Adds a producer entry into the room as well
		as announces that a new producer has been created for clients to handle
	*/
	socket.on("produce", async ({ transportId, kind, rtpParameters, appData }, callback) => {
		console.log(`(produce) called by ${label}(tr=${transportId})`);
		const room = get_room(sessionId);
		const transport = transports.get(transportId);

		if (!transport) {
			console.error("Transport not found");
			callback({ error: "Transport not found" });
			return;
		}
		
		if (!transport_belongs_to_self(transportId)) {
			console.error("Transport does not belong to client");
			callback({ error: "Transport does not belong to client" });
			return;
		}

		const payload = {
			kind, 
			rtpParameters, 
			appData: { ...appData, id }
		}

		const producer = await transport.produce(payload);

		// Add the producer to the room
		room.producers.push(producer);
		const client = room.clients.get(id);
		if (client) {
			client["producer"] = producer.id;
		}
		rooms.set(sessionId, room);

		// Announce the new producer to all clients in the room
		socket.to(sessionId).emit("new_producer", {
			params: producer.rtpParameters,
			producerId: producer.id,
			kind,
			appData: producer.appData,
		});

		callback({ id: producer.id });
	});


	/* Create a consumer for a given producer  */
	socket.on("consume", async ({ transportId, producerId, rtpCapabilities }, callback) => {
		const room = get_room(sessionId);
		const transport = transports.get(transportId);
		const producerTransport = room.producers.find((p) => p.id === producerId);

		if (!transport) {
			console.error("Transport not found");
			callback({ error: "Transport not found" });
			return;
		}

		if (!producerTransport) {
			console.error("Producer Transport not found");
			callback({ error: "Producer Transport not found" });
			return;
		}

		if (!transport_belongs_to_self(transportId)) {
			console.error("Transport does not belong to client");
			callback({ error: "Transport does not belong to client" });
			return;
		}

		console.log(`(consume) called by ${label}(tr=${transport.id})`);
		const router = await get_router(sessionId);

		if (!router) {
			console.error("Router not found");
			callback({ error: "Router not found" });
			return;
		}

		if (!router.canConsume({ producerId, rtpCapabilities })) {
			console.log("Cannot Consume");
			return callback({ error: "Cannot consume" });
		}

		const consumer = await transport.consume({
			producerId,
			rtpCapabilities,
			paused: false,
		});

		room.consumers.push(consumer);
		if (client) {
			client["consumer"] = consumer.id;
		}
		rooms.set(sessionId, room);

		const params = {
			id: consumer.id,
			producerId: producerId,
			kind: consumer.kind,
			appData: producerTransport.appData,

			rtpParameters: consumer.rtpParameters,
			iceParameters: transport.iceParameters,
			iceCandidates: transport.iceCandidates,
			dtlsParameters: transport.dtlsParameters,
		};

		// console.log("Consumer Callback Information:", callback_data);
		callback({ params });
	});

	socket.on("consumer-resume", async ({ consumerId }) => {
		const room = get_room(sessionId);
		const consumer = room.consumers.find((c) => c.id === consumerId);

		if (!consumer) {
			console.error("Consumer not found");
			return;
		}
		await consumer.resume();
	});

	/* Host and client perms */
};

const createWebRtcTransport = async (sessionId, id, router) => {
	const transport = await router.createWebRtcTransport({
		listenIps: [
			{ ip: "0.0.0.0", announcedIp: "127.0.0.1" },
			{ ip: "0.0.0.0", announcedIp: "localhost"},
		], // 127.0.0.1 incompatible with Firefox

		enableUdp: true,
		enableTcp: true,
		preferUdp: true,
	});
	
	transports.set(transport.id, transport);
	
	transport.on("dtlsstatechange", (dtlsState) => {
		if (dtlsState === "closed") {
			transport.close();
			// Remove from transports
			transports.delete(transport.id);
		}
	});

	transport.on("close", () => {
		console.log("Transport closed");
	});

	transport.on("connectionstatechange", (state) => {
		console.log("Transport state:", state); // Should eventually be "connected"
	});

	// Add transport to client
	const room = get_room(sessionId);
	const client = room.clients.get(id);
	if (client) {
		if (client["transports"]) {
			client["transports"].push(transport.id);
		} else {
			client["transports"] = [transport.id];
		}
	}
	rooms.set(sessionId, room);

	return transport;
};


const remove_room = (socketId) => {
	delete rooms[socketId];
};

const client_disconnect = (sessionId, id) => {
	const room = get_room(sessionId);
	if (!room) {
		console.log("Room not found");
		return;
	}
	
	const client = room.clients.get(id);
	if (!client) {
		console.log("Client not found");
		return;
	}
	
	const socket = client.socket

	if (!socket) {
		console.log("Socket not found");
		return;
	}

	socket.to(sessionId).emit("remove_client", id);

	const producerId = client.producer;
	const consumerId = client.consumer;

	if (producerId) {
		const producer = room.producers.find((p) => p.id === producerId);
		producer.close();
		room.producers = room.producers.filter((p) => p.id !== producerId);
	}

	if (consumerId) {
		const consumer = room.consumers.find((c) => c.id === consumerId);
		consumer.close();
		room.consumers = room.consumers.filter((c) => c.id !== consumerId);
	}

	delete room.clients[id];

	rooms.set(sessionId, room);
}

(async () => {
	await createWorker();
})();

export { bind_mediasoup as ms_bind, remove_room as ms_remove_room, client_disconnect as ms_client_disconnect };
