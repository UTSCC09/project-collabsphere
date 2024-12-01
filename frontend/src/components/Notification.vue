<script  setup lang="ts" type="module">
import { useNotificationStore } from '@/stores/notification';
import { computed, watch } from 'vue';

const notificationStore = useNotificationStore();

const notifications = computed(() => notificationStore.notifications);

watch(notificationStore.notifications, (notifs) => {
    // For each notification
    notifs.forEach((notification) => {

        if (notification.pending == false) {
            return;
        }

        notification.pending = false;

        setTimeout(() => {
            notificationStore.removeNotification(notification.id);
        }, notification.duration);
    });
});

</script>

<template>
    <div class="fixed bottom-0 left-0 flex flex-col items-center justify-center my-4 w-screen">
        <div v-for="notification in notifications"
        :key="notification.id" :id="notification.id" class="bg-black/80 backdrop-blur-sm text-white shadow-md rounded-lg px-4 p-2 m-2 min-w-52">
            <div v-if="notification.title" class="notif-enter">
                <div class="flex justify-between items-center">
                    <h3 class="text-lg">{{ notification.title }}</h3>
                    <button @click="notificationStore.removeNotification(notification.id)" class="text-red-300 text-2xl ml-auto">&times;</button>
                </div>
                <p>{{ notification.message }}</p>
            </div>
            <div v-else class="flex items-center gap-2 notif-enter" :key="notification.id" :id="notification.id">
                <p>{{ notification.message }}</p>
                <button @click="notificationStore.removeNotification(notification.id)" class="text-red-300 text-2xl">&times;</button>
            </div>
        </div>
    </div>
</template>