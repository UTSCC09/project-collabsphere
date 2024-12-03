import mediasoup from "mediasoup";

import dotenv from "dotenv";

dotenv.config();


/* Debugging Console Log */
const DEBUG = process.env.DEBUG || false;
const log = (...args) => {
	if (DEBUG) {
		console.log(...args);
	}
};

// Load config/mediasoup-config.json
import config from "./config/mediasoup-config.json" with { type: "json" };

// https://mediasoup.org/documentation/v3/mediasoup/api/#WorkerSettings
const workerSettings = {
	...config.WorkerSettings,
	// Add certificate and private key paths to the config
	dtlsCertificateFile: process.env.SSL_CERTIFICATE_PATH,
	dtlsPrivateKeyFile: process.env.SSL_PRIVATE_KEY_PATH,
};

// https://mediasoup.org/documentation/v3/mediasoup/api/#RouterOptions
const ms_routerOptions = config.RouterOptions;

let ms_worker;
let ms_router;
const listenIps = config.WebRtcTransportOptions.listenIps;
const transports = new Map();
const rooms = new Map();

/* Get the room object from the rooms Map */
const get_room = (sessionId) => {
	return rooms.get(sessionId) || { producers: [], consumers: [], clients: new Map() };
};

/* Remove the room object from the rooms Map */
const remove_room = (socketId) => {
	delete rooms[socketId];
};

/* Create a new Worker and Router for the room if it doesn't exist. */
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
		log(`(join_stream_room) Creating new router for room ${sessionId}`);
		ms_router[sessionId] = await ms_worker.createRouter({ mediaCodecs: ms_routerOptions.mediaCodecs });
	}
	return ms_router[sessionId];
};

/* Remove the Router for the room if it exists. */
const remove_router = async (sessionId) => {
	try {
		if (!ms_router[sessionId]) {
			return log(`(remove_router) Router for room ${sessionId} does not exist`);
		}

		await ms_router[sessionId].close();
		delete ms_router[sessionId];
		log(`(remove_router) Router for room ${sessionId} removed`);
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
	const transport_belongs_to_self = (transportId, callback = (data) => { }) => {
		try {
			const room = get_room(sessionId);
			const client = get_client(room, id);
			if (!client) {
				console.error("Client not found");
				callback({ error: "Client not found" });
				return false;
			}

			if (client.transports && !client.transports.includes(transportId)) {
				console.error("Client Transport ID does not match");
				callback({ error: "Client Transport ID does not match" });
				return false;
			}
			return true;
		} catch (error) {
			console.error("Error:", error);
		}
		return false;
	};

	const producer_or_consurmer_belongs_to_self = (transportId, callback = (data) => { }) => {
		try {
			const room = get_room(sessionId);
			const client = get_client(room, id);
			if (!client) {
				console.error("Client not found");
				callback({ error: "Client not found" });
				return false;
			}

			if (client.video_producer && client.video_producer === transportId) {
				return true;
			}

			if (client.audio_producer && client.audio_producer === transportId) {
				return true;
			}

			if (client.consumer && client.consumer === transportId) {
				return true;
			}
		} catch (error) {
			console.error("Error:", error);
		}
		return false;
	};

	const is_host_or_transport_owner = (transportId, callback = (data) => { }) => {
		// TODO : Implement host
		return transport_belongs_to_self(transportId) || producer_or_consurmer_belongs_to_self(transportId);
	};

	/* Get the client object from the room (key = sessionId) */
	const get_client = (room, id) => {
		return room.clients.get(id) || { socket, transports: [] };
	};

	/* Create a WebRTCTransport */
	const createWebRtcTransport = async (router) => {
		const transport = await router.createWebRtcTransport({
			// If you are testing locally on Firefox
			// I also received ICE stun server errors.
			// Apparently Firefox does not support loopback compared to Chrome.
			listenIps: listenIps,

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
			log("Transport closed");
		});

		transport.on("connectionstatechange", (state) => {
			log("Transport state:", state); // Should eventually be "connected"
		});

		// Add transport to client
		const room = get_room(sessionId);
		const client = get_client(room, id);
		client["transports"].push(transport.id);
		rooms.set(sessionId, room);

		log(`(createWebRtcTransport) Transport(id=${transport.id}) created for client`, id);
		return transport;
	};

	const get_producer_ids = (room) => {
		const producerIds = room.producers.map((producer) => {
			return {
				id: producer.id,
				kind: producer.kind,
				producerId: producer.id,
				appData: producer.appData,
			};
		});
		return producerIds;
	};

	// EVENT HANDLERS ----------------------------------------------

	socket.on("get_producer_ids", (callback) => {
		const room = get_room(sessionId);
		const producerIds = get_producer_ids(room);
		callback({ producerIds });
	});

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
		log(`(join_stream_room) Client ${id} joined room ${sessionId}`);

		// Create a Router for the room if it doesn't exist
		const router = await get_router(sessionId);

		const room = get_room(sessionId);
		const client = get_client(room, id);
		room.clients.set(id, client);
		rooms.set(sessionId, room);

		const producerIds = get_producer_ids(room);

		callback({
			id: id,
			routerRtpCapabilities: router.rtpCapabilities,
			producerIds,
		});
	});

	/* Create a WebRTCTransport  */
	socket.on("create_transport", async (callback) => {
		const router = await get_router(sessionId);
		const transport = await createWebRtcTransport(router);
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

		log(`${label}(tr=${transportId})\n\t -> Transport connected to room ${sessionId}`);
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
		log(`(produce) called by ${label}(tr=${transportId})`);
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

		appData.paused = true;

		const payload = {
			kind,
			rtpParameters,
			appData: {
				...appData,
				id,
			},
		};

		const producer = await transport.produce(payload);

		producer.pause();

		// Add the producer to the room
		room.producers.push(producer);
		const client = room.clients.get(id);
		if (client) {
			if (kind === "audio") {
				client["audio_producer"] = producer.id;
			}
			if (kind === "video") {
				client["video_producer"] = producer.id;
			}
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

		log(`(consume) called by ${label}(tr=${transport.id})`);
		const router = await get_router(sessionId);

		if (!router) {
			console.error("Router not found");
			callback({ error: "Router not found" });
			return;
		}

		if (!router.canConsume({ producerId, rtpCapabilities })) {
			log("Cannot Consume");
			return callback({ error: "Cannot consume" });
		}

		const consumer = await transport.consume({
			producerId,
			rtpCapabilities,
			pause: false,
		});

		room.consumers.push(consumer);
		const client = get_client(room, id);
		if (client) {
			client["consumer"] = consumer.id;
		}
		rooms.set(sessionId, room);
		const params = {
			id: consumer.id,
			producerId: producerId,
			kind: consumer.kind,
			appData: {
				...producerTransport.appData,
			},

			rtpParameters: consumer.rtpParameters,
			iceParameters: transport.iceParameters,
			iceCandidates: transport.iceCandidates,
			dtlsParameters: transport.dtlsParameters,
		};

		callback({ params });
	});

	/* In response to a consumer resume request, resume the consumer */
	socket.on("consumer-resume", async ({ consumerId }) => {
		const room = get_room(sessionId);
		const consumer = room.consumers.find((c) => c.id === consumerId);

		if (!consumer) {
			console.error("Consumer not found");
			return;
		}
		await consumer.resume();
		socket.to(sessionId).emit("consumer-resumed", consumerId);
	});

	/* In response to a consumer pause request, pause the consumer */
	socket.on("pause_consumer", async ({ consumerId }) => {
		const room = get_room(sessionId);
		const consumer = room.consumers.find((c) => c.id === consumerId);

		// Check that either we are host or we own the transport
		if (!is_host_or_transport_owner(consumer.transportId)) {
			console.error("Not host or transport owner");
			return;
		}

		if (!consumer) {
			console.error("Consumer not found");
			return;
		}
		await consumer.pause();
		socket.to(sessionId).emit("consumer-paused", consumerId);
	});

	socket.on("pause-producer", async ({ clientId, producerId, kind }, callback) => {
		const room = get_room(sessionId);
		const producer = room.producers.find((p) => p.id === producerId);

		log(`(pause-producer) called by ${label}(pr=${producerId})`);

		if (!producer) {
			console.error("Producer not found");
			callback({ error: "Producer not found" });
			return;
		}

		if (!is_host_or_transport_owner(producerId)) {
			console.error("Not host or transport owner");
			callback({ error: "Not host or transport owner" });
			return;
		}

		producer.appData.paused = true;

		producer.pause();
		socket.to(sessionId).emit("producer-paused", { clientId, producerId, kind });
		callback();
	});

	socket.on("resume-producer", async ({ clientId, producerId, kind }, callback) => {
		const room = get_room(sessionId);
		const producer = room.producers.find((p) => p.id === producerId);
		log(`(resume-producer) called by ${label}(pr=${producerId})`);

		if (!producer) {
			console.error("Producer not found");
			callback({ error: "Producer not found" });
			return;
		}

		if (!is_host_or_transport_owner(producerId)) {
			console.error("Not host or transport owner");
			callback({ error: "Not host or transport owner" });
			return;
		}

		producer.appData.paused = false;

		producer.resume();
		socket.to(sessionId).emit("producer-resumed", { clientId, producerId, kind });
		callback();
	});
};

