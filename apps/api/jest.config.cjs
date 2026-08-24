/** Jest + ts-jest. Os testes de integração (tests/) exigem o Postgres local
 *  do README (`docker run ... postgres:16`) com a migration aplicada. */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src", "<rootDir>/tests"],
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.json" }],
  },
  testTimeout: 30000,
};
