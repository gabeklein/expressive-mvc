module.exports = {
  testTimeout: 1000,
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