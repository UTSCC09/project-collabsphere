<script setup lang="js" type="module">
import { useNotificationStore } from '@/stores/notification';
import { computed, ref, watch } from 'vue';

const notificationStore = useNotificationStore();

const notifications = computed(() => notificationStore.notifications);

watch(() => notifications.value, (notifications) => {
    if (notifications.length > 0) {

        // For each
        notifications.value.forEach((notification) => {
            console.log("Timing");  
            setTimeout(() => {
                console.log("Timing out");
                // Set exit animation
                const elem = document.getElementById(notification.id);
                
                elem.classList.add('notif-exit');
                
                // Wait for animation to finish
                elem.addEventListener('animationend', () => {
                    notificationStore.removeNotification(notification.id);
                });
            }, notification.duration);
        });
    }
});

// Add
notificationStore.addNotification({
    title: 'Welcome to CollabSphere!',
    message: 'This is a notification message.',
    duration: 2000
});

notificationStore.addNotification({
    message: 'This is a notification message.',
    duration: 5000
});

</script>

<template>
    <div class="fixed bottom-0 flex flex-col items-center justify-center m-4 w-full">
        <div v-for="notification in notifications"
        :key="notification.id" :id="notification.id" class="bg-black/80 backdrop-blur-sm text-white shadow-md rounded-lg p-4 m-2 min-w-52">
            <div v-if="notification.title" class="notif-enter">
                <div class="flex justify-between items-center">
                    <h3 class="text-lg">{{ notification.title }}</h3>
                    <button @click="removeNotification(notification.id)" class="text-red-300 text-2xl ml-auto">&times;</button>
                </div>
                <p>{{ notification.message }}</p>
            </div>
            <div v-else class="flex items-center gap-2 notif-enter" :key="notification.id" :id="notification.id">
                <p>{{ notification.message }}</p>
                <button @click="removeNotification(notification.id)" class="text-red-300 text-2xl">&times;</button>
            </div>
        </div>
    </div>
</template>