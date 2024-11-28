<script setup lang="ts" type="module">
import {computed, onMounted, ref, Ref, Component, onBeforeUnmount, onBeforeMount} from "vue";
import { Peer } from "https://esm.sh/peerjs@1.5.4?bundle-deps"
import { throttle } from 'throttle-debounce';
import { io, Socket } from "socket.io-client";
import CursorItem from "@/components/CursorItem.vue";
import DocumentReader from "@/components/DocumentReader.vue";
import { useUserdataStore } from "@/stores/userdata";
import SharedNote from "@/components/SharedNote.vue";
import ClientAVFrame from '../components/ClientAVFrame.vue'
import * as mediasoup from "mediasoup-client";
import { MdCollectionsOutlined } from "oh-vue-icons/icons";

// true if user is host
const isHost = computed(() => {
  return useUserdataStore().isHost;
});

const sessionID = computed(() => {
  return useUserdataStore().sessionID;
});

const username = computed(() => {
  return useUserdataStore().username;
});

const mounted = ref(false);

const peer = new Peer({
  host: "/",
  port: 4000,
  path: "app",
  proxied: true,
  secure: true
});

// list of all connections
const conns: any = [];
// list of all peers
const otherUsers = new Map();
// list of all cursors
const cursors: Ref<cursor[]> = ref([]);
const cursorIds: string[] = [];
// null while no file has been uploaded
const file: Ref<Blob | null> = ref(null);
const documentReaderRef: Ref<Component | null> = ref(null);

interface data {
  x?: number,
  y?: number,
  username?: string,
  file?: Blob,
  annotations?: any,
}

interface cursor {
  id: any;
  username: string;
  x_coord: Ref<number>;
  y_coord: Ref<number>;
}

let socket: Socket | null = null;

onBeforeMount(() => {
  
  // opens socket connection to backend
  socket = io(`${import.meta.env.VITE_PUBLIC_SOCKET}`, {
    transports: ['websocket', 'polling', 'flashsocket'],
    withCredentials: true,
  });

  socket.on('connect', () => {
    console.log('Socket.IO connected with ID:', socket.id);
  });

  socket.on('connect_error', (err) => {
    console.error('Socket.IO connection error:', err);
  });
});

// modified from https://stackoverflow.com/questions/30738079/webrtc-peerjs-text-chat-connect-to-multiple-peerid-at-the-same-time
function connection_init(conn: Peer) {
  conns.push(conn);

  // each x_coord and y_coord is unique b/c of closure
  const x_coord = ref(0);
  const y_coord = ref(0);

  conn.on("data", (data: data) => {
    if (data.username) {
      otherUsers.get(conn.peer).username = data.username;
      return;
    }

    if (data.file) {
      file.value = new Blob([data.file]);
      return;
    }

    if (data.annotations) {
      documentReaderRef.value.importAnnotations(data.annotations);
      return;
    }

    // check if username has not been received, or data is not x or y coordinates
    if (!data.x || !data.y || !otherUsers.get(conn.peer).username) return;

    // TODO use interpolation
    x_coord.value = data.x;
    y_coord.value = data.y;

    // if no cursor for this connection exists yet, create one
    if (!cursorIds.includes(conn.peer)) {
      cursorIds.push(conn.peer);
      cursors.value.push({
        id: conn.peer,
        username: otherUsers.get(conn.peer).username,
        x_coord: x_coord,
        y_coord: y_coord
      });
    }
  });

  conn.on("error", (error: string) => {
    console.log(error);
  });
}

function peer_init() {
  peer.on("open", (id: string) => {
    console.log("Joining session.", sessionID.value, id, username.value);
    socket.emit("join_session", sessionID.value, id);
  });

  // when a user connects with you, initialize the connection
  peer.on("connection", (conn: Peer) => {
    conn.on("open", () => {
      connection_init(conn);
      otherUsers.set(conn.peer, {conn: conn});
      // send your username to the other user
      conn.send({username: username.value});
    });
  });
}

