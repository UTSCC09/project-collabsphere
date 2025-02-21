/*

Process is as follows:
1. Retrieve local stream
2. Fetch RTP Capabilities
3. Create a mediasoup Device
4. Create a producer transport
5. Connect producer transport
6. Create receiver transport
7. Connect receiver transport

*/
const PRINT_DEBUG = false
const log = (...args: any) => {
  if (PRINT_DEBUG) {
    console.log(...args)
  }
}


/* Media Configurations for produce */
const media_configs = {
  encodings: [
    {
      rid: 'r0',
      maxBitrate: 100000,
      scalabilityMode: 'L1T3',
    },
    {
      rid: 'r1',
      maxBitrate: 300000,
      scalabilityMode: 'L1T3',
    },
    {
      rid: 'r2',
      maxBitrate: 900000,
      scalabilityMode: 'L1T3',
    },
  ],

  // https://mediasoup.org/documentation/v3/mediasoup-client/api/#ProducerCodecOptions
  codecOptions: {
    videoGoogleStartBitrate: 1000,
  },
}

import * as mediasoup from 'mediasoup-client'
import { ref, toRaw, type Ref } from 'vue'
import { Socket } from 'socket.io-client'
import type { ClientStreamData } from '@/components/ClientAVFrame.vue'
import type {
  Consume,
  GetRTPCapabilities,
  JoinStreamRoom,
  Produce,
  ProducerID,
} from './streamServiceTypes'
import type { TransportOptions } from 'mediasoup-client/lib/types'

let myStreamID: string
let myVideoProducerID: string
let myAudioProducerID: string
let username = 'unknown'

let producers: { [key: string]: any } = {}

let socket: Socket

const device: Ref<mediasoup.types.Device | null> = ref(null)
// Defined either in bindConsumer (existing streams)
// or when a new producer is introduced
const consumerTransport: Ref<mediasoup.types.Transport | null> = ref(null)
const producerTransport: Ref<mediasoup.types.Transport | null> = ref(null)
const clientConfigData: Ref<Map<string, ClientStreamData>> = ref(new Map())

/* wrappers to ensure only one transport is created, and is kept track of */
const createRecvTransport = async (device: mediasoup.types.Device) => {
  if (consumerTransport.value != null) return toRaw(consumerTransport.value)

  const params: TransportOptions = await new Promise(resolve =>
    socket?.emit('create_transport', (params: TransportOptions) => {
      resolve(params)
    }),
  )

  const newRecvTransport = device.createRecvTransport(params)

  newRecvTransport.on('connect', async ({ dtlsParameters }, callback) => {
    socket?.emit(
      'connect_transport',
      { transportId: newRecvTransport.id, dtlsParameters },
      () => {
        log('7. Consumer Connected transport')
        callback()
      },
    )
  })

  consumerTransport.value = newRecvTransport
  log(`++ 6. Creating consumer (id=${newRecvTransport.id}) transport`)
  return newRecvTransport
}

/* Create a producer transport */
const createSendTransport = async (device: mediasoup.types.Device) => {
  if (producerTransport.value != null) return toRaw(producerTransport.value)

  const params: TransportOptions = await new Promise(resolve =>
    socket?.emit('create_transport', (params: TransportOptions) => {
      resolve(params)
    }),
  )

  // Initialize a producer webRTC transport
  const newSendTransport = device.createSendTransport(params)

  newSendTransport.on('connect', async ({ dtlsParameters }, callback) => {
    socket?.emit(
      'connect_transport',
      { transportId: newSendTransport.id, dtlsParameters },
      () => {
        log('5. Producer Connected transport')
        callback()
      },
    )
  })

  newSendTransport.on('produce', async (content, callback) => {
    const { kind, rtpParameters, appData } = content

    // Call the server to setup the producer.
    socket?.emit(
      'produce',
      {
        transportId: newSendTransport.id,
        kind,
        rtpParameters,
        appData,
      },
      (response: Produce) => {
        if (response.error) {
          console.error('Error producing', response.error)
          callback({ id: '' })
          return
        }
        const { id } = response

        callback({ id })
      },
    )
  })

  producerTransport.value = newSendTransport
  log(`++ 4. Creating producer (id=${newSendTransport.id}) transport`)
  return newSendTransport
}

