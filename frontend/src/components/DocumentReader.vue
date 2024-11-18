
<!-- This is a temporary vue item to test Document reading and segmenting -->
<!-- Accept file as prop -->
<script setup lang="ts" type="module">
import {onMounted, ref} from 'vue';
// @ts-expect-error
import { TsPdfViewer, TsPdfViewerOptions } from "ts-pdf";

const props = defineProps({
  file: {
    type: Blob,
    required: true,
  },
});

async function run(): Promise<void> {
  const options: TsPdfViewerOptions = {
    containerSelector: "#pageContainer",
    workerSource: "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/build/pdf.worker.mjs",
    // you can check other properties using your editor hints
  };
  const viewer = new TsPdfViewer(options);
  await viewer.openPdfAsync(props.file);
}

onMounted(() => {
  run();
});

</script>
<template>
  <div id="pageContainer" class="pdfViewer singlePageView"></div>
  <!--
  <iframe src="https://mozilla.github.io/pdf.js/web/viewer.html?file=compressed.tracemonkey-pldi-09.pdf" width="100%" height="100%" frameborder="0" />
  -->
</template>

<style>
@import "pdfjs-dist/web/pdf_viewer.css";

#toolbar {
  border: 1px solid #ccc !important;
  border-bottom: 0 !important;
  width: 100%;
}

#pageContainer {
  border: 1px solid #ccc !important;
  width: 100%;
  height: calc(87.5vh - 80px);
  overflow-y: scroll;
}
</style>
