<script setup lang="ts">
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
// HiSolidDotsHorizontal
</script>

<template>
  <Popover>
    <PopoverTrigger class="float-right">
      <v-icon name="hi-solid-dots-horizontal"/>
    </PopoverTrigger>
    <PopoverContent class="bg-zinc-900 border-gray-500 text-white">
        <h1 class="font-semibold">Menu</h1>
        <ul class="text-sm">
            <li>Server Mute</li>
            <li>Allow Video</li>
            <li class="text-red-500">Kick</li>
        </ul>
    </PopoverContent>
  </Popover>
</template>