/* Get the device */
const getDevice = async (
  routerRtpCapabilities = null,
): Promise<mediasoup.types.Device | null> => {
  try {
    if (device.value != null) {
      return device.value
    }

    if (routerRtpCapabilities == null) {
      console.error('Router RTP Capabilities are null')
      return null
    }

    const newDevice = new mediasoup.Device()
    await newDevice.load({ routerRtpCapabilities })

    device.value = newDevice
    return newDevice
  } catch (e: any) {
    log(e)
    if (e.name == 'UnsupportedError') {
      console.warn('Unsupported Browser.')
    }
  }

  console.error('Device is null')
  return null
}

/* Bind a consumer to a producer and then prepare it for display */
function bindConsumer(producerData: ProducerID) {
  const { producerId, kind, appData } = producerData
  let client_username = 'unknown'
  let paused = true
  if (appData) {
    client_username = appData.username || 'unknown'
    paused = appData.paused || false
  }

  // Check if producer already exists
  if (producers[producerId]) return
  producers[producerId] = 1

  return new Promise(async (resolve, reject) => {
    const device = await getDevice()

    if (!device) {
      console.error('No device found')
      return reject(Error('No device found'))
    }

    const consumerTransport = await createRecvTransport(device)

    socket?.emit(
      'consume',
      {
        transportId: consumerTransport.id,
        producerId,
        rtpCapabilities: device.rtpCapabilities,
      },
      async ({ params, error }: { params: Consume['params']; error: any }) => {
        if (error) {
          log('Error consuming', error)
          return reject(Error(`Cannot consume`))
        }

        const consumer = await consumerTransport?.consume({
          id: params.id,
          producerId: params.producerId,
          kind: params.kind,
          rtpParameters: params.rtpParameters,
        })

        // Check tracks exist
        if (!consumer.track) {
          console.error('No tracks found')
          return
        }

        log('8. Retrieving consumer')

        const stream_data: ClientStreamData = {
          id: appData.id,
          producerId: producerId,
          username: client_username,
          stream: new MediaStream([consumer.track]),
          socket: socket,
        }

        addClientStream(stream_data, paused, kind)

        socket?.emit('consumer-resume', { consumerId: params.id })
        resolve(1)
      },
    )
  })
}

/* Bind consumers for all existing producers */
async function bindExistingConsumers(producerIds: ProducerID[]) {
  log("ProducerID's to consume:", producerIds)
  // Bind consumers for all existing producers
  for (const producerData of producerIds) {
    if (producerData.id == myVideoProducerID) {
      continue
    }

    try {
      await bindConsumer(producerData)
    } catch (e) {
      console.error('Error binding consumer', e)
    }
  }
}

async function sendMyVideoTracks(
  stream: MediaStream,
  producerTransport: mediasoup.types.Transport,
) {
  if (!stream || (stream && stream.getVideoTracks().length == 0)) {
    console.error('No video track found')
    return
  }

  const videoTrack = stream?.getVideoTracks()[0]

  const video_payload = {
    ...media_configs,
    track: videoTrack,
    kind: 'video',
    appData: { username },
  }

  const prod_trans = await producerTransport.produce(video_payload)
  if (prod_trans.paused) {
    prod_trans.resume()
  }

  log('Track ID:', prod_trans.id)
  return prod_trans.id
}

async function sendMyAudioTracks(
  stream: MediaStream,
  producerTransport: mediasoup.types.Transport,
) {
  // Check has audio
  if (!stream || (stream && stream.getAudioTracks().length == 0)) {
    console.error('No audio track found')
    return
  }

  const audioTrack = stream?.getAudioTracks()[0]
  const audio_payload = {
    track: audioTrack,
    kind: 'audio',
    appData: { username },
  }

  const audio_prod_trans = await producerTransport.produce(audio_payload)
  if (audio_prod_trans.paused) {
    audio_prod_trans.resume()
  }
  return audio_prod_trans.id
}

/*  Feed video and audio into producer transport.
    Begin listening for new producers as well as existing producers */
