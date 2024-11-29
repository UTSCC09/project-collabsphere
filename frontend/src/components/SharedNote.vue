<script setup type="module" lang="ts">
import { onMounted, ref, Ref } from "vue";

const props = defineProps({
  socket: Object,
});

const note: Ref<string | null> = ref(null);
onMounted(() => {
  props.socket.on('note', (data: string) => {
    note.value = data;
  });
});

function transmit() {
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
