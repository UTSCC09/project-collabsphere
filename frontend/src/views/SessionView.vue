<script setup lang="ts" type="module">
import {computed, onMounted, ref, type Ref, type Component, onBeforeUnmount, onBeforeMount} from "vue";

// @ts-expect-error
import { Peer } from "https://esm.sh/peerjs@1.5.4?bundle-deps"
import { throttle } from 'throttle-debounce';
import { io, Socket } from "socket.io-client";
import CursorItem from "@/components/CursorItem.vue";
import DocumentReader, { type Annotation } from "@/components/DocumentReader.vue";
import { useUserdataStore } from "@/stores/userdata";
import SharedNote from "@/components/SharedNote.vue";
import ClientAVFrame from '../components/ClientAVFrame.vue'
import { onDisconnect, removeClientStream, setupMedia, clientConfigData } from "@/services/streamService";
import fetchWrapper from "@/utils/fetchWrapper.js";
import { useNotificationStore } from "@/stores/notification";
import router from "@/router";

const isHost = ref(false);
const hostId: Ref<string> = ref("");

const userstore = useUserdataStore()

const isLoggedIn = computed(() => userstore.isLoggedIn)

const sessionID = computed(() => {
  return useUserdataStore().sessionID;
});

const username = computed(() => {
  return useUserdataStore().username;
});

const mounted = ref(false);
interface Cursor {
  id: any;
  username: string;
  x_coord: Ref<number>;
  y_coord: Ref<number>;
}

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
const cursors: Ref<Cursor[]> = ref([]);
const cursorIds: string[] = [];
// null while no file has been uploaded
const file: Ref<Blob | null> = ref(null);
const documentReaderRef: Ref<typeof DocumentReader | null> = ref(null);
const sharedNotesRef: Ref<typeof SharedNote | null> = ref(null);

const notificationstore = useNotificationStore()

interface Data {
  request?: string,
  x?: number,
  y?: number,
  username?: string,
  file?: Blob,
  annotations?: any,
}

let socket: Socket;

