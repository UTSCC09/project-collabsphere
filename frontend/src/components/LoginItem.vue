<script setup lang="ts">
import { ref, computed } from "vue"

// password regex
const reg = new RegExp("^[ A-Za-z0-9_@./#&+!-]{8,}$");

const status = ref("Sign in");
const match_error = ref("");
const username_regex_error = ref("");
const password_regex_error = ref("");

// default needed for computed property .length
const username = defineModel("username", { default: "" });
const email = defineModel("email");
const password = defineModel("password");
const cpassword = defineModel("cpassword");

function validate_username() {
  if (username.value.length < 8) {
    username_regex_error.value = "Display name must be ≥ 8 characters";
    return;
  }

  if (username.value.length > 20) {
    username_regex_error.value = "Display name must be ≤ 20 characters";
    return;
  }

  if (reg.test(username.value)) {
    username_regex_error.value = "";
  } else {
    username_regex_error.value = "Display name has invalid characters";
  }
}

function validate_password() {
  if (password.value.length < 8) {
    password_regex_error.value = "Password must be ≥ 8 characters";
    return;
  }

  if (reg.test(password.value)) {
    password_regex_error.value = "";
  } else {
    password_regex_error.value = "Password has invalid characters";
  }
}

function check_password() {
  if (password.value === cpassword.value) {
    match_error.value = "";
  } else {
    match_error.value = "Passwords don't match";
  }
}

async function signin() {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND}/api/signin`, {
      method: "POST",
      body: JSON.stringify({
        email: email.value,
        password: password.value,
      })
    });

    if (!response.ok) {
      throw new Error(`Response status: ${response.status}`);
    }
    const json = await response.json();
    // TODO do what with response
  } catch(error) {
    console.log(error);
  }
}

async function signup() {
  if (password.value !== cpassword.value)
    return;

  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND}/api/signup`, {
      method: "POST",
      body: JSON.stringify({
        username: username.value,
        email: email.value,
        password: password.value,
      })
    });

    if (!response.ok) {
      throw new Error(`Response status: ${response.status}`);
    }
    const json = await response.json();
    // TODO do what with response
  } catch(error) {
    console.log(error);
  }
}

const isDisabled = computed(() => {
  return reg.test(password.value) && password.value === cpassword.value && reg.test(username.value) && username.value.length <= 20;
});
</script>

<template>
  <!-- Modified from https://tailwindui.com/components/application-ui/forms/sign-in-forms -->
  <div class="flex min-h-full flex-col justify-center px-6 py-12 lg:px-8">
    <div class="sm:mx-auto sm:w-full sm:max-w-sm">
      <h2 class="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">{{status}}</h2>
    </div>

    <div v-if="status === 'Sign in'" class="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
      <form class="space-y-6" @submit.prevent="signin">
        <div>
          <label for="email" class="form-label">Email address</label>
          <div class="mt-2">
            <input id="email" name="email" type="email" v-model="email" autocomplete="email" placeholder="e-mail" required class="form-input">
          </div>
        </div>

        <div>
          <div class="flex items-center justify-between">
            <label for="password" class="form-label">Password</label>
            <div class="text-sm">
              <a href="#" class="a-href" @click="status = 'Reset password'">Forgot password?</a>
            </div>
          </div>
          <div class="mt-2">
            <input id="password" name="password" type="password" v-model="password" autocomplete="current-password" placeholder="password" required class="form-input">
          </div>
        </div>

        <div>
          <button type="submit" class="btn">Sign in</button>
        </div>
      </form>

      <p class="mt-10 text-center text-sm text-gray-500">
        Not a member?
        <a href="#" class="a-href" @click="status = 'Sign up'">Sign up</a>
      </p>
    </div>
    <div v-else-if="status === 'Sign up'" class="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
      <form class="space-y-6" @submit.prevent="signup">
        <div>
          <div class="flex items-center justify-between">
            <label for="display" class="form-label">Display name</label>
            <p id="username-regex_error" class="text-red-400">{{username_regex_error}}</p>
          </div>
          <div class="mt-2">
            <input id="username" name="username" @keyup="validate_username" v-model="username" autocomplete="username" placeholder="display name (8-20 characters)" required class="form-input">
          </div>
        </div>

        <div>
          <label for="email" class="form-label">Email address</label>
          <div class="mt-2">
            <input id="email" name="email" type="email" v-model="email" autocomplete="email" placeholder="e-mail" required class="form-input">
          </div>
        </div>

        <div>
          <div class="flex items-center justify-between">
            <label for="password" class="form-label">Password</label>
            <p id="password-regex-error" class="text-red-400">{{password_regex_error}}</p>
          </div>
          <div class="mt-2">
            <input id="password" name="password" type="password" @keyup="validate_password" v-model="password" autocomplete="current-password" placeholder="password" required class="form-input">
          </div>
          <div class="flex items-center justify-between mt-2">
            <label for="password-check" class="form-label">Confirm password</label>
            <p id="match-error" class="text-red-400">{{match_error}}</p>
          </div>
          <div class="mt-2">
            <input id="password-check" name="password-check" type="password" @keyup="check_password" v-model="cpassword" autocomplete="current-password" placeholder="password" required class="form-input">
          </div>
        </div>

        <div>
          <button type="submit" class="btn" :disabled="isDisabled">Sign up</button>
        </div>
      </form>

      <p class="mt-10 text-center text-sm text-gray-500">
        Already a member?
        <a href="#" class="a-href" @click="status = 'Sign in'">Sign in</a>
      </p>
    </div>
    <div v-else-if="status === 'Reset password'" class="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
      <p>TODO: Implement at the end</p>
    </div>
  </div>
</template>

<style lang="postcss" scoped>
</style>
