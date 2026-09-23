import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:4173",
    supportFile: false,
    video: false,
    screenshotOnRunFailure: false,
    viewportWidth: 1280,
    viewportHeight: 800,
    defaultCommandTimeout: 10000,
  },
});
