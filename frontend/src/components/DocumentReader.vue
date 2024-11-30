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
  conns: {
    type: Object,
    required: true,
  }
});

const emits = defineEmits(["sendAnnotations"]);

let viewer = null;
let current_annotations = [];

// disabled and sending prevent infinite loop of importing and sending annotations
async function sendAnnotations() {
  let annotations = await viewer.exportAnnotationsAsync();
  // only send new annotations
  annotations = annotations.filter((annotation) => {
    for (const current_annotation of current_annotations.values())
      if (current_annotation.uuid === annotation.uuid) return false;
    return true;
  });
  console.log(annotations);
  if (annotations.length > 0) {
    current_annotations = current_annotations.concat(annotations);
    console.log(current_annotations);
    // send the annotations to the other users
    emits("sendAnnotations", annotations);
  }
}

// sends annotations to a single connection (useful for when a new user joins)
async function sendAnnotationsTo(connection) {
  const annotations = await viewer.exportAnnotationsAsync();
  connection.send({annotations: annotations});
}

async function importAnnotations(annotations) {
  // remove annotations that already exist in current_annotations
  annotations = annotations.filter((annotation) => {
    for (const current_annotation of current_annotations.values())
      if (current_annotation.uuid === annotation.uuid) return false;
    return true;
  });

  if (annotations.length > 0) {
    current_annotations = current_annotations.concat(annotations);
    await viewer.importAnnotationsAsync(annotations);
  }
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

  // TODO change random connection to host
  // TODO technically a race condition but unlikely to ever be a problem
    // e.g. this code is reached before the connection is established
  // choose a random connection and ask for the annotations
  if (props.conns[0]) {
    props.conns[0].send({request: "annotations"});
  }
}

onMounted(() => {
  run();
});

defineExpose({
  importAnnotations,
  sendAnnotationsTo,
});
</script>

<template>
  <div id="pageContainer" class="pdfViewer singlePageView"></div>
</template>

<style>
#pageContainer {
  border: 1px solid #ccc !important;
  width: 100%;
  height: calc(93.5vh - 80px);
  overflow-y: scroll;
}
</style>
