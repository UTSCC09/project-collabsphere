import './assets/main.css'
import './index.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'


import { OhVueIcon, addIcons } from "oh-vue-icons";

/*
Icons from Oh Vue Icons (All MIT License)
Ionicons - htts://github.com/ionic-team/ionicons/blob/main/LICENSE
Bootstrap Icons - https://github.com/twbs/icons/blob/main/LICENSE
Material Design Icons - https://github.com/google/material-design-icons/blob/master/LICENSE
Prime Icons - https://github.com/primefaces/primeicons/blob/master/LICENSE
*/
import { IoCreate, BiBoxArrowInRight, MdLogout, MdLogin, PrSpinner, LaDownloadSolid } from "oh-vue-icons/icons";

addIcons(IoCreate, BiBoxArrowInRight, MdLogout, MdLogin, PrSpinner, LaDownloadSolid);

const app = createApp(App)

app.component("v-icon", OhVueIcon);
app.use(createPinia())
app.use(router)

app.mount('#app')
