import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import fetchWrapper from '@/utils/fetchWrapper'

// Dummy fields until we have a real user store
export const useUserdataStore = defineStore('userdata', () => {
  const isLoggedIn = ref(false)
  const username = ref('')
  const useremail = ref('')

  const sessionID = ref('')
  const isHost = ref(false)

  const login = () => {
    isLoggedIn.value = true
  }

  const logout = async () => {
    try {
      await fetch(`${import.meta.env.VITE_PUBLIC_BACKEND}/api/signout`, {
        method: 'GET',
        credentials: 'include',
      })

      isLoggedIn.value = false
      username.value = ''
      useremail.value = ''
      sessionID.value = ''
      isHost.value = false

      clearLocalStorage()
    } catch (error) {
      console.error('Sign-out failed:', error)
    }
  }

  const setUsername = (name: string) => {
    username.value = name
    saveToLocalStorage()
  }

  const setEmail = (mail: string) => {
    useremail.value = mail
    saveToLocalStorage()
  }

  const hostSession = (sessionId: string) => {
    isHost.value = true
    sessionID.value = sessionId
    saveToLocalStorage()
  }

  const joinSession = (sessionId: string) => {
    isHost.value = false
    sessionID.value = sessionId
    saveToLocalStorage()
  }

  const leaveSession = () => {
    isHost.value = false
    sessionID.value = ''
    saveToLocalStorage()
  }

  const saveToLocalStorage = () => {
    const content = {
      username: username.value,
      email: useremail.value,
      sessionID: sessionID.value,
      isHost: isHost.value,
    }

    localStorage.setItem('userdata', JSON.stringify(content))
  }

  const loadFromLocalStorage = () => {
    const content = localStorage.getItem('userdata')

    if (content) {
      const data = JSON.parse(content)
      username.value = data.username
      useremail.value = data.email
      sessionID.value = data.sessionID
      isHost.value = data.isHost
      if (username.value) {
        isLoggedIn.value = true
      }
    }
  }

  const clearLocalStorage = () => {
    localStorage.removeItem('userdata')
  }

  const checkAuth = async () => {
    try {
      const data = await fetchWrapper(
        `${import.meta.env.VITE_PUBLIC_BACKEND}/api/check-auth`,
        {
          method: 'GET',
          credentials: 'include',
        },
      )

      username.value = data.username
      useremail.value = data.email
      isLoggedIn.value = true
      saveToLocalStorage()
      return true
    } catch (error) {
      console.log(error)
      return error
    }
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
    hostSession,
    joinSession,
    leaveSession,
    checkAuth,
    sessionID,
    isHost,
  }
})
