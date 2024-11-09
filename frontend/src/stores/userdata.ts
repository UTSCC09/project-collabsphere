import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

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

  const logout = () => {
    console.log("OOOO");
    fetch(`${import.meta.env.VITE_PUBLIC_BACKEND}/api/signout`, {
      method: 'GET',
      credentials: 'include',
    }).then(() => {
      isLoggedIn.value = false
      clearLocalStorage()
    })
  }

  const setUsername = (name: string) => {
    username.value = name
    saveToLocalStorage()
  }

  const setEmail = (mail: string) => {
    useremail.value = mail
    saveToLocalStorage()
  }

  const hostSession = (sessionId) => {
    isHost.value = true
    sessionID.value = sessionId
    saveToLocalStorage()
    
  }

  const joinSession = (sessionId) => {
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
    sessionID,
    isHost,
  }
})
