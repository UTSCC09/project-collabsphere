<script setup lang="ts" type="module">
import { computed, onMounted, ref, Ref } from "vue";
import { Peer } from "https://esm.sh/peerjs@1.5.4?bundle-deps"
import { throttle } from 'throttle-debounce';
import { io } from "socket.io-client";
import CursorItem from "@/components/CursorItem.vue";
import DocumentReader from "@/components/DocumentReader.vue";
import { useUserdataStore } from "@/stores/userdata";
import SharedNote from "@/components/SharedNote.vue";

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

interface data {
  x?: number,
  y?: number,
  username?: string,
  file?: Blob
}

interface cursor {
  id: any;
  username: string;
  x_coord: Ref<number>;
  y_coord: Ref<number>;
}

// opens socket connection to backend
const socket = io(`${import.meta.env.VITE_PUBLIC_SOCKET}`, {
  transports: ['websocket', 'polling', 'flashsocket'],
  withCredentials: true,
});

socket.on('connect', () => {
  console.log('Socket.IO connected with ID:', socket.id);
});

socket.on('connect_error', (err) => {
  console.error('Socket.IO connection error:', err);
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
  });

  socket.on("send_file", (new_file) => {
    console.log("Received file from host.");
    console.log(new_file);
    if (!file.value) file.value = new Blob([new_file]);
  });

  // when mouse is moved, broadcast mouse position to all connections
  // event is throttled to reduce load on connection
  onmousemove = e => throttledSendCursor(e, conns);
});

function handleFileInput(e: Event) {
  if (!e.target) return ;

  const target = e.target as HTMLInputElement;
  if (target.files) {
    file.value = target.files[0];
  }
  console.log("Sending file to backend.");
  socket.emit("send_file", file.value);
}

const isFile = computed(() => {
  return file.value !== null;
});

</script>

<template>
  <div>
    <CursorItem v-for="cursor in cursors" :username="cursor.username" :x_coord="cursor.x_coord" :y_coord="cursor.y_coord" style="z-index:100"/>
    <hr class="my-3" />
    <div class="flex flex-row m-5">
      <div id="main-item" class="basis-2/3">
        <div v-if="mounted">
          <Teleport :disabled="!isFile" to="#top-side-item">
            <p>MAIN</p>
          </Teleport>
        </div>
        <div v-if="isFile" id="viewer">
          <DocumentReader v-if="file" :file="file" />
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
  </div>
</template>
<style scoped>
</style>
