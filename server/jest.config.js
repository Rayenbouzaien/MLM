export default {
  testEnvironment: "node",
  setupFiles: ["dotenv/config"],
  testMatch: ["**/tests/**/*.test.js"],
  testTimeout: 20000,
  verbose: true,
};
