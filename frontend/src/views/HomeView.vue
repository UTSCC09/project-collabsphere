<script setup lang="ts">
import { computed, ref } from 'vue';
import LoginItem from '../components/LoginItem.vue'
import { useUserdataStore } from '@/stores/userdata';
import { useRouter } from 'vue-router';
const userstore = useUserdataStore()

const isLoggedIn = computed(() => userstore.isLoggedIn)
const sessionID = ref('')

const router = useRouter()

function createSession() {
  console.log('Create session')
  fetch(`${import.meta.env.VITE_PUBLIC_BACKEND}/api/session`,
    {
      credentials: 'include',
      method: 'GET',    
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
    .then(res => res.json())
    .then(data => {
      console.log(data)
      userstore.hostSession(data.sessionId)
      // Jump to session view
      router.push('/session')
    })

}

function joinSession() {

  fetch(`${import.meta.env.VITE_PUBLIC_BACKEND}/api/session/${sessionID.value}`,
    {
      credentials: 'include',
      method: 'GET',    
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
    .then(res => res.json())
    .then(data => {
      console.log(data)
      userstore.joinSession(data.session._id)
      // Jump to session view
      router.push('/session')
    })
}

</script>

<template>
  <main v-if="!isLoggedIn">
    <h1>You need an account to enjoy CollabSphere</h1>
    <LoginItem />
  </main>
  <main v-else class="flex w-full lg:w-1/3 h-full ml-auto mr-auto items-center justify-center text-center">
    <div class="gap-2 flex flex-col">
    <h1 class="text-2xl font-bold">Collaborate</h1>
    <p class="text-xl">Host your own session or join a friend!</p>
    <br class="my-4"/>
    <button class="btn-and-icon"
      @click="createSession"
    ><v-icon name="io-create"/> Create Session</button>


    <input type="text" class="input" placeholder="Session ID" v-model="sessionID" />

    <button class="btn-and-icon bg-gray-300 text-black"
      @click="joinSession"
      :disabled="!sessionID"
    ><v-icon name="bi-box-arrow-in-right"/>Join Session</button>

    </div>
  </main>

</template>
