import { defineConfig } from '@trigger.dev/sdk'

export default defineConfig({
  project: 'proj_atlwytadgpadkdqotfkl',
  dirs: ['./trigger'],
  runtime: 'node-22',
  maxDuration: 900,
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 5,
      minTimeoutInMs: 2_000,
      maxTimeoutInMs: 60_000,
      factor: 2,
      randomize: true,
    },
  },
})
