   import mediasoup from 'mediasoup';

   const workerSettings = {
     logLevel: 'warn',
     rtcMinPort: 10000,
     rtcMaxPort: 10100
   };

	const routerOptions = {
		// mediasoup Server settings.
		logLevel: 'warn',
		logTags: [
		  'info',
		  'ice',
		  'dtls',
		  'rtp',
		  'srtp',
		  'rtcp',
		  'rbe',
		  'rtx'
		],
		rtcIPv4: true,
		rtcIPv6: true,
		rtcAnnouncedIPv4: null,
		rtcAnnouncedIPv6: null,
		rtcMinPort: 40000,
		rtcMaxPort: 49999,
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
		maxBitrate: 500000
	  }

   let worker;
   let router;

   const createWorker = async () => {
		worker = await mediasoup.createWorker(workerSettings);
		worker.on("died", () => {
			console.error("MediaSoup worker has died");
		});

		router = await worker.createRouter(routerOptions);
   };

   export { createWorker, worker as ms_worker, router as ms_router, routerOptions as ms_routerOptions };