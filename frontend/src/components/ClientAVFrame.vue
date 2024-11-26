<script setup lang="ts">
import { onMounted, ref, type Ref } from 'vue'
import ClientAVMenu from './ClientAVMenu.vue'

const isMuted = ref(false)
const isVideoOff = ref(false)


function toggleMute() {
    isMuted.value = !isMuted.value

    if (isMuted.value) {
        video.value.srcObject.getAudioTracks().forEach((track) => {
            track.enabled = false;
        });
    } else {
        video.value.srcObject.getAudioTracks().forEach((track) => {
            track.enabled = true;
        });
    }
}

function toggleVideo() {
    isVideoOff.value = !isVideoOff.value

    if (isVideoOff.value) {
        video.value.srcObject.getVideoTracks().forEach((track) => {
            track.enabled = false;
        });
    } else {
        video.value.srcObject.getVideoTracks().forEach((track) => {
            track.enabled = true;
        });
    }
}

const video: Ref<HTMLVideoElement | null> = ref(null)

async function sourceSelected(audioSource: string, videoSource: string) {
    const constraints = {
        audio: { deviceId: audioSource },
        video: { deviceId: videoSource, 
            width: { min: 160, ideal: 270, max: 640 },
            height: { min: 240, ideal: 480, max: 480 }  }, };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);

    if (video.value) {
        video.value.srcObject = stream;
    }
}

// Mounted
onMounted(async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const devices = await navigator.mediaDevices.enumerateDevices();

        let audioSource: string | null = null;
        let videoSource: string | null = null;

        devices.forEach((device) => {
            if (device.kind === "audioinput") {
                audioSource = device.deviceId;
            } else if (device.kind === "videoinput") {
                videoSource = device.deviceId;
            }
        });

        sourceSelected(audioSource, videoSource);
    } catch (err) {
        if (err.name === "NotFoundError") {
            console.log("No media devices found.");
        } else {
            console.error(`${err.name}: ${err.message}`);
        }
        alert("navigator.mediaDevices.getUserMedia() is not supported or an error occurred.");
    }
})

</script>

<template>
    <div class="bg-black fixed text-white rounded-md overflow-clip ">
        <ClientAVMenu class="absolute z-[100] top-2 right-2"/>
        <div class="w-64 h-44 top-0 relative">
            <video ref="video" class="w-full h-full top-0 absolute left-0 rounded-lg scale-110 -z-10" autoplay></video>
        </div>
        <h3 class="font-semibold absolute top-2 left-8 bg-black/50 backdrop -blur-sm px-2 ">Client Name</h3 class="font-semibold">
        <div class="flex items-center justify-center gap-2 z-[100] bg-black p-2">
            <button :class="['btn', 'w-12', {'bg-red-900': isMuted}]" :onclick="toggleMute" >
                <v-icon v-if="isMuted" class="text-red-400 " name="bi-mic-mute-fill"/>
                <v-icon v-else name="bi-mic-fill"/>
            </button>
            <button :class="['btn', 'w-12', {'bg-red-900': isVideoOff}]" :onclick="toggleVideo">
                <v-icon v-if="isVideoOff" class="text-red-400" name="bi-camera-video-off-fill"/>
                <v-icon v-else name="bi-camera-video-fill"/>
            </button>
        </div>
    </div>

</template>