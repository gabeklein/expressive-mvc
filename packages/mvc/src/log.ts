export const log = (message: string) => {
  // @ts-ignore
  // process.stdout.write(message + "\n");
}

beforeAll(() => {
  log("--- tests begin ---");
})

afterAll(() => {
  log("--- tests end ---");
});
