module.exports = {
  testTimeout: 1000,
  projects: [
    {
      displayName: "MVC",
      testMatch: [
        '<rootDir>/packages/mvc/src/**/*.test.*'
      ],
      transform: {
        "^.+\\.[tj]sx?$": "@swc/jest",
      },
      setupFilesAfterEnv: [
        "<rootDir>/jest.setup.ts"
      ],
    },
    {
      displayName: "React",
      testMatch: [
        '<rootDir>/packages/react/src/**/*.test.*'
      ],
      transform: {
        "^.+\\.[tj]sx?$": "@swc/jest",
      },
      moduleNameMapper: {
        "@expressive/(.*)$": "<rootDir>/packages/$1/src"
      },
      setupFilesAfterEnv: [
        "<rootDir>/jest.setup.ts"
      ],
    }
  ]
}