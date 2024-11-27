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

    addClientStream({
        username: username.value,
        audio: true,
        video: true,
        stream: stream,
    });
    // socket.emit("add_stream", stream);

}
let device: mediasoup.types.Device, producerTransport, consumerTransport, producers = {};

async function bindConsumer(producerId) {
  console.log("Binding consumer", producerId);
  console.log("--> Creating consumer transport");

  socket?.emit("consume", { producerId, rtpCapabilities: device.rtpCapabilities }, async (consumerOptions) => {
    console.log("Consuming");

    console.log(consumerOptions)
    const {error} = consumerOptions;

    if (error) {
      console.error("Error consuming", error);
      return;
    }
    
    const consumerTransport = device.createRecvTransport({...consumerOptions, ...consumerOptions.params});

    consumerTransport.on("connect", async ({ dtlsParameters }, callback) => {
      console.log("Bind consumer transport connected");
      socket?.emit("connect_transport", { dtlsParameters }, callback);
    });
    const kind = consumerOptions.kind;
    const conTranProps = {
      id: consumerOptions.id,
      kind,
      producerId,
      rtpCapabilities: device.rtpCapabilities,
      rtpParameters: consumerOptions.rtpParameters,
    }
    console.log("Consuming with properties", conTranProps);
    const consumer = await consumerTransport.consume(conTranProps);
    // const consumer = await consumerTransport.consume({ producerId, kind });
    const stream = new MediaStream();
    stream.addTrack(consumer.track);

    console.log("Adding client stream");
    addClientStream({
      username: producerId,
      audio: kind === "audio",
      video: kind === "video",
      stream: stream,
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
    console.log("JOINING STREAM ROOM");
    device = new mediasoup.Device();
    await device.load({routerRtpCapabilities});


    async function handle_create_transport(params: mediasoup.types.TransportOptions<mediasoup.types.AppData>) {
      producerTransport = device.createSendTransport({
        ...params
      });

      // Check that producer transport is valid
      if (!producerTransport) {
        console.error("Producer transport is invalid");
        return;
      }

      console.log(producerTransport)

      producerTransport.on("connect", async ({ dtlsParameters }, callback) => {
        console.log("Producer transport connected");
        socket?.emit("connect_transport", { dtlsParameters }, callback);
      });

      if (hasMedia) {
        console.log("Binding produce function on valid stream");

        producerTransport.on("produce", async ({ kind, rtpParameters }, callback) => {
          console.log("Time to produce.");
          socket?.emit("produce", { kind, rtpParameters }, callback);
        });

        for (const track of stream.getTracks()) {
          console.log("Producing track");
          await producerTransport.produce({ track });
        }
      }
    }

    async function handle_create_transport_after_producer({params, producerId, kind}) {
      console.log("Creating consumer transport");
      console.log(params)
      consumerTransport = device.createRecvTransport(params);

      consumerTransport.on("connect", async ({ dtlsParameters }, callback) => {
        socket?.emit("connect_transport", { dtlsParameters }, callback);
      });

      socket?.emit("consume", {producerId, rtpCapabilities: device.rtpCapabilities}, async (params) => {
        console.log("On Skibidi Bop");
        const consumer = await consumerTransport.consume(params);
        const stream = new MediaStream();
        stream.addTrack(consumer.track);
  
        addClientStream({
          username: producerId,
          audio: kind === "audio",
          video: kind === "video",
          stream: stream,
        });
      })

    }

    async function handle_new_producer({producerId, kind}) {
      console.log("NEW PRODUCER:", producerId, kind);

      if (!device.canProduce(kind)) {
        console.log("Cannot produce", kind);
        return;
      }

      socket?.emit("create_transport", async (params) => 
        handle_create_transport_after_producer(params, producerId, kind));
    }

    // Create producer transport
    socket?.emit("create_transport", handle_create_transport);

    // When a new producer is added, bind a consumer
    socket?.on("new_producer", handle_new_producer)

    console.log("Received producerIds", producerIds);
    // Bind consumers for all existing producers
    for (const producerId of producerIds) {
      console.log("Binding Consumer")
      await bindConsumer(producerId);
    }
  };
  
  socket?.emit("join_stream_room", handle_join_stream_room);
}

async function loadMyStream() {
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

  loadMyStream();

});

</script>

<template>
  <div>
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
