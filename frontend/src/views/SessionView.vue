<script setup lang="ts" type="module">
import {computed, onMounted, ref, useTemplateRef} from "vue";
import { Peer } from "https://esm.sh/peerjs@1.5.4?bundle-deps"
import { throttle } from 'throttle-debounce';
import { io } from "socket.io-client";
import CursorItem from "@/components/CursorItem.vue";
import DocumentReader from "@/components/DocumentReader.vue";

// true if user is host
let isHost = true; //false;
const sessionId = "";
const username = "";

// determines which view is currently in the main slot
let view = ref(0);
let mounted = ref(false);

const peer = new Peer();
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
const socket = io("wss://localhost:5173/session", {
  withCredentials: true,
});

// modified from https://stackoverflow.com/questions/30738079/webrtc-peerjs-text-chat-connect-to-multiple-peerid-at-the-same-time
function connection_init(conn) {
  conn.on("open", () => {
    // each x_coord and y_coord is unique b/c of closure
    const x_coord = ref(0);
    const y_coord = ref(0);

    conn.on("data", (data) => {
      // TODO use interpolation
      x_coord.value = data.x;
      y_coord.value = data.y;

      // if no cursor for this connection exists yet, create one
      if (!(conn.peer in itemRefs)) {
        cursors.value.push({
          id: conn.peer,
          username: otherUsers.get(conn.peer),
          x_coord: x_coord,
          y_coord: y_coord
        });
      }
    });
    conn.on("close", () => {
      // TODO security risk: a user can emit another user's id to get disconnect them
      socket.emit("leave_session", sessionId, id);
    });
    conn.on("error", (error) => {
      console.log(error);
    });
    conns.push(conn);
  });
}

function peer_init() {
  // when a user connects with you, initialize the connection
  peer.on("connection", (conn) => {
    connection_init(conn);
  });

  peer.on("open", (id) => {
    socket.emit("join_session", sessionId, id, username);
  });
}

onMounted(() => {
  mounted.value = true;
  peer_init();

  // when a user connects to this session, create a new connection
  // and initialize it.
  socket.on("user_connection", (id, username) => {
    otherUsers.set(id, username);
    const conn = peer.connect(id);
    connection_init(conn);
  });

  // when mouse is moved, broadcast mouse position to all connections
  // event is throttled to reduce load on connection
  onmousemove = (e) => {
    throttle(100, () => {
      for (let conn of conns) {
        conn.send({x: e.clientX, y: e.clientY});
      }
    });
  }
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
