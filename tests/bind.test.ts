import { Controller } from "./adapter";

describe("bind", () => {
  class Form extends Controller {
    username = "";
    password = "";
    birthday = 0;
  }
  
  it('bind contains refFunctions cooresponding to values', async () => {
    const { bind } = Form.create();

    expect(bind.hasOwnProperty("username")).toBe(true);
    expect(bind.hasOwnProperty("password")).toBe(true);

    // ignores non-string values
    expect(bind.hasOwnProperty("birthday")).toBe(false);
  })
})