<script setup lang="ts" type="module">
import {computed, onMounted, ref, useTemplateRef} from "vue";
import { Peer } from "https://esm.sh/peerjs@1.5.4?bundle-deps"
import { throttle } from 'throttle-debounce';
import { io } from "socket.io-client";
import CursorItem from "@/components/CursorItem.vue";
import DocumentReader from "@/components/DocumentReader.vue";

import { useUserdataStore } from "@/stores/userdata";


// true if user is host
const isHost = computed(() => {
  return useUserdataStore().isHost;
});

const sessionID = computed(() => {
  return useUserdataStore().sessionID;
});

const username = Math.random().toString(36).substring(7);

// determines which view is currently in the main slot
let view = ref(0);
let mounted = ref(false);

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

const socket = io(`ws://${import.meta.env.VITE_PUBLIC_BACKEND}/api/session/${sessionID}`, {
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
    for (let conn of conns) {
      conn.send({ username: username, x: e.clientX, y: e.clientY })
    }
  }

  const throttledSendCursor = throttle(50, sendCursor, {
    noLeading: false,
    noTrailing: false,
  })

  // when mouse is moved, broadcast mouse position to all connections
  // event is throttled to reduce load on connection
  onmousemove = e => throttledSendCursor(e, conns, username)
});


function handleFileInput(e) {
  console.log(e.target.files[0]);
  file.value = e.target.files[0];

  // switch DocumentReader to main
  view.value = 1;
}

const isTextMain = computed(() => {
  return view.value === 0;
});

const isDocumentMain = computed(() => {
  return view.value === 1;
});

const isChatMain = computed(() => {
  return view.value === 2;
});

</script>

<template>
  <div>
    <CursorItem v-for="cursor in cursors" ref="items" :username="cursor.username" :x_coord="cursor.x_coord" :y_coord="cursor.y_coord" />
    <div class="flex h-5 m-2 mb-0">
      <p class="font-sans"><b>Session ID: </b>{{sessionId}}</p>
      <!-- copy.svg is licensed with https://opensource.org/license/mit -->
      <img src="../assets/copy.svg" class="flex-initial hover:opacity-50" @click="navigator.clipboard.writeText(sessionId)" alt="Copy session id to clipboard">
    </div>
    <hr class="my-3" />
    <div class="flex flex-row m-5">
      <div id="main-item" class="basis-2/3">
        <div v-if="mounted">
          <Teleport :disabled="isTextMain" to="#top-side-item">
            <p @click="view = 0">MAIN</p>
          </Teleport>
        </div>
      </div>
      <div id="side-items" class="basis-1/3 ml-5">
        <div id="top-side-item">
          <div v-if="mounted">
            <Teleport :disabled="!isDocumentMain" to="#main-item">
              <div id="pdf-viewer">
                <label id="pdf-input" v-if="isHost && !file" class="file_upload btn">
                  <input type="file" @input="handleFileInput" name="upload" accept="application/pdf" class="hidden" />
                  Upload PDF
                </label>
                <div v-else-if="file">
                  <p v-if="!isDocumentMain" @click="view = 1" id="expand">⛶</p>
                  <DocumentReader :file="file" />
                </div>
              </div>
            </Teleport>
          </div>
        </div>
        <div id="bottom-side-item">
          <div v-if="mounted">
            <Teleport :disabled="!isChatMain" to="#main-item">
              <p @click="view = 2">TEST</p>
            </Teleport>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
#expand {
  background-color: #43ac8a;
  color: floralwhite;
  display: inline-block;
  -moz-border-radius-bottomright: 3px;
  border-bottom-right-radius: 3px;
  position: absolute;
}
</style>
