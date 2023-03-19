module.exports = {
  testTimeout: 1000,
  coveragePathIgnorePatterns: [
    "/src/index.ts"
  ],
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100
    }
  },
  projects: [
    {
      preset: "ts-jest",
      displayName: "MVC",
      testMatch: [
        '<rootDir>/packages/mvc/src/**/*.test.*'
      ]
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
    }
  ]
}