async function initializeStreams(
  data: JoinStreamRoom,
  hasMedia = true,
): Promise<
  | {
      myVideoProducerID: string
      myAudioProducerID: string
    }
  | undefined
> {
  const { routerRtpCapabilities } = data

  const device = await getDevice(routerRtpCapabilities)
  if (device == null) {
    return
  }

  if (hasMedia) {
    const producerTransport = await createSendTransport(device)

    // Check that producer transport is valid
    if (!producerTransport) {
      console.error('Producer transport is invalid')
      return
    }

    const stream = await retrieveLocalStream()

    if (stream) {
      myVideoProducerID =
        (await sendMyVideoTracks(stream, producerTransport)) ?? ''
      myAudioProducerID =
        (await sendMyAudioTracks(stream, producerTransport)) ?? ''
    } else {
      console.error('No stream found')
    }
  }

  // Create producer transport
  socket.on('new_producer', async producerData => {
    log('New producer', producerData)
    await bindConsumer(producerData)
  })

  // Get producer ids
  socket.emit(
    'get_producer_ids',
    ({ producerIds }: { producerIds: ProducerID[] }) => {
      bindExistingConsumers(producerIds)
    },
  )

  return { myVideoProducerID, myAudioProducerID }
}

/* Retrieve local stream */
async function retrieveLocalStream() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      // video: true,
      audio: true,
      video: {
        width: {
          min: 640,
          max: 1920,
        },
        height: {
          min: 400,
          max: 1080,
        },
      },
    })

    return stream
  } catch (e) {
    console.error('Error retrieving local stream', e)
    return null
  }
}

/* Returns true if has media */
async function checkHasMedia() {
  try {
    await navigator.mediaDevices.enumerateDevices()
    return true
  } catch (err: any) {
    if (err.name === 'NotFoundError') {
      log('No media devices found.')
    } else {
      console.error(`${err.name}: ${err.message}`)
    }
    return false
    // alert("navigator.mediaDevices.getUserMedia() is not supported or an error occurred.");
  }
}

/* Bind stream event handlers */
async function bindStreamEventHandlers(socket: Socket) {
  socket.on('producer-paused', async ({ clientId, producerId, kind }) => {
    log('Producer paused', clientId)
    const producer = clientConfigData.value.get(clientId)
    if (!producer) {
      console.error('Producer not found')
      return
    }

    // See if is audio or video
    if (kind == 'video') {
      producer.videoDisabled = true
    }

    if (kind == 'audio') {
      producer.audioDisabled = true
    }
  })

  socket.on('producer-resumed', async ({ clientId, producerId, kind }) => {
    log('Producer resumed', clientId)
    const producer = clientConfigData.value.get(clientId)
    if (!producer) {
      console.error('Producer not found')
      return
    }

    // See if is audio or video
    if (kind == 'video') {
      producer.videoDisabled = false
    }

    if (kind == 'audio') {
      producer.audioDisabled = false
    }
  })
}

/* Initialize the process for establishing a connection to the SFU */
async function setupMedia(_socket: Socket, _username: string) {
  socket = _socket
  username = _username

  // Retrieve a local stream
  let hasMedia = await checkHasMedia()
  if (!hasMedia) {
    console.error('No media found')
    return
  }

  // Initialize streams
  _socket.emit('join_stream_room', async (params: JoinStreamRoom) => {
    // Fetch RTP Capabilities
    const response = await new Promise(resolve => {
      _socket.emit('get_rtp_capabilities', (data: GetRTPCapabilities) => {
        resolve(data)
      })
    })
    const { rtpCapabilities } = response as { rtpCapabilities: any }

    if (!rtpCapabilities) {
      return console.error('No router RTP capabilities found')
    }

    // Create a mediasoup Device
    const device = await getDevice(rtpCapabilities)
    if (!device) return console.error('No device found')

    // Close tracks for now
    async function joinCall(params: JoinStreamRoom) {
      if (!device) {
        return console.error('No device found')
      }

      let local_stream = await retrieveLocalStream()
      if (!local_stream) {
        return console.error('No stream found')
      }
      bindStreamEventHandlers(socket)

      // Create a producer transport (automatically connects)
      await createSendTransport(device)
      await createRecvTransport(device)

      const results = await initializeStreams(params, hasMedia)

      if (!results) {
        return console.error('No results found')
      }

      const { myVideoProducerID, myAudioProducerID } = results


      // Change producer ID to actual ID
      if (!clientConfigData.value) return

      const myConfigs = clientConfigData.value.get(params.id)
      if (!myConfigs) {
        console.error('No client configs')
        return
      }

      myConfigs.producerId = myVideoProducerID || ''
      myConfigs.audioProducerId = myAudioProducerID || ''
      myConfigs.videoDisabled = true
      myConfigs.audioDisabled = true
      if (local_stream) myConfigs.stream = local_stream
      myConfigs.connected = true
      myConfigs.joinCall = () => {}
    }

    myStreamID = params.id

    addClientStream({
      id: myStreamID,
      producerId: 'pending',
      username: 'You',
      stream: new MediaStream(),
      isLocal: true,
      socket: socket,
      videoDisabled: true,
      audioDisabled: true,
      joinCall: () => {
        joinCall(params)
      },
      toggleMute: toggleMute,
      toggleVideo: toggleVideo,
    })
  })

  socket?.on('remove_client', id => {
    log('Removing client', id)
    removeClientStream(id)
  })
}

