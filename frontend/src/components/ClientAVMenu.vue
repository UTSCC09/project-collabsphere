<script setup lang="ts">
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
// HiSolidDotsHorizontal

const props = defineProps<{
  class?: string;
}>();


</script>

<template>
  <Popover>
    <PopoverTrigger  :class="[props.class, 'float-right']">
      <v-icon name="hi-solid-dots-horizontal"/>
    </PopoverTrigger>
    <PopoverContent class="bg-zinc-900 border-gray-500 text-white">
        <h1 class="font-semibold">Menu</h1>
        <ul class="text-sm">
            <li><button>Server Mute</button></li>
            <li><button>Allow Video</button></li>
            <li class="text-red-500"><button>Kick</button></li>
        </ul>
    </PopoverContent>
  </Popover>
</template>