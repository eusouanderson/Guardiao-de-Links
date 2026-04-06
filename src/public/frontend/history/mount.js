// Entry module that mounts the history feature runtime app.
import { createApp } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.prod.js';
import { createHistoryApp } from './app.js';

createApp(createHistoryApp()).mount('#historyApp');
