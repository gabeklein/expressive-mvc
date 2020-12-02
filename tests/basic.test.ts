import VC from "./adapter";

class Subject extends VC {
  value = 1;
  value2 = 2;

  setValueToThree = () => {
    this.value = 3;
  }
}

describe("controller", () => {
  it('instantiate from class', () => {
    const state = Subject.create();
  
    expect(state.value).toBe(1);
    expect(state.value2).toBe(2);
  })
  
  it('updates when a value changes', async () => {
    const state = Subject.create();
    
    expect(state.value).toBe(1);

    state.value = 2
    await state.requestUpdate(true);

    expect(state.value).toBe(2);
  })
  
  it('methods may change state', async () => {
    const state = Subject.create();
    
    state.setValueToThree();
    await state.requestUpdate(true);

    expect(state.value).toBe(3)
  })
    
  it('defines get/set as circular references', async () => {
    const state = Subject.create();
    
    expect(state.get.value).toBe(1);
  
    state.set.value = 2;
    await state.requestUpdate(true);
    
    expect(state.get.value).toBe(2)
  })
})