/* Remove the client from the room and close all associated transports */
const client_disconnect = (sessionId, id) => {
	const room = get_room(sessionId);
	if (!room) {
		log("Room not found");
		return;
	}

	const client = room.clients.get(id);
	if (!client) {
		log("Client not found");
		return;
	}

	const socket = client.socket;

	if (!socket) {
		log("Socket not found");
		return;
	}

	socket.to(sessionId).emit("remove_client", id);

	const videoProducerId = client.video_producer;
	const audioProducerId = client.audio_producer;
	const consumerId = client.consumer;

	if (videoProducerId) {
		const producer = room.producers.find((p) => p.id === videoProducerId);
		producer.close();
		room.producers = room.producers.filter((p) => p.id !== videoProducerId);
	}

	if (audioProducerId) {
		const producer = room.producers.find((p) => p.id === audioProducerId);
		producer.close();
		room.producers = room.producers.filter((p) => p.id !== audioProducerId);
	}

	if (consumerId) {
		const consumer = room.consumers.find((c) => c.id === consumerId);
		consumer.close();
		room.consumers = room.consumers.filter((c) => c.id !== consumerId);
	}

	// Get all transports associated with the client
	const client_transports = client.transports;

	client_transports.forEach((transportId) => {
		const transport = transports.get(transportId);

		try {
			if (transport) {
				transport.close();
			}
			transports.delete(transportId);
		} catch (error) {
			console.error("Error closing transport:", error);
		}
	});

	delete room.clients[id];

	rooms.set(sessionId, room);
};

(async () => {
	await createWorker();
})();

export { bind_mediasoup as ms_bind, remove_room as ms_remove_room, client_disconnect as ms_client_disconnect };
