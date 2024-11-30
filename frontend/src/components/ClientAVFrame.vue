<script setup lang="ts">
import { computed, onMounted, ref, watch, type Ref } from 'vue'
import type { Socket } from 'socket.io-client'
import ClientAVMenu from './ClientAVMenu.vue'
import { useUserdataStore } from '@/stores/userdata';

const userdata = useUserdataStore();

const isMuted = ref(false)
const isVideoOff = ref(false)

export interface ClientStreamData {
  id: string
  producerId: string
  audioProducerId?: string
  username: string
  audioDisabled?: boolean
  videoDisabled?: boolean
  stream: MediaStream
  socket: Socket
  isLocal?: boolean
  joinCall?: (data: any) => void
  connected?: boolean
}

const props = defineProps<{
    data: ClientStreamData
}>();

const isMyself = computed(() => {
    if (!props.data.isLocal) {
        return false
    }
    return true
})

const createBlackFrame = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 640; // Set the width of the black frame
  canvas.height = 480; // Set the height of the black frame
  const context = canvas.getContext('2d');
  context.fillStyle = 'black';
  context.fillRect(0, 0, canvas.width, canvas.height);
  return canvas.captureStream().getVideoTracks()[0];
};

function toggleMute() {
    isMuted.value = !isMuted.value

    if (isMuted.value) {
        props.data.stream.getAudioTracks().forEach((track) => {
            track.enabled = false;
        });

        props.data.socket.emit('pause-producer', { 
            clientId: props.data.id,
            producerId: props.data.audioProducerId, 
            kind: 'audio'
        }, (data)=>{})

    } else {
        props.data.stream.getAudioTracks().forEach((track) => {
            track.enabled = true;
        });

        props.data.socket.emit('resume-producer', { 
            clientId: props.data.id,
            producerId: props.data.audioProducerId,
            kind: 'audio'
        }, (data)=>{})
    }
}

function toggleVideo() {
    isVideoOff.value = !isVideoOff.value

    if (isVideoOff.value) {
        props.data.stream.getVideoTracks().forEach((track) => {
            track.enabled = false;
        });

        console.log('pausing video')
        props.data.socket.emit('pause-producer', { 
            clientId: props.data.id,
            producerId: props.data.producerId, 
            kind: 'video'
        }, (data)=>{})
    } else {
        props.data.stream.getVideoTracks().forEach((track) => {
            track.enabled = true;
        });
        props.data.socket.emit('resume-producer', { 
            clientId: props.data.id,
            producerId: props.data.producerId,
            kind: 'video'
         }, (data)=>{})
    }
}

const video = ref<HTMLVideoElement | null>(null);

watch(() => props.data.videoDisabled, (newVal) => {
    isVideoOff.value = newVal || false
    props.data.stream.getVideoTracks().forEach((track) => {
        track.enabled = !isVideoOff.value;
    });

    if (!video.value) return;

    if (isVideoOff.value) {
        const blackFrame = createBlackFrame();
        video.value.srcObject = new MediaStream([blackFrame]);
    } else {
        video.value.srcObject = props.data.stream;
    }
})

watch(() => props.data.audioDisabled, (newVal) => {
    isMuted.value = newVal || false
    props.data.stream.getAudioTracks().forEach((track) => {
        track.enabled = !isMuted.value;
    });
})

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
        <button class="bg-black z-[100] w-full h-full hover:bg-slate-500" v-if="props.data.isLocal && !props.data.connected"
            :onclick="props.data.joinCall"
        >
            Join Call
        </button>
        <ClientAVMenu class="absolute z-[100] top-2 right-2"/>

        <div class="absolute w-full h-full flex items-center justify-center gap-5">
            
            <v-icon v-if="isVideoOff" 
                name="bi-camera-video-off-fill" 
                class="z-[100] text-red-500 scale-150"/>

        </div>

        <div class="w-64 h-44 top-0 relative flex">
            <video ref="video" class="w-full h-full top-0 absolute left-0 rounded-lg scale-110"
            autoplay></video>
        </div>
        <div class="absolute top-2 left-2 w-full flex items-center">        
            <h3 class="font-semibold bg-black/50 backdrop w-fit -blur-sm px-2 select-none" v-text="props.data.username" ></h3 class="font-semibold">
            <v-icon v-if="isMuted" name="bi-mic-mute-fill" 
                class="z-[100] text-white bg-black/50"/>
        </div>

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