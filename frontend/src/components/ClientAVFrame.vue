<script setup lang="ts">
import { ref } from 'vue'
import ClientAVMenu from './ClientAVMenu.vue'

const isMuted = ref(false)
const isVideoOff = ref(false)

function toggleMute() {
    isMuted.value = !isMuted.value
}

function toggleVideo() {
    isVideoOff.value = !isVideoOff.value
}
</script>

<template>
    <div class="bg-black fixed p-2 text-white rounded-md ">
        <h3 class="font-semibold inline-flex">Client Name</h3 class="font-semibold">
        <ClientAVMenu class=""/>
        <div class="w-44 h-24">

        </div>
        <div class="grid grid-cols-2 items-center gap-2">
            <button class="btn" :onclick="toggleMute">
                <v-icon v-if="isMuted" name="bi-mic-fill"/>
                <v-icon v-else name="bi-mic-mute-fill"/>
            </button>
            <button class="btn" :onclick="toggleMute">
                <v-icon v-if="isVideoOff" name="bi-camera-video-off-fill"/>
                <v-icon v-else name="bi-camera-video-fill"/>
            </button>
        </div>
    </div>

</template>