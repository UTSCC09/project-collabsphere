<script setup lang="ts">
import { ref, computed } from 'vue'
import { useUserdataStore } from '@/stores/userdata'
import SpinnerIcon from './SpinnerIcon.vue';

const userstore = useUserdataStore()

// password regex
const reg = new RegExp('^[ A-Za-z0-9_@./#&+!-]{8,}$')

const status = ref('Sign in')
const match_error = ref('')
const response_error = ref('')
const regex_error = ref('')
const username_error = ref('')

const username = ref('')
const email = ref('')
const password = ref('')
const cpassword = ref('')

const processing = ref(false)

function validate_password() {
  if (password.value.length < 8) {
    regex_error.value = 'Password must be > 8 characters'
    return
  }

  if (reg.test(password.value)) {
    regex_error.value = ''
  } else {
    regex_error.value = 'Password has invalid characters'
  }
}

function check_password() {
  if (password.value === cpassword.value) {
    match_error.value = ''
  } else {
    match_error.value = "Passwords don't match"
  }
}

function validate_username() {
  const usernameRegex = /^[ A-Za-z0-9_@./#&+!-]{8,20}$/;

  if (usernameRegex.test(username.value)) {
    username_error.value = ''
  } else if (username.value.length < 8) {
    username_error.value = 'Username must have at least 8 characters.'
  } else if (username.value.length > 20) {
    username_error.value = 'Username must have at most 20 characters.'
  } else {
    username_error.value = 'Characters can be alphanumeric or _@./#&+!-.'
  }
}

async function signin() {
  try {
    response_error.value = ''
    processing.value = true
    const response = await fetch(
      `${import.meta.env.VITE_PUBLIC_BACKEND}/api/signin`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.value,
          password: password.value,
        }),
      },
    )

    if (!response.ok) {
      try {
        const json = await response.json()
        response_error.value = json.message || 'Error signing up'
      } finally {
        throw new Error(`Response status: ${response.status}`)
      }
    }
    const json = await response.json()
    const { username, email: resEmail } = json

    userstore.setUsername(username)
    userstore.setEmail(resEmail)
    userstore.login()
  } catch (error) {
    console.log(error)
  }

  processing.value = false

}

async function signup() {
  try {
    response_error.value = ''
    processing.value = true
    const response = await fetch(
      `${import.meta.env.VITE_PUBLIC_BACKEND}/api/signup`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username.value,
          email: email.value,
          password: password.value,
        }),
      },
    )

    if (!response.ok) {
      try {
        const json = await response.json()
        response_error.value = json.message || 'Error signing up'
      } finally {
        throw new Error(`Response status: ${response.status}`)
      }
    }
    const json = await response.json()

    const { username: resUsername, email: resEmail } = json

    userstore.setUsername(resUsername)
    userstore.setEmail(resEmail)
    userstore.login()
  } catch (error) {
    console.log(error)
  }

  processing.value = false
}

const isDisabled = computed(() => {
  return !(reg.test(password.value) && password.value === cpassword.value)
})
</script>

<template>
  <!-- Modified from https://tailwindui.com/components/application-ui/forms/sign-in-forms -->
  <div class="flex min-h-full flex-col justify-center px-6 py-12 lg:px-8">
    <div class="sm:mx-auto sm:w-full sm:max-w-sm">
      <h2 class="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-cyan-900">{{status}}</h2>
    </div>

    <div
      v-if="status === 'Sign in'"
      class="mt-10 sm:mx-auto sm:w-full sm:max-w-sm"
    >
      <form class="space-y-6" @submit.prevent="signin">
        <div>
          <label for="email" class="form-label">Email address</label>
          <div class="mt-2">
            <input
              id="email"
              name="email"
              type="email"
              v-model="email"
              autocomplete="email"
              placeholder="e-mail"
              required
              class="form-input"
            />
          </div>
        </div>

        <div>
          <div class="flex items-center justify-between">
            <label for="password" class="form-label">Password</label>
          </div>
          <div class="mt-2">
            <input
              id="password"
              name="password"
              type="password"
              v-model="password"
              autocomplete="current-password"
              placeholder="password"
              required
              class="form-input"
            />
          </div>
        </div>
        <p id="match-error" class="text-red-400">{{response_error}}</p>

        <div v-if="processing" class="w-full flex items-center justify-center"><SpinnerIcon/></div>
        <input v-else type="submit" class="btn" value="Sign in" />
      </form>

      <p class="mt-10 text-center text-sm text-gray-500">
        Not a member?
        <a href="#" class="a-href" @click="status = 'Sign up'">Sign up</a>
      </p>
    </div>
    <div
      v-else-if="status === 'Sign up'"
      class="mt-10 sm:mx-auto sm:w-full sm:max-w-sm"
    >
      <form class="space-y-6" @submit.prevent="signup">
        <div>
          <div class="flex items-center justify-between">
            <label for="display" class="form-label">Display name</label>
            <p id="regex-error" class="text-red-400 text-xs">{{ username_error }}</p>
          </div>

          <div class="mt-2">
            <input
              id="username"
              name="username"
              @keyup="validate_username"
              v-model="username"
              autocomplete="username"
              placeholder="display name"
              required
              class="form-input"
              />
            </div>
        </div>

        <div>
          <label for="email" class="form-label">Email address</label>
          <div class="mt-2">
            <input
              id="email"
              name="email"
              type="email"
              v-model="email"
              autocomplete="email"
              placeholder="e-mail"
              required
              class="form-input"
            />
          </div>
        </div>

        <div>
          <div class="flex items-center justify-between">
            <label for="password" class="form-label">Password</label>
            <p id="regex-error" class="text-red-400">{{ regex_error }}</p>
          </div>
          <div class="mt-2">
            <input
              id="password"
              name="password"
              type="password"
              @keyup="validate_password"
              v-model="password"
              autocomplete="current-password"
              placeholder="password"
              required
              class="form-input"
            />
          </div>
          <div class="flex items-center justify-between mt-2">
            <label for="password-check" class="form-label"
              >Confirm password</label
            >
            <p id="match-error" class="text-red-400">{{ match_error }}</p>
          </div>
          <div class="mt-2">
            <input
              id="password-check"
              name="password-check"
              type="password"
              @keyup="check_password"
              v-model="cpassword"
              autocomplete="current-password"
              placeholder="password"
              required
              class="form-input"
            />
          </div>
        </div>

        <p id="match-error" class="text-red-400">{{response_error}}</p>
        <div v-if="processing" class="w-full flex items-center justify-center"><SpinnerIcon/></div>
        <input
          v-else
          type="submit"
          class="btn"
          :disabled="isDisabled"
          value="Sign up"
        />
      </form>

      <p class="mt-10 text-center text-sm text-gray-500">
        Already a member?
        <a href="#" class="a-href" @click="status = 'Sign in'">Sign in</a>
      </p>
    </div>
    <!--
    <div
      v-else-if="status === 'Reset password'"
      class="mt-10 sm:mx-auto sm:w-full sm:max-w-sm"
    >
      <p>TODO: Implement at the end</p>
    </div>
    -->
  </div>
</template>

<style lang="postcss" scoped></style>
