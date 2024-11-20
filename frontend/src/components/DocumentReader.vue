
<!-- This is a temporary vue item to test Document reading and segmenting -->
<!-- Accept file as prop -->
<script setup lang="ts" type="module">
import {onMounted} from 'vue';
// @ts-expect-error
import { TsPdfViewer, TsPdfViewerOptions } from "ts-pdf";
import {throttle} from "throttle-debounce";

const props = defineProps({
  file: {
    type: Blob,
    required: true,
  },
});

const emits = defineEmits(["sendAnnotations"]);

let viewer = null;

async function sendAnnotations() {
  const annotations = await viewer.exportAnnotationsAsync()
  // send the annotations to the other users
  emits("sendAnnotations", annotations);
}

async function importAnnotations(annotations) {
  await viewer.importAnnotationsAsync(annotations);
}

const throttledSendAnnotations = throttle(100, sendAnnotations, {
  noLeading: false,
  noTrailing: true,
});

async function run(): Promise<void> {
  const options: TsPdfViewerOptions = {
    containerSelector: "#pageContainer",
    workerSource: "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/build/pdf.worker.mjs",
    annotChangeCallback: throttledSendAnnotations,
  };
  viewer = new TsPdfViewer(options);
  await viewer.openPdfAsync(props.file);
}

onMounted(() => {
  run();
});

defineExpose({
  importAnnotations,
});
</script>

<template>
  <div id="pageContainer" class="pdfViewer singlePageView"></div>
</template>

<style>
#pageContainer {
  border: 1px solid #ccc !important;
  width: 100%;
  height: calc(87.5vh - 80px);
  overflow-y: scroll;
}
</style>
