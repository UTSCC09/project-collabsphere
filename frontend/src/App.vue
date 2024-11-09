<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import Header from './components/Header.vue'
</script>

<template>
  <div class="flex flex-col relative mx-4 my-4">
    <Header />
    <RouterView />
  </div>
</template>

<style scoped></style>
