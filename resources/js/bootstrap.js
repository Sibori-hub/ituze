import axios from 'axios';
import { installAxiosCsrfRetry } from './lib/csrf';
window.axios = axios;

// Inertia sends every form through axios: recover from an expired token once.
installAxiosCsrfRetry(axios);

window.axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
