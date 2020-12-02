import VC, { test } from "./adapter";

class Subject extends VC {
  value = 1;
  value2 = 2;

  setValueToThree = () => {
    this.value = 3;
  }
}

describe("hooks", () => {
  it('ignore updates to not-accessed values', async () => {
    const { state, assertDidUpdate, assertDidNotUpdate } = test(() => {
      const state = Subject.use();

      void state.value;
      // Here we neglect to access value2.
      // void state.value2;

      return state;
    });
    
    state.value = 2
    await assertDidUpdate();

    state.value2 = 3;
    await assertDidNotUpdate();
  });

  it('expose get/set to dodge tracking', async () => {
    const { state, assertDidUpdate ,assertDidNotUpdate } = test(() => {
      const state = Subject.use();

      void state.value;
      // here we access value2, but indirectly
      // this bypasses spy which auto-subscribed value
      void state.get.value2;

      return state;
    });
    
    state.value = 2
    await assertDidUpdate();

    state.value2 = 3;
    await assertDidNotUpdate();
  })
})