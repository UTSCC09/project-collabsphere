<script setup lang="ts">
import { computed, ref } from 'vue';
import LoginItem from '../components/LoginItem.vue'
import { useUserdataStore } from '@/stores/userdata';
import { useRouter } from 'vue-router';
// @ts-ignore
import fetchWrapper from '@/utils/fetchWrapper';

const userstore = useUserdataStore()

const isLoggedIn = computed(() => userstore.isLoggedIn)

const router = useRouter()

function createSession() {
  fetchWrapper(`${import.meta.env.VITE_PUBLIC_BACKEND}/api/session`,
    {
      credentials: 'include',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
  .then((data: {sessionId: string}) => {
      userstore.hostSession(data.sessionId)
      // Jump to session view
      router.push('/session')
    }).catch(() => {})
}

const sessionID = ref('')
const sessionID_error = ref('')

function joinSession() {
  sessionID_error.value = ''
  fetchWrapper(`${import.meta.env.VITE_PUBLIC_BACKEND}/api/session/${sessionID.value}`,
    {
      credentials: 'include',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  ).then((data: {session: {_id: string}}) => {
      if (!data.session || !data.session._id) {
        sessionID_error.value = 'Session not found'
        return
      }

      userstore.joinSession(data.session._id)
      // Jump to session view
      router.push('/session')
    }).catch(() => {})
}


</script>

<template>


  <main v-if="!isLoggedIn">
    <h1>You need an account to enjoy CollabSphere</h1>
    <LoginItem />
  </main>
  <main v-else class="flex w-full lg:w-1/3 flex-1 ml-auto mr-auto items-center justify-center text-center">
    <div class="gap-2 flex flex-col">
    <h1 class="text-2xl font-bold">Collaborate</h1>
    <p class="text-xl">Host your own session or join a friend!</p>
    <br class="my-4"/>
    <button class="btn-and-icon"
      @click="createSession"
    ><v-icon name="io-create"/> Create Session</button>

    <div class="grid grid-cols-9 gap-2">
    <input type="text" placeholder="Session ID" class="form-input col-span-6" v-model="sessionID"/>
    <button class="btn-and-icon bg-gray-300 text-black col-span-3 disabled:opacity-60"
      @click="joinSession"
      :disabled="!sessionID"
    >
    <v-icon name="bi-box-arrow-in-right"/>Join</button>
  </div>

    <p class="text-red-500">{{sessionID_error}}</p>

    </div>
    
  </main>
</template>
