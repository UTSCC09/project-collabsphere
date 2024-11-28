import * as mediasoup from 'mediasoup-client'
import type { TransportOptions } from 'mediasoup-client/lib/types'
import { ref, type Ref } from 'vue'
import { Socket } from 'socket.io-client'

interface ClientStreamData {
  id?: string
  username: string
  audio: boolean
  video: boolean
  stream: MediaStream
}

let producers: { [key: string]: any } = {}

let socket = null
const device: Ref<mediasoup.types.Device | null> = ref(null)
// Defined either in bindConsumer (existing streams)
// or when a new producer is introduced
const consumerTransport: Ref<mediasoup.types.Transport | null> = ref(null)
const producerTransport: Ref<mediasoup.types.Transport | null> = ref(null)
const clientConfigData: Ref<ClientStreamData[]> = ref([])
let videoElem

/* wrappers to ensure only one transport is created, and is kept track of */
const createRecvTransport = async (
  device: mediasoup.types.Device,
  consumerOptions = null,
) => {
  if (consumerTransport.value != null) return consumerTransport.value

  let params

  if (consumerOptions)
    params = { ...consumerOptions, ...consumerOptions.params }
  if (consumerOptions == null) {
    console.error('Consumer options are null')

    const data = await new Promise(resolve =>
      socket?.emit('create_transport', params => {
        resolve(params)
      }),
    )

    params = data
  }

  const newRecvTransport = device.createRecvTransport({ ...params })

  newRecvTransport.on('connect', async ({ dtlsParameters }, callback) => {
    socket?.emit(
      'connect_transport',
      { transportId: newRecvTransport.id, dtlsParameters },
      callback,
    )
  })

  consumerTransport.value = newRecvTransport
  console.log(`++ Creating consumer (id=${newRecvTransport.id}) transport`)
  return newRecvTransport
}

const createSendTransport = async (
  device: mediasoup.types.Device,
  options: TransportOptions | null = null,
) => {
  if (producerTransport.value != null) return producerTransport.value

  if (options == null) {
    console.error('Producer options are null')
    return
  }

  console.log('Options', options)
  const newSendTransport = device.createSendTransport(options)
  newSendTransport.on('connect', async ({ dtlsParameters }, callback) => {
    socket?.emit(
      'connect_transport',
      { transportId: newSendTransport.id, dtlsParameters },
      callback,
    )
  })

  newSendTransport.on('produce', async (content, callback) => {
    const { kind, rtpParameters } = content
    console.log('-> PRODUCE: ', content)
    socket?.emit(
      'produce',
      {
        transportId: newSendTransport.id,
        kind,
        rtpParameters,
        appData: { v: 'SKIBID' },
      },
      callback,
    )
  })
  producerTransport.value = newSendTransport
  console.log(`++ Creating producer (id=${newSendTransport.id}) transport`)
  return newSendTransport
}

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
  } catch (e) {
    console.log(e)
    if (e.name == 'UnsupportedError') {
      console.warn('Unsupported Browser.')
    }
  }

  return null
}

function bindConsumer(producerData) {
  const { producerId, params } = producerData
  if (producers[producerId]) return
  producers[producerId] = 1

  return new Promise(async (resolve, reject) => {
    const device = await getDevice()
    socket?.emit(
      'consume',
      { producerId, rtpCapabilities: device.rtpCapabilities },
      async ({ params }) => {
        const { error } = params

        if (error) {
          return reject(Error(`Cannot consume`))
        }

        const consumerTransport = await createRecvTransport(device)
        const kind = params.kind

        console.log('RTP Capabilities', device.rtpCapabilities)
        const consumer = await consumerTransport?.consume({
          id: consumerTransport.id,
          kind,
          producerId,
          rtpParameters: params.rtpParameters,
        })

        if (consumer.paused) {
          await consumer.resume()
        }

        // Check tracks exist
        if (!consumer.track) {
          console.error('No tracks found')
          return
        }

        if (consumer.kind === 'video') {
          const videoElement = videoElem.value
          videoElement.srcObject = new MediaStream([consumer.track])
          videoElement.muted = true
          console.log('SRC OBJECT', videoElement.srcObject)
          videoElement.style.width = '100%'
        }

        socket?.emit('consumer-resume', { consumerId: params.id })
        resolve(1)
      },
    )
  })
}

async function initializeStreams(hasMedia = true) {
  let stream: MediaStream
  if (hasMedia) {
    stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    })
  }

  console.log('Initializing streams')

  async function handle_join_stream_room({
    routerRtpCapabilities,
    producerIds,
  }) {
    const device = await getDevice(routerRtpCapabilities)

    async function handle_create_transport(
      params: mediasoup.types.TransportOptions<mediasoup.types.AppData>,
    ) {
      const producerTransport = await createSendTransport(device, params)

      // Check that producer transport is valid
      if (!producerTransport) {
        console.error('Producer transport is invalid')
        return
      }

      console.log('PRODUCER TRANSPORT ID', producerTransport.id)

      if (hasMedia) {
        const track = stream.getVideoTracks()[0]
        const prod_trans = await producerTransport.produce({
          track,
          //   encodings: [
          //     { maxBitrate: 100000 },
          //     { maxBitrate: 300000 },
          //     { maxBitrate: 900000 },
          //   ],

          //   codecOptions: {
          //     opusStereo: true,
          //     opusDtx: true,
          //   },
        })
        if (prod_trans.paused) {
          await prod_trans.resume()
        }

        // Consume test
        bindConsumer({
          producerId: prod_trans.id,
        })

        console.log('Track ID:', prod_trans.id)
        // for (const track of stream.getTracks()) {
        // }
      }
    }

    // Create producer transport
    socket?.emit('create_transport', handle_create_transport)

    socket?.on('new_producer', async producerData => {
      await bindConsumer(producerData)
    })

    console.log("ProducerID's to consume:", producerIds)
    // Bind consumers for all existing producers
    // for (const producerId of producerIds) {
    //   try {
    //     await bindConsumer(producerId);
    //   } catch (e) {
    //     console.error("Error binding consumer", e);
    //   }
    // }
  }

  socket?.emit('join_stream_room', handle_join_stream_room)
}

async function setupMedia(psocket: Socket, pvideoElem) {
  socket = psocket
  videoElem = pvideoElem
  let hasMedia = true
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    })
    const devices = await navigator.mediaDevices.enumerateDevices()
    let audioSource: string | null = null
    let videoSource: string | null = null
    devices.forEach(device => {
      if (device.kind === 'audioinput') {
        audioSource = device.deviceId
      } else if (device.kind === 'videoinput') {
        videoSource = device.deviceId
      }
    })

    addClientStream({
      username: 'You',
      audio: true,
      video: true,
      stream,
    })
  } catch (err) {
    if (err.name === 'NotFoundError') {
      console.log('No media devices found.')
    } else {
      console.error(`${err.name}: ${err.message}`)
    }
    hasMedia = false
    // alert("navigator.mediaDevices.getUserMedia() is not supported or an error occurred.");
  } finally {
    initializeStreams(hasMedia)
  }
}

function addClientStream(data: ClientStreamData) {
  clientConfigData.value.push(data)
}

function removeClientStream(id: string) {
  const index = clientConfigData.value.findIndex(data => data.id === id)
  if (index !== -1) {
    clientConfigData.value.splice(index, 1)
  }
}

export { setupMedia, removeClientStream, addClientStream, clientConfigData }
