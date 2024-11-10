
<!-- This is a temporary vue item to test Document reading and segmenting -->
<!-- Accept file as prop -->
<script setup lang="ts" type="module">
import {onMounted, ref} from 'vue';
// @ts-expect-error
import * as pdfjsLib from "pdfjs-dist/build/pdf";
import * as pdfjsViewer from "pdfjs-dist/web/pdf_viewer.mjs"
import { PDFPageView } from 'pdfjs-dist/web/pdf_viewer.mjs';
import type { PDFDocumentProxy } from 'pdfjs-dist';

const props = defineProps({
  file: {
    type: Blob,
    required: true,
  },
});

pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/build/pdf.worker.mjs"

const PAGE_TO_VIEW = ref(1);
const TOTAL_PAGES = ref(1);

const SCALE = 1.0;

let pdf: PDFDocumentProxy | null = null;

let pdfPageView: PDFPageView | null = null;

const eventBus = new pdfjsViewer.EventBus();

// @ts-nocheck
async function getPdf() {
  const fileReader = new FileReader();

  fileReader.onload = async () => {
    const container = document.getElementById("pageContainer") as HTMLDivElement;

    const loadingTask = pdfjsLib.getDocument(new Uint8Array(fileReader.result as ArrayBuffer));

    pdf = await loadingTask.promise;

    if (!pdf) {
      return;
    }

    TOTAL_PAGES.value = pdf.numPages;

    const pdfPage = await pdf.getPage(PAGE_TO_VIEW.value);
    pdfPageView = new pdfjsViewer.PDFPageView({
      container,
      id: PAGE_TO_VIEW.value,
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

async function previousPage() {
  if (PAGE_TO_VIEW.value - 1 >= 0 && pdf) {
    PAGE_TO_VIEW.value -= 1;
    const pdfPage = await pdf.getPage(PAGE_TO_VIEW.value);

    if (!pdfPageView) {
      return;
    }

    pdfPageView.setPdfPage(pdfPage);
    pdfPageView.draw();
  }
}

async function nextPage() {
  if (PAGE_TO_VIEW.value < TOTAL_PAGES.value && pdf) {
    PAGE_TO_VIEW.value += 1;
    const pdfPage = await pdf.getPage(PAGE_TO_VIEW.value);

    if (!pdfPageView) {
      return;
    }

    pdfPageView.setPdfPage(pdfPage);
    pdfPageView.draw();
  }
}
</script>

<template>
  <div class="justify-self-center">
    <label id="previous-page" v-if="PAGE_TO_VIEW > 1" class="a-href underline font-extrabold text-sm">
      <button type="submit" @click.prevent="previousPage"></button>
      Previous
    </label>
    <label id="previous-page" v-if="PAGE_TO_VIEW < TOTAL_PAGES" class="a-href underline font-extrabold text-sm">
      <button type="submit" @click.prevent="nextPage"></button>
      Next
    </label>
  </div>
  <div id="pageContainer" class="pdfViewer singlePageView"></div>
  <!--
  <iframe src="https://mozilla.github.io/pdf.js/web/viewer.html?file=compressed.tracemonkey-pldi-09.pdf" width="100%" height="100%" frameborder="0" />
  -->
</template>

<style>
@import "pdfjs-dist/web/pdf_viewer.css";
#pageContainer {
  border: 1px solid #ccc !important;
  width: 100%;
  height: calc(100vh - 80px);
  overflow-y: scroll;
}
</style>
