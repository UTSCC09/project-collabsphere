<script setup lang="ts">
import {computed} from "vue";

const props = defineProps<{
  x_coord: number,
  y_coord: number,
  username: string
}>();

// from https://gist.github.com/0x263b/2bdd90886c2036a1ad5bcf06d6e6fb37
const toColor = function(value: string): string {
  const colors = ["#da4d2f", "#93220a", "#ff8b73", "#FFC300", "#f0c72f", "#dde249", "#b6e249",
                  "#7ad639", "#1ecfb2", "#0c94b2", "#312bee", "#9053d0", "#e855dd"];

  let hash = 0;
  if (value.length === 0) return hash.toString();
  for (let i = 0; i < value.length; i++) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  hash = ((hash % colors.length) + colors.length) % colors.length;
  return colors[hash];
}

// calculate hex string using username
const color = toColor(props.username);

// converts x_coord to pixel value
const x = computed(() => {
  return (props.x_coord || 0)  * window.innerWidth;
});

// converts y_coord to pixel value
const y = computed(() => {
  return (props.y_coord || 0) * window.innerHeight;
});

</script>

<template>
  <!-- svg modified from original by <a href="http://www.freepik.com" title="Freepik">Freepik</a> from
        <a href="https://www.svgrepo.com/svg/533685/cursor-alt" title="Flaticon">www.flaticon.com</a>
        is licensed by
        <a
          href="https://creativecommons.org/licenses/by/4.0/"
          title="Creative Commons BY 3.0"
          target="_blank"
          >CC 3.0 BY</a
        > -->
  <div :id="props.username" class="cursor-item fixed pointer-events-none">
    <svg class="cursor h-8 w-8" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        stroke-width="0"
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M17.2607 12.4008C19.3774 11.2626 20.4357 10.6935 20.7035 10.0084C20.9359 9.41393 20.8705 8.74423 20.5276 8.20587C20.1324 7.58551 18.984 7.23176 16.6872 6.52425L8.00612 3.85014C6.06819 3.25318 5.09923 2.95471 4.45846 3.19669C3.90068 3.40733 3.46597 3.85584 3.27285 4.41993C3.051 5.06794 3.3796 6.02711 4.03681 7.94545L6.94793 16.4429C7.75632 18.8025 8.16052 19.9824 8.80519 20.3574C9.36428 20.6826 10.0461 20.7174 10.6354 20.4507C11.3149 20.1432 11.837 19.0106 12.8813 16.7454L13.6528 15.0719C13.819 14.7113 13.9021 14.531 14.0159 14.3736C14.1168 14.2338 14.2354 14.1078 14.3686 13.9984C14.5188 13.8752 14.6936 13.7812 15.0433 13.5932L17.2607 12.4008Z"/>
    </svg>
    <p class="username font-sans">{{props.username}}</p>
  </div>
</template>

<style scoped>
.cursor {
  fill: v-bind(color);
}

.cursor-item {
  left: v-bind(x + "px");
  top: v-bind(y + "px");
}

.username {
  background-color: v-bind(color);
  color: #f8f8f8;
}
</style>