// retrieves connection id of the current host
async function getHostId() {
  await fetchWrapper(`${import.meta.env.VITE_PUBLIC_BACKEND}/api/session/${sessionID.value}/host`,
    {
      credentials: 'include',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
  .then((data: {hostId: string}) => {
    hostId.value = data.hostId;
  }).catch(() => {
    // repeat while host is not available
    getHostId();
  })
}

onBeforeMount(async () => {
  if (!isLoggedIn.value) {
    await router.push({name: 'home'});
  }

  // opens socket connection to backend
  socket = io(`${import.meta.env.VITE_PUBLIC_SOCKET}`, {
    transports: ['websocket', 'polling', 'flashsocket'],
    withCredentials: true,
  });

  // This should never happen, but just in case
  if (socket === null) {
    console.error("Socket.IO connection not established.");
    return;
  }

  socket.on('connect', () => {
    console.log('Socket.IO connected with ID:', socket.id);
  });

  socket.on('connect_error', (err) => {
    console.error('Socket.IO connection error:', err);
  });

  // when a host joins, set them as the new host
  socket.on("new_host", (id) => {
    hostId.value = id;
    if (id === peer.id) {
      isHost.value = true;
    }
  });

  // when a host leaves, apply to be new host
  socket.on("host_left", () => {
    socket.emit("host_application", peer.id);
  });

  peer_init();

  // when a user connects to this session, create a new connection and initialize it
  socket.on("user_connection", (id) => {
    console.log("Another user connected to the session.");
    const conn = peer.connect(id);
    conn.on("open", () => {
      connection_init(conn);
      otherUsers.set(conn.peer, {conn: conn});
      // send your username to the other user
      conn.send({username: username.value});

      // send file if it exists and current user is the host
      if (isHost.value && file.value) {
        const fileReader = new FileReader();
        fileReader.onload = async () => {
          conn.send({file: fileReader.result});
        }
        fileReader.readAsArrayBuffer(file.value);
      }

      if (sharedNotesRef.value) {
        // send notes
        sharedNotesRef.value.transmit();
      } else {
        console.error("Shared notes component not available");
      }

    });
  });

  // when a user leaves this session, remove their cursor
  socket.on("user_disconnection", (id) => {
    if (otherUsers.get(id) === undefined) return;
    const index = conns.indexOf(otherUsers.get(id).conn);
    const peer_username = otherUsers.get(id).username;
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
    // Add notifiaction
    notificationstore.addNotification({message:`User ${peer_username || "unknown"} disconnected`});
  });
});

// modified from https://stackoverflow.com/questions/30738079/webrtc-peerjs-text-chat-connect-to-multiple-peerid-at-the-same-time
function connection_init(conn: Peer) {
  conns.push(conn);

  // each x_coord and y_coord is unique b/c of closure
  const x_coord = ref(0);
  const y_coord = ref(0);

  conn.on("data", async (data: Data) => {
    // reject if conn.peer is not in otherUsers
    if (!otherUsers.has(conn.peer)) return;

    if (data.username) {
      otherUsers.get(conn.peer).username = data.username;

      notificationstore.addNotification({message:`User ${data.username || "unknown"} connected`});
      return;
    }

    if (data.x && data.y && otherUsers.get(conn.peer).username) {
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
    }

    // only accept file from host for security purposes
    if (data.file) {
      await getHostId();
      if (conn.peer === hostId.value)
        file.value = new Blob([data.file]);
      return;
    }

    // Document reader related data below this line
    if (documentReaderRef.value) {

      if (data.annotations) {
        documentReaderRef.value.importAnnotations(data.annotations);
        return;
      }

      if (data.request) {
        if (data.request === "annotations") {
            documentReaderRef.value.sendAnnotationsTo(conn);
        }
      }
    }
  });

  conn.on("error", (error: string) => {
    console.log(error);
  });
}

function peer_init() {
  peer.on("open", (id: string) => {
    if (!socket) {
      console.error("Socket.IO connection not established.");
      return;
    }
    console.log("Joining session.", sessionID.value, id, username.value);
    socket.emit("join_session", sessionID.value, id, async () => {
      if (!socket) {
        console.error("Socket.IO connection not established.");
        return;
      }
      setupMedia(socket, username.value);
    });
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

function sendAnnotations(annotations: Annotation[]) {
  for (const conn of conns) {
    conn.send({annotations: annotations});
  }
}

function requestAnnotations() {
  // ask the host for annotations
  for (const conn of conns) {
    if (conn.peer === hostId.value) {
      conn.send({request: "annotations"});
      return;
    }
  }
}

function handleFileInput(e: Event) {
  if (!e.target) return ;

  const target = e.target as HTMLInputElement;
  if (target.files) {
    file.value = target.files[0];
  }

  const fileReader = new FileReader();
  fileReader.onload = async () => {
    for (const conn of conns)
      conn.send({file: fileReader.result});
  }

  if (file.value) fileReader.readAsArrayBuffer(file.value);
}

const isFile = computed(() => {
  return file.value !== null;
});

onBeforeUnmount(() => {
  if (socket) {
    socket.disconnect();
    onDisconnect();
  }
});
</script>

<template>
  <div>
    <h1 class="ml-2"><v-icon name='fa-users' class="scale-105"/> <span v-text="1 + otherUsers.size"/> Connected </h1>
    <CursorItem v-for="cursor in cursors" :username="cursor.username" :x_coord="cursor.x_coord" :y_coord="cursor.y_coord" style="z-index:100"/>
    <hr class="my-3" />
    <div class="flex flex-row m-5 mr-0">
      <div id="main-item" class="basis-2/3">
        <div v-if="mounted">
          <Teleport :disabled="!isFile" to="#top-side-item">
            <SharedNote id="notes" :socket="socket" :conns="conns" ref="sharedNotesRef" class="min-h-[50vh] flex flex-col"/>
          </Teleport>
        </div>
        <div v-if="isFile" id="viewer">
          <DocumentReader v-if="file" :file="file" ref="documentReaderRef" @sendAnnotations="sendAnnotations" @requestAnnotations="requestAnnotations"/>
        </div>
      </div>
      <div id="side-items" class="basis-1/3 ml-5 mr-5">
        <div id="temp-side-item" class="m-auto text-center" v-if="isHost && !isFile">
          <label id="pdf-input" class="a-href underline font-extrabold text-xl">
            <input type="file" @input="handleFileInput" name="upload" accept="application/pdf" class="hidden" />
            Upload PDF
          </label>
        </div>
        <div id="top-side-item" class="m-auto">
        </div>
      </div>
      <div id="video-chat" class="m-auto">
        <div class="flex flex-col gap-2 w-fit bg-slate-300 overflow-scroll h-[85vh]">
          <!-- For loop  -->
          <ClientAVFrame v-for="([key, data], index) in clientConfigData.entries()" :key="key" :data="data"/>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
#notes {
  height: calc(90vh - 80px);
}
</style>