onMounted(() => {
  mounted.value = true;
  peer_init();

  // when a user connects to this session, create a new connection
  // and initialize it.
  socket.on("user_connection", (id) => {
    console.log("Another user connected to the session.");
    const conn = peer.connect(id);
    conn.on("open", () => {
      connection_init(conn);
      otherUsers.set(conn.peer, {conn: conn});
      // send your username to the other user
      conn.send({username: username.value});
      
      

      // send file if it exists and current user is the host
      if (file.value && isHost) {
        const fileReader = new FileReader();
        fileReader.onload = async () => {
          conn.send({file: fileReader.result});
        }
        fileReader.readAsArrayBuffer(file.value);
      }
    });
  });

  // when a user leaves this session, remove their cursor
  socket.on("user_disconnection", (id) => {
    const index = conns.indexOf(otherUsers.get(id).conn);
    otherUsers.delete(id);

    if (index !== -1) {
      conns.splice(index, 1);

      for (let i = 0; i < cursors.value.length; i++) {
        if (cursors.value[i].id === id) {
          cursorIds.splice(cursorIds.indexOf(id), 1);
          cursors.value.splice(i, 1);
        }
      }
    }

    removeClientStream(id);
  });

  socket.on("add_stream", ({id, stream}: {id: string, stream: MediaStream}) => {
    console.log("Adding stream to video element.");
    addClientStream({
      username: id,
      audio: true,
      video: true,
      stream: stream,
    });
  });

  // when mouse is moved, broadcast mouse position to all connections
  function sendCursor(
      e: MouseEvent,
      conns: any) {
    for (const conn of conns) {
      conn.send({ x: e.clientX / (e.view?.window.innerWidth || 1), y: e.clientY / (e.view?.window.innerHeight || 1) });
    }
  }

  const throttledSendCursor = throttle(50, sendCursor, {
    noLeading: false,
    noTrailing: false,
  })

  // when mouse is moved, broadcast mouse position to all connections
  // event is throttled to reduce load on connection
  onmousemove = e => throttledSendCursor(e, conns);
});

function sendAnnotations(annotations) {
  for (const conn of conns) {
    conn.send({annotations: annotations});
  }
}

function handleFileInput(e: Event) {
  if (!e.target) return ;

  const target = e.target as HTMLInputElement;
  if (target.files) {
    file.value = target.files[0];
  }
  console.log("Sending file to backend.");
  const fileReader = new FileReader();
  fileReader.onload = async () => {
    for (const conn of conns)
      conn.send({file: fileReader.result});
  }
  fileReader.readAsArrayBuffer(file.value);
}

const isFile = computed(() => {
  return file.value !== null;
});

onBeforeUnmount(() => {
  if (socket) socket.disconnect();
});


function addClientStream(data: ClientStreamData) {
  clientConfigData.value.push(data);
}

function removeClientStream(id: string) {
  const index = clientConfigData.value.findIndex((data) => data.id === id);
  if (index !== -1) {
    clientConfigData.value.splice(index, 1);
  }
}


interface ClientStreamData {
  id?: string;
  username: string;
  audio: boolean;
  video: boolean;
  stream: MediaStream;
}


const clientConfigData: Ref<ClientStreamData[]> = ref([]);
// const video: Ref<HTMLVideoElement | null> = ref(null);

async function sourceSelected(audioSource: string, videoSource: string) {
    const constraints = {
        audio: { deviceId: audioSource },
        video: { deviceId: videoSource, },};
            // width: { min: 160, ideal: 270, max: 1280 },
            // height: { min: 240, ideal: 480, max: 720 }  }, };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);

    console.log("Setting stream to video element");

    // addClientStream({
    //     username: username.value,
    //     audio: true,
    //     video: true,
    //     stream: stream,
    // });

    
    // const track = stream.getVideoTracks()[0];
    // const mediaStream = new MediaStream([track]);

    // const videoElement = document.createElement("video");
    // videoElement.srcObject = mediaStream;
    // videoElement.autoplay = true;
    // videoElement.muted = true; // Required for autoplay in most browsers

    // // PrintvideoElement.id
    // console.log(videoElement.srcObject);
    // videoElement.style.width = "100%";
    // // Optional, for debugging visibility
    // document.getElementById("videos")?.appendChild(videoElement);
}
let producers: { [key: string]: any } = {};

const device: Ref<mediasoup.types.Device | null> = ref(null);
// Defined either in bindConsumer (existing streams) 
// or when a new producer is introduced
const consumerTransport: Ref<mediasoup.types.Transport | null> = ref(null);
const producerTransport: Ref<mediasoup.types.Transport | null> = ref(null);

