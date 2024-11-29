<script setup lang="ts">
import { computed, onMounted, ref, watch, type Ref } from 'vue'
import type { Socket } from 'socket.io-client'
import ClientAVMenu from './ClientAVMenu.vue'
import { useUserdataStore } from '@/stores/userdata';

const userdata = useUserdataStore();

const isMuted = ref(false)
const isVideoOff = ref(false)

const props = defineProps<{
    data: {
        'id?': string;
        username: string;
        audioSource: string;
        videoSource: string;
        stream: MediaStream;
        isLocal?: boolean;
    }
    socket: Ref<Socket | null>;
}>();

const isMyself = computed(() => {
    if (!props.data.isLocal) {
        return false
    }
    return true
})

function toggleMute() {
    isMuted.value = !isMuted.value

    if (isMuted.value) {
        props.data.stream.getAudioTracks().forEach((track) => {
            track.enabled = false;
        });
    } else {
        props.data.stream.getAudioTracks().forEach((track) => {
            track.enabled = true;
        });
    }
}

function toggleVideo() {
    isVideoOff.value = !isVideoOff.value

    if (isVideoOff.value) {
        props.data.stream.getVideoTracks().forEach((track) => {
            track.enabled = false;
        });
    } else {
        props.data.stream.getVideoTracks().forEach((track) => {
            track.enabled = true;
        });
    }
}


const video = ref<HTMLVideoElement | null>(null);

watch(() => props.data.stream, (newStream) => {
    if (video.value) {
        video.value.srcObject = newStream;
    }
})
// Mounted
onMounted(async () => {
    if (video.value) {
        video.value.srcObject = props.data.stream;
    }
})



</script>

<template>
    <div class="bg-black w-64 text-white rounded-md overflow-clip relative" >
        <ClientAVMenu class="absolute z-[100] top-2 right-2"/>
        <div class="w-64 h-44 top-0 relative">
            <video ref="video" class="w-full h-full top-0 absolute left-0 rounded-lg scale-110 " autoplay></video>
        </div>
        <h3 class="font-semibold absolute top-2 left-2   bg-black/50 backdrop -blur-sm px-2" v-text="props.data.username" ></h3 class="font-semibold">
        <div class="flex items-center justify-center gap-2 relative z-[100] bg-black p-2" v-if="isMyself">
            <button :class="['btn', 'w-12', {'bg-slate-500': !isMuted,  'bg-red-900': isMuted}]" :onclick="toggleMute" >
                <v-icon v-if="isMuted" class="text-red-400 " name="bi-mic-mute-fill"/>
                <v-icon v-else name="bi-mic-fill"/>
            </button>
            <button :class="['btn', 'w-12', {'bg-slate-500': !isVideoOff, 'bg-red-900': isVideoOff}]" :onclick="toggleVideo">
                <v-icon v-if="isVideoOff" class="text-red-400" name="bi-camera-video-off-fill"/>
                <v-icon v-else name="bi-camera-video-fill"/>
            </button>
        </div>
    </div>

</template>