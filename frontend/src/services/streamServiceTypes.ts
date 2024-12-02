import type { RtpParameters } from 'mediasoup-client/lib/RtpParameters'

interface ProducerID {
  id: string
  kind: string
  producerId: string
  appData: { [key: string]: any }
}

interface JoinStreamRoom {
  id: string
  routerRtpCapabilities: any
  producerIds: ProducerID[]
}

interface GetRTPCapabilities {
  rtpCapabilities: { [key: string]: string }
}

interface Consume {
  params: {
    id: string
    producerId: string
    kind: 'audio' | 'video' | undefined
    appData: { [key: string]: string }
    rtpParameters: RtpParameters
    iceParameters: { [key: string]: string }
    iceCandidates: { [key: string]: string }
    dtlsParameters: { [key: string]: string }
  }
}

interface Produce {
  id: string
  error: string
}

export type { ProducerID, JoinStreamRoom, GetRTPCapabilities, Consume, Produce }
