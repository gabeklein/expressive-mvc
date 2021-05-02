import Controller, { test } from "./adapter";

describe("bind", () => {
  class Form extends Controller {
    username = "";
    password = "";

    birthday = new Date();
  }
  
  it('has bind-function generator method', async () => {
    const { state } = test(Form);
    const { bind } = state;

    expect(bind).toBeInstanceOf(Function);
  })
  
  it('method contains shortcuts for string values', async () => {
    const { state } = test(Form);
    const { bind } = state;

    expect(bind.hasOwnProperty("username")).toBe(true);
    expect(bind.hasOwnProperty("password")).toBe(true);

    // Form.birthday isn't a string, should thus be ignored.
    expect(bind.hasOwnProperty("birthday")).toBe(false);
  })
})