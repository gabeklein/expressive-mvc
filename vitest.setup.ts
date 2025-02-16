import { expect } from 'vitest'

expect.addSnapshotSerializer({
  test: () => true,
  serialize: (x) => {
    if(x instanceof Error)
      return x.message

    return x.toString()
  }
})