import './assets/main.css'
import './index.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'


import { OhVueIcon, addIcons } from "oh-vue-icons";
import { IoCreate, BiBoxArrowInRight, MdLogout, MdLogin, PrSpinner } from "oh-vue-icons/icons";

addIcons(IoCreate, BiBoxArrowInRight, MdLogout, MdLogin, PrSpinner);

const app = createApp(App)

app.component("v-icon", OhVueIcon);
app.use(createPinia())
app.use(router)

app.mount('#app')
