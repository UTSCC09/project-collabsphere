<!-- This is a temporary vue item to test Document reading and segmenting -->
<!-- Accept file as prop -->
<script setup lang="ts" type="module">
import {onMounted} from 'vue';
import * as pdfjsLib from "pdfjs-dist/build/pdf";
import * as pdfjsViewer from "pdfjs-dist/web/pdf_viewer.mjs"

const props = defineProps({
  file: Object
});

pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/build/pdf.worker.mjs"

const PAGE_TO_VIEW = 1;
const SCALE = 1.0;

const eventBus = new pdfjsViewer.EventBus();

async function getPdf() {
  const fileReader = new FileReader();

  fileReader.onload = async () => {
    const container = document.getElementById("pageContainer");

    const loadingTask = pdfjsLib.getDocument(new Uint8Array(fileReader.result));

    const pdf = await loadingTask.promise;
    const pdfPage = await pdf.getPage(PAGE_TO_VIEW);
    const pdfPageView = new pdfjsViewer.PDFPageView({
      container,
      id: PAGE_TO_VIEW,
      scale: SCALE,
      defaultViewport: pdfPage.getViewport({ scale: SCALE }),
      eventBus,
    });

    pdfPageView.setPdfPage(pdfPage);
    pdfPageView.draw();
  };

  fileReader.readAsArrayBuffer(props.file);
}

onMounted(() => {
  getPdf();
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

</style>
