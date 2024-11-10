<script  setup lang="ts" type="module">
import { useNotificationStore } from '@/stores/notification';
import { useUserdataStore } from '@/stores/userdata';
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const userstore = useUserdataStore()
const notificationstore = useNotificationStore()

const isLoggedIn = computed(() => userstore.isLoggedIn)
const { login, logout } = userstore

const route = useRoute();
const isTestSessionRoute = computed(() => route.path === '/session');
const username = computed(() => userstore.username);

const isHost = computed(() => userstore.isHost);
const sessionID = computed(() => userstore.sessionID);

const isSessionRoute = computed(() => route.path === '/session');

function copySessionID() {
    navigator.clipboard.writeText(sessionID.value);
    notificationstore.addNotification({message:'Session ID copied to clipboard'});
}

</script>

<template>
    <header>
        <router-link to="/" class=" hover:animate-pulse"><h1 class="text-2xl">CollabSphere</h1></router-link>
        <p v-if="isLoggedIn" class="mr-2">Signed in as: {{ username }}</p>
        <div class="flex h-5 m-2 mb-0" v-if="sessionID && isSessionRoute">
          <p class="font-sans"><b>Session ID: </b>{{sessionID}}</p>
          <!-- copy.svg is licensed with https://opensource.org/license/mit -->
          <img src="../assets/copy.svg" class="flex-initial hover:opacity-50 ml-2" @click="copySessionID" alt="Copy session id to clipboard">
        </div>

        <div class="right-0 absolute top-0">
            <button v-if="isLoggedIn" class="btn-and-icon w-fit"
            @click="logout"
            >
            <v-icon name="md-logout" />
            Log Out</button>
        </div>

    </header>
</template>
