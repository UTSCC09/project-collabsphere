<script setup lang="ts">
import { ref, computed } from 'vue'
import { useUserdataStore } from '@/stores/userdata'
import SpinnerIcon from './SpinnerIcon.vue';
import fetchWrapper from "@/utils/fetchWrapper";

const userstore = useUserdataStore()

// password regex
const reg = new RegExp('^[ A-Za-z0-9_@./#&+!-]{8,}$')
const usernameRegex = /^[ A-Za-z0-9_@./#&+!-]{8,20}$/;

const status = ref('Sign in')
const match_error = ref('')
const response_error = ref('')
const regex_error = ref('')
const username_error = ref('')

const username = ref('')
const email = ref('')
const password = ref('')
const cpassword = ref('')
let token = null;

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
  if (usernameRegex.test(username.value)) {
    username_error.value = ''
  } else {
    username_error.value = 'Username must be 8-20 characters and can only contain letters, numbers, and certain symbols.'
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

async function oauth_signup() {
  try {
    response_error.value = ''
    processing.value = true
    const response = await fetch(
      `${import.meta.env.VITE_PUBLIC_BACKEND}/api/oauth-signup`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username.value,
          email: email.value,
          OAuthToken: token,
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
  return !(reg.test(username.value) && reg.test(password.value) && password.value === cpassword.value);
});

const isAuthDisabled = computed(() => {
  return !reg.test(username.value);
});

const client = google.accounts.oauth2.initTokenClient({
  client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
  scope: 'https://www.googleapis.com/auth/userinfo.email',
  callback: async (response) => {
    if (google.accounts.oauth2.hasGrantedAnyScope(response, 'https://www.googleapis.com/auth/userinfo.email')) {
      token = response;

      // try to sign in with the token
      response_error.value = ''
      processing.value = true
      try {
        const res = await fetch(
          `${import.meta.env.VITE_PUBLIC_BACKEND}/api/oauth-signin`,
          {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              OAuthToken: response,
            }),
          },
        );

        // if the account does not exist, let user sign up with token
        if (res.status === 404) {
          status.value = 'Choose your display name';
          return;
        }

        if (!res.ok) {
          try {
            const json = await res.json()
            response_error.value = json.message || 'Error signing up'
          } finally {
            throw new Error(`Response status: ${res.status}`)
          }
        }

        const json = await res.json();
        const { username, email: resEmail } = json;

        userstore.setUsername(username);
        userstore.setEmail(resEmail);
        userstore.login();
        return;
      } catch (error) {
        console.log(error)
      }

      processing.value = false
    }
  },
});
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
      <p class="text-center mt-2 mb-2">or</p>
      <img src="./icons/web_light_rd_SI.svg" alt="Sign in with Google" class="justify-self-center hover:opacity-75" @click="client.requestAccessToken"/>
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
          <label for="display" class="form-label">Display name</label>

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
            <p id="regex-error" class="text-red-400">{{ username_error }}</p>
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
    <div
      v-else-if="status === 'Choose your display name'"
      class="mt-10 sm:mx-auto sm:w-full sm:max-w-sm"
    >
      <form class="space-y-6" @submit.prevent="oauth_signup">
        <div>
          <div class="mt-2 mb-2">
            <input
              name="username"
              @keyup="validate_username"
              v-model="username"
              autocomplete="username"
              placeholder="display name"
              required
              class="form-input"
            />
          </div>
          <p id="regex-error" class="text-red-400">{{ username_error }}</p>
          <input
            type="submit"
            class="btn"
            :disabled="isAuthDisabled"
            value="Complete registration"
          />
        </div>
      </form>
    </div>
  </div>
</template>
<style lang="postcss" scoped></style>
