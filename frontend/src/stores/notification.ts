import { ref, computed, type Ref } from 'vue'
import { defineStore } from 'pinia'


interface Notification {
    id: string;
    title: string;
    message: string;
    duration: number;
    pending: boolean;
}

interface NotificationRequest {
    message: string;
    title?: string;
    duration?: number;
}

export const useNotificationStore = defineStore('notification', () => {
    const notifications: Ref<Notification[]> = ref([])

    function addNotification({message, title='', duration=3000}: NotificationRequest) {
        const id = Math.random().toString(36).substring(1, 10);
        notifications.value.push({ id, title, message, duration, pending: true });

        // Ensure the notification is removed after the duration
        setTimeout(() => {
            removeNotification(id);
        }, duration);
    }
    
    function removeNotification(id: string) {
        notifications.value = notifications.value.filter(notification => notification.id !== id);
    }

    return { notifications, addNotification, removeNotification }
})
