<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import type { Socket } from 'socket.io-client'
import ClientAVAudioBorder from './ClientAVAudioBorder.vue'

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
  toggleMute?: () => void
  toggleVideo?: () => void
  connected?: boolean
}
const video = ref<HTMLVideoElement | null>(null);

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
    if (!context) return;
    context.fillStyle = 'black';
    context.fillRect(0, 0, canvas.width, canvas.height);
    return canvas.captureStream().getVideoTracks()[0];
};

const pause_resume_cb = (data : {error: string}) => {
    if (data && data.error) {
        console.error(data.error)
    }
}

function toggleMute() {
    if (props.data.toggleMute) {
        props.data.toggleMute()
    }

    if (props.data.audioDisabled) {
        props.data.socket.emit('pause-producer', { 
            clientId: props.data.id,
            producerId: props.data.audioProducerId, 
            kind: 'audio'
        }, pause_resume_cb)

    } else {

        props.data.socket.emit('resume-producer', { 
            clientId: props.data.id,
            producerId: props.data.audioProducerId,
            kind: 'audio'
        }, pause_resume_cb)
    }
}

function toggleVideo() {
    if (props.data.toggleVideo) {
        props.data.toggleVideo()
    }

    if (props.data.videoDisabled) {
        props.data.stream.getVideoTracks().forEach((track) => {
            track.enabled = false;
        });

        props.data.socket.emit('pause-producer', { 
            clientId: props.data.id,
            producerId: props.data.producerId, 
            kind: 'video'
        }, pause_resume_cb)
    } else {
        props.data.stream.getVideoTracks().forEach((track) => {
            track.enabled = true;
        });
        props.data.socket.emit('resume-producer', { 
            clientId: props.data.id,
            producerId: props.data.producerId,
            kind: 'video'
         }, pause_resume_cb)
    }
}

watch(() => props.data.videoDisabled, (newVal) => {
    props.data.stream.getVideoTracks().forEach((track) => {
        track.enabled = !props.data.videoDisabled;
    });
    
    if (!video.value) return;
    if (props.data.videoDisabled) {
        const blackFrame = createBlackFrame();
        if (!blackFrame) return;
        video.value.srcObject = new MediaStream();
        video.value.srcObject.addTrack(blackFrame);
    } else {
        video.value.srcObject = props.data.stream;
    }
})

watch(() => props.data.audioDisabled, (newVal) => {
    props.data.stream.getAudioTracks().forEach((track) => {
        track.enabled = !props.data.audioDisabled;
    });
})

watch(() => props.data.stream, (newStream) => {
    if (video.value) {
        video.value.srcObject = newStream;
        
        if (props.data.isLocal) {
            props.data.stream.getAudioTracks().forEach((track) => {
                track.enabled = false;
            });
        }

    }
})

// Mounted
onMounted(async () => {
    if (video.value) {
        video.value.srcObject = props.data.stream;

        props.data.stream.getAudioTracks().forEach((track) => {
            track.enabled = !props.data.audioDisabled;
        });

        props.data.stream.getVideoTracks().forEach((track) => {
            track.enabled = !props.data.videoDisabled;
        });
    }
})


</script>

<template>
    <div class="bg-black w-64 text-white rounded-md overflow-clip relative " >
        <ClientAVAudioBorder
            :stream="props.data.stream"
            :audioProducerId="props.data.audioProducerId"
        />
        <button class="bg-black z-[50] w-full h-full hover:bg-slate-500" v-if="props.data.isLocal && !props.data.connected"
        :onclick="props.data.joinCall"
        >
        Join Call
        </button>
        <!-- <ClientAVMenu class="absolute z-[100] top-2 right-2"/> -->

        <div class="absolute w-full h-full flex z-[30] items-center justify-center gap-5">
        
            <v-icon v-if="props.data.videoDisabled" 
                name="bi-camera-video-off-fill" 
                class=" text-red-500 scale-150"/>

        </div>

        <div class="w-64 h-44 top-0 relative flex">
            <video ref="video" class="w-full h-full top-0 absolute left-0 rounded-lg scale-110"
            autoplay></video>
        </div>
        <div class="absolute top-2 left-2 w-full flex items-center">        
            <h3 class="font-semibold bg-black/50 backdrop w-fit -blur-sm px-2 select-none" v-text="props.data.username" ></h3 class="font-semibold">
            <v-icon v-if="props.data.audioDisabled" name="bi-mic-mute-fill" 
                class="z-[100] text-white bg-black/50"/>
        </div>

        <div class="flex items-center justify-center gap-2 relative z-[100] bg-black p-2" v-if="isMyself">
            <button :class="['btn', 'w-12', {'bg-slate-500': !props.data.audioDisabled,  'bg-red-900': props.data.audioDisabled}]" :onclick="toggleMute" >
                <v-icon v-if="props.data.audioDisabled" class="text-red-400 " name="bi-mic-mute-fill"/>
                <v-icon v-else name="bi-mic-fill"/>
            </button>
            <button :class="['btn', 'w-12', {'bg-slate-500': !props.data.videoDisabled, 'bg-red-900': props.data.videoDisabled}]" :onclick="toggleVideo">
                <v-icon v-if="props.data.videoDisabled" class="text-red-400" name="bi-camera-video-off-fill"/>
                <v-icon v-else name="bi-camera-video-fill"/>
            </button>
        </div>

    </div>

</template>