export const config = {
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  wsUrl: import.meta.env.VITE_WS_URL || 'ws://localhost:5000',
  appName: import.meta.env.VITE_APP_NAME || 'RecuirtPro',
  enableProctoring: import.meta.env.VITE_ENABLE_PROCTORING === 'true',
};

export default config;
