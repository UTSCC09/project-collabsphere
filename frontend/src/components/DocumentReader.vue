<!-- This is a temporary vue item to test Document reading and segmenting -->
<!-- Accept file as prop -->
<script setup lang="ts" type="module">
import { ref, watch } from 'vue'
import { PDFDocument } from 'pdf-lib'

const props = defineProps({
  file: Object
})

const currentPage = ref(null)
const pageMetadata = ref(null)

async function readDocument() {
  if (!props.file) {
    return console.error('No file provided')
  }


  const pdfDoc = await PDFDocument.load(await props.file.arrayBuffer())
  const pages = pdfDoc.getPages()

  console.log("There are " + pages.length + " pages in the document")

  // Print all available metadata fields
  console.log('Title:', pdfDoc.getTitle())
  console.log('Author:', pdfDoc.getAuthor())
  console.log('Subject:', pdfDoc.getSubject())
  console.log('Creator:', pdfDoc.getCreator())
  console.log('Keywords:', pdfDoc.getKeywords())
  console.log('Producer:', pdfDoc.getProducer())
  console.log('Creation Date:', pdfDoc.getCreationDate())
  console.log('Modification Date:', pdfDoc.getModificationDate())

  // Set pageMetadata ref
  pageMetadata.value = {
    title: pdfDoc.getTitle(),
    author: pdfDoc.getAuthor(),
    subject: pdfDoc.getSubject(),
    creator: pdfDoc.getCreator(),
    keywords: pdfDoc.getKeywords(),
    producer: pdfDoc.getProducer(),
    creationDate: pdfDoc.getCreationDate(),
    modificationDate: pdfDoc.getModificationDate()
  }

  // Create a pdf with only the first page
  const newPdf = await PDFDocument.create()
  const [firstPage] = await newPdf.copyPages(pdfDoc, [0])
  newPdf.addPage(firstPage)

  const pdfBytes = await newPdf.save()
  const pdfUrl = URL.createObjectURL(new Blob([pdfBytes], { type: 'application/pdf' }))
  currentPage.value = pdfUrl

}

watch(() => props.file.value, readDocument, { immediate: true })

</script>

<template>
  <div>
    <iframe v-if="currentPage" :src="currentPage" width="100%" height="500px"></iframe>
  </div>
</template>
