module.exports = {
  testTimeout: 500,
  projects: [
    {
      preset: "ts-jest",
      displayName: "MVC",
      testMatch: [
        '<rootDir>/packages/mvc/src/**/*.test.*'
      ],
      setupFilesAfterEnv: [
        "<rootDir>/jest.setup.ts"
      ],
    },
    {
      preset: "ts-jest",
      displayName: "React",
      testMatch: [
        '<rootDir>/packages/react/src/**/*.test.*'
      ],
      moduleNameMapper: {
        "@expressive/(.*)$": "<rootDir>/packages/$1/src"
      },
      setupFilesAfterEnv: [
        "<rootDir>/jest.setup.ts"
      ],
    }
  ]
}