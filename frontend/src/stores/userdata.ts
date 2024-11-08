import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

// Dummy fields until we have a real user store
export const useUserdataStore = defineStore('userdata', () => {
  const isLoggedIn = ref(true)

  const login = () => {
    isLoggedIn.value = true
  }

  const logout = () => {
    isLoggedIn.value = false
  }

  return { isLoggedIn, login, logout }
})