/* wrappers to ensure only one transport is created, and is kept track of */
const createRecvTransport = async (device: mediasoup.types.Device, consumerOptions=null) => {
  if (consumerTransport.value != null) return consumerTransport.value;

  
  let params;
  
  if (consumerOptions) params = {...consumerOptions, ...consumerOptions.params};
  if (consumerOptions == null) {
    console.error("Consumer options are null");

    const data = await new Promise((resolve) => socket?.emit("create_transport", (params) => {
      console.log("NEW PARAMS ->", params)
      resolve(params);
    }));

    params = data;
  }

  
  const newRecvTransport = device.createRecvTransport({...params});
  newRecvTransport.on("connect", async ({ dtlsParameters }, callback) => {
    console.log("Bind consumer transport connected");
    // Print the id
    console.log(newRecvTransport.id);
    socket?.emit("connect_transport", { transportId: newRecvTransport.id, dtlsParameters }, callback);
  });
  
  consumerTransport.value = newRecvTransport;
  console.log(`++ Creating consumer (id=${newRecvTransport.id}) transport`);
  return newRecvTransport;
}

const createSendTransport = async (device: mediasoup.types.Device, params=null) => {
  if (producerTransport.value != null) return producerTransport.value;

  if (params == null) {
    console.error("Producer options are null");
    return;
  }
  
  const newSendTransport = device.createSendTransport({...params});
  newSendTransport.on("connect", async ({ dtlsParameters }, callback) => {
    console.log("Bind producer transport connected");
    socket?.emit("connect_transport", { transportId: newSendTransport.id,
      dtlsParameters }, callback);
    });
    
    newSendTransport.on("produce", async (content, callback) => {
      const { kind, rtpParameters } = content;
      console.log("-> PRODUCE: ", content);
      socket?.emit("produce", { transportId: newSendTransport.id, kind, rtpParameters, appData: {v:"SKIBID"} }, callback);
    });
    producerTransport.value = newSendTransport;
    console.log(`++ Creating producer (id=${newSendTransport.id}) transport`);
  return newSendTransport;
}


const getDevice = async (routerRtpCapabilities=null) => {
  if (device.value != null) {
    return device.value;
  }

  if (routerRtpCapabilities == null) {
    console.error("Router RTP Capabilities are null");
    return;
  }
  
  const newDevice = new mediasoup.Device();
  await newDevice.load({ routerRtpCapabilities });

  device.value = newDevice;
  return newDevice;
}

function bindConsumer(producerData) {
  const {id, producerId, params} = producerData;

  console.log("Binding consumer for", producerId);
  // Ignore if consumer is already bound
  if (producers[producerId]) {
    return;
  }

  producers[producerId] = 1;

  return new Promise(async (resolve, reject) => {
    const device = await getDevice();
    socket?.emit("consume", { producerId, rtpCapabilities: device.rtpCapabilities }, async (consumerOptions) => {
      const {error} = consumerOptions;

      if (error) {
        reject(`Error consuming ${error}`);
        return;
      }

      const consumerTransport = await createRecvTransport(device);

      // const consumerTransport = await createRecvTransport(device, consumerOptions);
      // const consumerTransport = device?.createRecvTransport(consumerOptions);
      
      const kind = consumerOptions.kind;

      const conTranProps = {
        id: consumerOptions.id,
        kind,
        producerId,
        rtpCapabilities: device.rtpCapabilities,
        rtpParameters: consumerOptions.rtpParameters,
      }

      const consumer = await consumerTransport?.consume(conTranProps);
      const stream = new MediaStream();

      console.log("Get Tracks", consumer?.track);
      stream.addTrack(consumer?.track);

      producers[producerId] = consumer;
      
      addClientStream({
        username: producerId,
        audio: kind === "audio",
        video: kind === "video",
        stream,
      });

      // Check tracks exist
      if (!consumer.track) {
        console.error("No tracks found");
        return;
      }


      const track = consumer.track;
      const mediaStream = new MediaStream([track]);

      if (consumer.kind === "video") {
          const videoElement = document.createElement("video");
          videoElement.srcObject = mediaStream;
          videoElement.autoplay = true;
          videoElement.muted = true; // Required for autoplay in most browsers

          // PrintvideoElement.id
          console.log(videoElement.srcObject);
          videoElement.style.width = "100%";
          // Optional, for debugging visibility
          document.getElementById("videos")?.appendChild(videoElement);

          // Call play
          videoElement.play();
      }
      // } else if (consumer.kind === "audio") {
      //     const audioElement = document.createElement("audio");
      //     audioElement.srcObject = mediaStream;
      //     audioElement.autoplay = true;
      //     document.getElementById("videos")?.appendChild(audioElement);
      // }

      resolve(1);
    });

    
  });
}

