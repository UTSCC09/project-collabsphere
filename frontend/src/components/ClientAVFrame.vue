<script setup lang="ts">
import { computed, onMounted, ref, watch, type Ref } from 'vue'
import type { Socket } from 'socket.io-client'
import ClientAVMenu from './ClientAVMenu.vue'
import { useUserdataStore } from '@/stores/userdata';

/*


  const mediaStreamSource = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  mediaStreamSource.connect(analyser);

  const dataArray = new Uint8Array(analyser.frequencyBinCount);

  function monitorParticipant() {
    analyser.getByteTimeDomainData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const value = (dataArray[i] - 128) / 128;
      sum += value * value;
    }
    const volume = Math.sqrt(sum / dataArray.length);
    const isSpeaking = volume > 0.05;

    const streamBox = document.getElementById(`participant-${index}`); // Replace with actual IDs
    if (isSpeaking) {
      streamBox.classList.add('highlight');
    } else {
      streamBox.classList.remove('highlight');
    }

    requestAnimationFrame(monitorParticipant);
  }

  monitorParticipant();

  */

export interface ClientStreamData {
  id: string
  producerId: string
  audioProducerId?: string
  username: string
  audioDisabled: boolean
  videoDisabled: boolean
  stream: MediaStream
  socket: Socket
  isLocal?: boolean
  joinCall?: (data: any) => void
  toggleMute?: () => void
  toggleVideo?: () => void
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

let audioContext;
let analyser;

try {
    audioContext = new AudioContext();
    analyser = audioContext.createAnalyser();
} catch (e) {
    console.log(e)
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
        }, (data)=>{})

    } else {

        props.data.socket.emit('resume-producer', { 
            clientId: props.data.id,
            producerId: props.data.audioProducerId,
            kind: 'audio'
        }, (data)=>{})
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

const isSpeaking = ref(false);
const video = ref<HTMLVideoElement | null>(null);
let mediaStreamSource;
const FFT_SIZE = 256;

if (analyser) {
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    function checkAudioActivity() {
        if (!analyser) return;

        analyser.getByteTimeDomainData(dataArray);

        // Calculate the root mean square (RMS) volume
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            const value = (dataArray[i] - 128) / 128;
            sum += value * value;
        }

        const volume = Math.sqrt(sum / dataArray.length);

        const threshold = 0.01;
        isSpeaking.value = volume > threshold;

        requestAnimationFrame(checkAudioActivity); // Continuous monitoring
    }

    checkAudioActivity();
}

watch(() => props.data.videoDisabled, (newVal) => {
    props.data.stream.getVideoTracks().forEach((track) => {
        track.enabled = !props.data.videoDisabled;
    });
    
    if (!video.value) return;
    if (props.data.videoDisabled) {
        const blackFrame = createBlackFrame();
        video.value.srcObject = new MediaStream([blackFrame]);
    } else {
        video.value.srcObject = props.data.stream;
    }
})

watch(() => props.data.audioDisabled, (newVal) => {
    // Resume audio context
    if (!props.data.audioDisabled) {
        audioContext = new AudioContext();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = FFT_SIZE;
        mediaStreamSource = audioContext.createMediaStreamSource(props.data.stream);
        mediaStreamSource.connect(analyser);
    } else {
        if (audioContext) audioContext.close();
    }
    props.data.stream.getAudioTracks().forEach((track) => {
        track.enabled = !props.data.audioDisabled;
    });
})

watch(() => props.data.stream, (newStream) => {
    if (video.value) {
        video.value.srcObject = newStream;


        props.data.stream.getAudioTracks().forEach((track) => {
            track.enabled = false;
        });

        audioContext = new AudioContext();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = FFT_SIZE;
        mediaStreamSource = audioContext.createMediaStreamSource(props.data.stream);
        mediaStreamSource.connect(analyser);
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
        <div :class="['absolute z-[110] w-full h-full border-blue-500 box-border transition-all pointer-events-none', {'border-4': isSpeaking}]"></div>
        
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