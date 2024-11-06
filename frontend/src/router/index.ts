import { createRouter, createWebHistory } from 'vue-router'
import SessionView from '../views/SessionView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: SessionView,
    },
  ],
})

export default router
