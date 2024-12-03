<script  setup lang="ts" type="module">
import { useNotificationStore } from '@/stores/notification';
import { useUserdataStore } from '@/stores/userdata';
import { computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const router = useRouter()

const userstore = useUserdataStore()
const notificationstore = useNotificationStore()

const isLoggedIn = computed(() => userstore.isLoggedIn)
const { logout } = userstore

const route = useRoute();
const username = computed(() => userstore.username);

const isHost = computed(() => userstore.isHost);
const sessionID = computed(() => userstore.sessionID);

const isSessionRoute = computed(() => route.path === '/session');

function copySessionID() {
    navigator.clipboard.writeText(sessionID.value);
    notificationstore.addNotification({message:'Session ID copied to clipboard'});
}

async function handleLogout() {
    await logout();
    notificationstore.addNotification({message:'Logged out'});
    // Return to home page after logging out
    router.push('/');
}

// Redirect to home page if not logged in
watch(isLoggedIn, (value) => {
    if (!value) {
        router.push('/');
    }
});

onMounted(async () => {
    // Query /api/is-authenticated to check if user is logged in

    const response = await userstore.checkAuth();
    // Check if response is of type Error and that the message is "TypeError: Failed to fetch"
    if (response instanceof Error) {
        let message = response.message.toString();
        switch (message) {
            case "TypeError: Failed to fetch":
                message = "Failed to connect to server";
                break;
            case "Access token is missing or invalid":
                return;
                
            case "Invalid token":
                message = "Not authenticated. Please log in again";
                router.push('/');

                break;
            default:
                router.push('/');
        }

        notificationstore.addNotification({message});
    }
})

</script>

<template>
    <header>
        <router-link to="/" class=" hover:animate-pulse w-fit block"><h1 class="text-2xl w-fit">CollabSphere</h1></router-link>
        <div class="flex h-5 m-2 mb-0" v-if="sessionID && isSessionRoute">
          <p class="font-sans"><b>Session ID: </b>{{sessionID}}</p>
          <!-- copy.svg is licensed with https://opensource.org/license/mit -->
          <img src="../assets/copy.svg" class="flex-initial hover:opacity-50 ml-2" @click="copySessionID" alt="Copy session id to clipboard">
        </div>

        <div class="right-0 absolute top-0">
            <button v-if="isLoggedIn" class="btn-and-icon w-fit"
            @click="handleLogout"
            >
            <v-icon name="md-logout" />
            Log Out</button>
        </div>

    </header>
</template>
