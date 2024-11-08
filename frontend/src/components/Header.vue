<script  setup lang="ts" type="module">
import { useUserdataStore } from '@/stores/userdata';
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const props = defineProps({
    sessionId: {
        type: String,
        default: '123123'
    }
});

const userstore = useUserdataStore()

const isLoggedIn = computed(() => userstore.isLoggedIn)
const { login, logout } = userstore

const route = useRoute();
const isTestSessionRoute = computed(() => route.path === '/test-session');

</script>


<template>
    <header>
        <router-link to="/" class=" hover:animate-pulse"><h1 class="text-2xl">CollabSphere</h1></router-link>
        <div class="flex h-5 m-2 mb-0" v-if="props.sessionId">
        <p class="font-sans"><b>Session ID: </b>{{sessionId}}</p>
        <img src="../assets/copy.svg" class="flex-initial hover:opacity-50 ml-2" @click="navigator.clipboard.writeText(sessionId)" alt="Copy session id to clipboard">
        </div>

    <div class="flex gap-2 mt-2 items-center">
        <p>temporary controls</p>
        <button v-if="isLoggedIn" class="btn w-fit"
        @click="logout"
        >Log Out</button>
        <button v-else class="btn w-fit"
        @click="login"
        >Log In</button>

        <!-- Router link to test-session -->

        <router-link to="/test-session" class="btn w-fit" v-if="!isTestSessionRoute">Test Session</router-link>
        <router-link to="/" class="btn w-fit" v-else>Home</router-link>
    </div>
    </header>
</template>