/* Toggle mute: Used locally */
function toggleMute() {
  const myConfigs = clientConfigData.value.get(myStreamID)
  if (!myConfigs) {
    console.error('No client configs')
    return
  }

  myConfigs.audioDisabled = !myConfigs.audioDisabled
}

/* Toggle video: Used locally */
function toggleVideo() {
  const myConfigs = clientConfigData.value.get(myStreamID)
  if (!myConfigs) {
    console.error('No client configs')
    return
  }

  myConfigs.videoDisabled = !myConfigs.videoDisabled
}

/* Create a client stream or add a track to an existing one. */
function addClientStream(
  data: ClientStreamData,
  paused = false,
  kind = 'video',
) {
  if (data.id == null) {
    console.error('Client stream ID is null')
    return
  }

  const clientStream = clientConfigData.value.get(data.id)

  // Check if client stream already
  if (clientStream) {
    const hasVideo = clientStream.stream.getVideoTracks().length > 0
    const hasAudio = clientStream.stream.getAudioTracks().length > 0

    if (kind == 'video' && !hasVideo) {
      clientStream.stream.addTrack(data.stream.getVideoTracks()[0])
      clientStream.producerId = data.producerId
      clientStream.videoDisabled = paused
      clientConfigData.value.set(data.id, clientStream)
    }

    if (kind == 'audio' && !hasAudio) {
      clientStream.stream.addTrack(data.stream.getAudioTracks()[0])
      clientStream.audioProducerId = data.producerId
      clientStream.audioDisabled = paused
      clientConfigData.value.set(data.id, clientStream)
    }

    return
  }

  // If is audio, set producer ID to audio producer ID
  if (kind == 'audio') {
    data.audioProducerId = data.producerId
    data.audioDisabled = paused
  } else {
    data.videoDisabled = paused
  }

  clientConfigData.value.set(data.id, data)
}

/* Remove a client stream */
function removeClientStream(id: string) {
  // Stop tracks
  const clientStream = clientConfigData.value.get(id)
  if (!clientStream) return

  clientStream.stream.getTracks().forEach(track => track.stop())

  clientConfigData.value.delete(id)
}

/* Disconnect from the SFU and reset states */
function onDisconnect() {
  // Close transports
  if (producerTransport.value) producerTransport.value?.close()
  if (consumerTransport.value) consumerTransport.value?.close()

  device.value = null

  consumerTransport.value = null
  producerTransport.value = null

  producers = {}

  for (const [key, _] of clientConfigData.value.entries()) {
    removeClientStream(key)
  }

  // Get local stream and close it
  navigator.mediaDevices
    .getUserMedia({ video: true, audio: true })
    .then(stream => {
      stream.getTracks().forEach(track => {
        track.stop()
      })
    })

  clientConfigData.value.clear()
}

export {
  onDisconnect,
  setupMedia,
  removeClientStream,
  addClientStream,
  clientConfigData,
}
