import { Controller } from "./adapter";

describe("bind", () => {
  class Form extends Controller {
    username = "";
    password = "";
    birthday = 0;
  }
  
  it('will contains refFunctions cooresponding to values', async () => {
    const { bind } = Form.create();

    expect(bind.hasOwnProperty("username")).toBe(true);
    expect(bind.hasOwnProperty("password")).toBe(true);

    // ignores non-string values
    expect(bind.hasOwnProperty("birthday")).toBe(false);
  })

  it.todo("will bind element to value of property")
  it.todo("will bind input to value of property")
})