async function initializeStreams(hasMedia=true) {
  let stream: MediaStream;
  if (hasMedia) { 
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  }

  console.log("Initializing streams");

  async function handle_join_stream_room({routerRtpCapabilities, producerIds}) {

    const device = await getDevice(routerRtpCapabilities);

    async function handle_create_transport(params: mediasoup.types.TransportOptions<mediasoup.types.AppData>) {
      const producerTransport = await createSendTransport(device, params);

      // Check that producer transport is valid
      if (!producerTransport) {
        console.error("Producer transport is invalid");
        return;
      }

      console.log("PRODUCER TRANSPORT ID", producerTransport.id)


      if (hasMedia) {
        console.log("Binding produce function on valid stream");

        for (const track of stream.getTracks()) {
          console.log("Producing track: ", track);
          await producerTransport.produce({ track});
                // Add to videos div
        }
      }
    }

    // Create producer transport
    socket?.emit("create_transport", handle_create_transport);
    
    socket?.on("new_producer", async (producerData) => {
      console.log("New producer", producerData);
      await bindConsumer(producerData);
    });

    console.log("ProducerID's to consume:", producerIds);
    // Bind consumers for all existing producers
    // for (const producerId of producerIds) {
    //   try {
    //     await bindConsumer(producerId);
    //   } catch (e) {
    //     console.error("Error binding consumer", e);
    //   }
    // }
  };
  
  socket?.emit("join_stream_room", handle_join_stream_room);
}

async function setupMedia() {
  let hasMedia = true;
  try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      const devices = await navigator.mediaDevices.enumerateDevices();

      let audioSource: string | null = null;
      let videoSource: string | null = null;

      devices.forEach((device) => {
          if (device.kind === "audioinput") {
              audioSource = device.deviceId;
          } else if (device.kind === "videoinput") {
              videoSource = device.deviceId;
          }
      });

      sourceSelected(audioSource, videoSource);

  } catch (err) {
      if (err.name === "NotFoundError") {
          console.log("No media devices found.");
      } else {
          console.error(`${err.name}: ${err.message}`);
      }
      hasMedia = false;
      // alert("navigator.mediaDevices.getUserMedia() is not supported or an error occurred.");
  } finally {
    
    initializeStreams(hasMedia);
  }
}

onMounted(() => {
  setupMedia();
});

</script>

<template>
  <div>
    <div id="videos" class="min-w-[50vw] min-h-[50vh] bg-black"></div>
    <h1 class="ml-2"><v-icon name='fa-users' class="scale-105"/> <span v-text="clientConfigData.length"/> Connected </h1>
    <CursorItem v-for="cursor in cursors" :username="cursor.username" :x_coord="cursor.x_coord" :y_coord="cursor.y_coord" style="z-index:100"/>
    <hr class="my-3" />
    <div class="flex">
      <div class="flex-1 flex flex-row m-5">
        <div id="main-item" class="basis-2/3">
          <div v-if="mounted">
            <Teleport :disabled="!isFile" to="#top-side-item">
              <p>MAIN</p>
            </Teleport>
          </div>
          <div v-if="isFile" id="viewer">
            <DocumentReader v-if="file" :file="file" ref="documentReaderRef" @sendAnnotations="sendAnnotations"/>
          </div>
        </div>
        <div id="side-items" class="basis-1/3 ml-5">
          <div id="top-side-item" class="justify-self-center">
            <label id="pdf-input" v-if="isHost && !isFile" class="a-href underline font-extrabold text-xl">
              <input type="file" @input="handleFileInput" name="upload" accept="application/pdf" class="hidden" />
              Upload PDF
            </label>
          </div>
          <div id="bottom-side-item" class="min-h-[50vh] flex flex-col">
            <SharedNote :socket="socket"/>
          </div>
        </div>
      </div>
      <div class="flex flex-col gap-2 w-fit bg-slate-300 overflow-scroll h-[85vh]">
          <!-- For looop  -->
        <ClientAVFrame v-for="(data, index) in clientConfigData" :key="index" :data="data" :socket="socket"/>
      </div>
    </div>
  </div>
</template>
<style scoped>
</style>
