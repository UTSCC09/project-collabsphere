<script setup lang="ts" type="module">

import { ref, onBeforeUnmount, onMounted, watch, type Ref} from 'vue';

const props = defineProps<{
    stream: MediaStream,
    audioProducerId?: string
}>()


// Number of samples to take for the audio border (values must be 2^x)
const FFT_SIZE = 256;

// Threshold for the audio border to be active
const threshold = 0.01;

const samples = ref<Uint8Array>();
const isSpeaking = ref(false);
let audioContext: Ref<AudioContext> = ref(new AudioContext());
let analyser: Ref<AnalyserNode | undefined> = ref();
let mediaStreamSource: Ref<MediaStreamAudioSourceNode | undefined> = ref();

/* Function to continuously monitor the audio input. 
    If the volume exceeds the threshold, the border will be active. */
function audio_step() {
    // Check that the audio context is not suspended
    if (audioContext.value.state === 'suspended') {
        audioContext.value.resume();
    }

    const analyser = getAnalyser();
    if (!samples.value || !analyser) return;

    analyser.getByteTimeDomainData(samples.value);

    let sum = samples.value.reduce((acc, val) => 
        acc + ( (val - 128) / 128 ) ** 2, 0);

    const volume = Math.sqrt(sum / samples.value.length);
    isSpeaking.value = volume > threshold;
    
    requestAnimationFrame(audio_step); // Continuous monitoring
}

/*  Return analyser node or create a new one. 
    Resumes the audio context if it was suspended. */
const getAnalyser = () => {
    // Check that audio context is resumed
    if (audioContext.value.state === 'suspended') {
        audioContext.value.resume();
    }

    let analyserInstance = analyser.value;

    if (!analyserInstance) {
        analyserInstance = audioContext.value.createAnalyser();
        analyserInstance.fftSize = FFT_SIZE;

        samples.value = new Uint8Array(analyserInstance.frequencyBinCount);
        analyser.value = analyserInstance;
    }
    
    return analyserInstance;
}

// Watch for changes in the audio producer ID
watch(() => props.audioProducerId, (newId) => {
    if (mediaStreamSource.value) {
        mediaStreamSource.value.disconnect();
    }
    if (props.stream && props.stream.getAudioTracks().length > 0) {
        mediaStreamSource.value = audioContext.value.createMediaStreamSource(props.stream);
        mediaStreamSource.value.connect(getAnalyser());
    }
})

onMounted(() => {
    audio_step();

    // If a stream was provided, connect it to the analyser
    if (props.stream && props.stream.getAudioTracks().length > 0) {
        mediaStreamSource.value = audioContext.value.createMediaStreamSource(props.stream);
        mediaStreamSource.value.connect(getAnalyser());
    }
})

onBeforeUnmount(() => {
    if (mediaStreamSource.value) {
        mediaStreamSource.value.disconnect();
    }
    if (audioContext.value) {
        audioContext.value.close();
    }
})

</script>

<template>
    <div :class="['absolute z-[110] w-full h-full border-blue-500 box-border transition-all pointer-events-none', {'border-4': isSpeaking}]"></div>
</template>