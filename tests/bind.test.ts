import { Model, Issue, renderHook } from "./adapter";

describe("bind", () => {
  class Form extends Model {
    username = "";
    password = "";
    birthday = 0;
  }

  it('will block bind access outside of hooks', ()  => {
    const attempt = () => Form.create().bind;
    const expected = Issue.BindNotAvailable();
    
    expect(attempt).toThrowError(expected);
  })
  
  it('contains ref-functions cooresponding to values', async () => {
    const { result } = renderHook(() => Form.use());
    const { bind, get: instance } = result.current;

    for(const key in instance)
      expect(bind).toHaveProperty(key);
  })

  it.todo("will bind element to value of property")
  it.todo("will bind input to value of property")
})