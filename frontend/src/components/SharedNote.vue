<script setup type="module" lang="ts">
    import { defineComponent, onMounted, ref, watch } from 'vue';

    const props = defineProps<{
        conn: any,
        conns: any[],
        socket: any,
    }>();

    const note = ref(null);
    onMounted(() => {
        props.socket.on('note', (data) => {
            note.value = data;
        });
    });

    function transmit() {
        props.socket.emit('note', note.value);
    }

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