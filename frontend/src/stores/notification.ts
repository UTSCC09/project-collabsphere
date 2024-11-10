import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export const useNotificationStore = defineStore('notification', () => {
    const notifications = ref([])

    function addNotification({title, message, duration=2000}) {
        const id = Math.random().toString(36).substr(2, 9);
        notifications.value.push({ id, title, message, duration });
    }
    
    function removeNotification(id) {
        notifications.value = notifications.value.filter(notification => notification.id !== id);
    }

    return { notifications, addNotification, removeNotification }
})
