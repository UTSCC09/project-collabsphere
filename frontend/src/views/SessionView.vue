<script setup lang="ts" type="module">
import {computed, onMounted, ref, useTemplateRef} from "vue";
import { Peer } from "https://esm.sh/peerjs@1.5.4?bundle-deps"
import { throttle } from 'throttle-debounce';
import { io } from "socket.io-client";
import CursorItem from "@/components/CursorItem.vue";
import DocumentReader from "@/components/DocumentReader.vue";

// true if user is host
let isHost = true; //false;
const sessionId = "1000b";
const username = Math.random().toString(36).substring(7);

const mounted = ref(false);

// TODO enable secure: true
const peer = new Peer({
  host: "/",
  port: 443,
  path: "app",
  proxied: true,
});

// list of all connections
const conns = [];
// list of all peers
const otherUsers = new Map();
// list of all cursors
const cursors = ref([]);
const itemRefs = useTemplateRef("items");

// null while no file has been uploaded
const file = ref(null);

// TODO change url below to backend
const socket = io("ws://localhost:3030", {
  transports: ['websocket', 'polling', 'flashsocket'],
  withCredentials: true,
});

// modified from https://stackoverflow.com/questions/30738079/webrtc-peerjs-text-chat-connect-to-multiple-peerid-at-the-same-time
function connection_init(conn) {
  conns.push(conn);

  // each x_coord and y_coord is unique b/c of closure
  const x_coord = ref(0);
  const y_coord = ref(0);

  console.log("Connection established.");
  conn.on("data", (data) => {
    if (data.file) {
      file.value = new Blob([data.file]);
      return;
    }

    // TODO use interpolation
    x_coord.value = data.x;
    y_coord.value = data.y;

    // if no cursor for this connection exists yet, create one
    if (!(conn.peer in itemRefs)) {
      // TODO find a way to make it so that username is not sent every time
      // TODO problem is those who connect to new user don't share username
      cursors.value.push({
        id: conn.peer,
        username: data.username,
        x_coord: x_coord,
        y_coord: y_coord
      });
    }
  });

  conn.on("error", (error) => {
    console.log(error);
  });
}

function peer_init() {
  peer.on("open", (id) => {
    console.log("Joining session.")
    socket.emit("join_session", sessionId, id, username);
  });

  // when a user connects with you, initialize the connection
  peer.on("connection", (conn) => {
    conn.on("open", () => {
      otherUsers.set(conn.peer, conn);
      connection_init(conn);
    });
  });

  peer.on("close", () => {
    socket.emit("leave_session");
  });
}

onMounted(() => {
  mounted.value = true;
  peer_init();

  // when a user connects to this session, create a new connection
  // and initialize it.
  socket.on("user_connection", (id, username) => {
    console.log("Another user connected to the session.");
    const conn = peer.connect(id);
    conn.on("open", () => {
      otherUsers.set(id, conn);
      connection_init(conn);
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
    const index = conns.indexOf(otherUsers.get(id));
    if (index !== -1) {
      conns.splice(index, 1);
      otherUsers.delete(id);

      for (let i = 0; i < cursors.value.length; i++) {
        if (cursors[i].id === id) {
          cursors.value.splice(i, 1);
        }
      }
    }
  });

  // when mouse is moved, broadcast mouse position to all connections
  function sendCursor(e, conns, username) {
    for (const conn of conns) {
      conn.send({ username: username, x: e.clientX / e.view.window.innerWidth, y: e.clientY / e.view.window.innerHeight });
    }
  }

  const throttledSendCursor = throttle(100, sendCursor, {
    noLeading: false,
    noTrailing: false,
  })

  // when mouse is moved, broadcast mouse position to all connections
  // event is throttled to reduce load on connection
  onmousemove = e => throttledSendCursor(e, conns, username)
});

function handleFileInput(e) {
  file.value = e.target.files[0];

  socket.emit("send_file", e.target.files[0]);
}

socket.on("send_file", (new_file) => {
  if (!file.value)
    file.value = new Blob([new_file]);
});

const isFile = computed(() => {
  return file.value !== null;
});

</script>

<template>
  <div>
    <CursorItem v-for="cursor in cursors" ref="items" :username="cursor.username" :x_coord="cursor.x_coord" :y_coord="cursor.y_coord" />
    <div class="flex h-5 m-2 mb-0">
      <p class="font-sans"><b>Session ID: </b>{{sessionId}}</p>
      <!-- copy.svg is licensed with https://opensource.org/license/mit -->
      <img src="../assets/copy.svg" class="flex-initial hover:opacity-50 ml-1" @click="navigator.clipboard.writeText(sessionId)" alt="Copy session id to clipboard">
    </div>
    <hr class="my-3" />
    <div class="flex flex-row m-5">
      <div id="main-item" class="basis-2/3">
        <div v-if="mounted">
          <Teleport :disabled="!isFile" to="#top-side-item">
            <p>MAIN</p>
          </Teleport>
        </div>
        <div v-if="isFile" id="viewer">
          <DocumentReader :file="file" />
        </div>
      </div>
      <div id="side-items" class="basis-1/3 ml-5">
        <div id="top-side-item" class="justify-self-center">
          <label id="pdf-input" v-if="isHost && !isFile" class="a-href underline font-extrabold text-xl">
            <input type="file" @input="handleFileInput" name="upload" accept="application/pdf" class="hidden" />
            Upload PDF
          </label>
        </div>
        <div id="bottom-side-item">
          <p>TEST</p>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
#viewer {
  border: 1px solid #ccc !important;
  width: 100%;
  height: calc(100vh - 80px);
  overflow-y: scroll;
}
</style>
