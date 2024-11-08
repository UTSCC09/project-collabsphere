import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

// Dummy fields until we have a real user store
export const useUserdataStore = defineStore('userdata', () => {
  const isLoggedIn = ref(true)
  const username = ref('')
  const useremail = ref('')

  const login = () => {
    isLoggedIn.value = true
  }

  const logout = () => {
    isLoggedIn.value = false
    clearLocalStorage()
  }

  const setUsername = (name: string) => {
    username.value = name
    saveToLocalStorage()
  }

  const setEmail = (mail: string) => {
    useremail.value = mail
    saveToLocalStorage()
  }

  const saveToLocalStorage = () => {
    localStorage.setItem('username', username.value)
    localStorage.setItem('email', useremail.value)
  }

  const loadFromLocalStorage = () => {
    username.value = localStorage.getItem('username') || ''
    useremail.value = localStorage.getItem('email') || ''
  } 

  const clearLocalStorage = () => {
    localStorage.removeItem('username')
    localStorage.removeItem('email')
  }

  loadFromLocalStorage()

  return {
    isLoggedIn,
    login,
    logout,
    username,
    useremail,
    setUsername,
    setEmail,
  }
})
