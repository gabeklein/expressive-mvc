import { Oops } from "../src/binding";

import { Model, renderHook, binds } from "./adapter";

describe("bind", () => {
  class Form extends Model {
    username = "";
    password = "";
    birthday = 0;

    ref = binds(this);
  }

  it('will block bind access outside of hooks', ()  => {
    const attempt = () => Form.create().ref;
    const expected = Oops.BindNotAvailable();
    
    expect(attempt).toThrowError(expected);
  })
  
  it('contains ref-functions cooresponding to values', async () => {
    const { result } = renderHook(() => Form.use());
    const { ref, get: instance } = result.current;

    for(const key in instance.export())
      expect(ref).toHaveProperty(key);
  })

  // how do I actually test this?
  it.todo("will bind element to value of property")
  it.todo("will bind input to value of property")
})