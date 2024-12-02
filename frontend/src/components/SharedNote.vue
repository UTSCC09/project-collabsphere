<script setup type="module" lang="ts">
import { onMounted, ref, type Ref } from "vue";
import { Socket } from "socket.io-client";

const props = defineProps({
  socket: Socket,
});

const note: Ref<string | null> = ref(null);
onMounted(() => {
  if (!props.socket) {
    console.error('Socket not available');
    return;
  }
  props.socket.on('note', (data: string) => {
    note.value = data;
  });
});

function transmit() {
  if (!props.socket) {
    console.error('Socket not available');
    return;
  }
  props.socket.emit('note', note.value);
}

defineExpose({
  transmit,
});
</script>

<template>
    <div class="w-full h-full flex-1 flex flex-col">
        <h2 class="text-2xl">Shared Note</h2>
        <textarea
            @keyup="transmit"
            v-model="note"
            class="flex-1 bg-inherit resize-none p-2"
            placeholder="Write your note here..."
        ></textarea>
    </div>
</template>
