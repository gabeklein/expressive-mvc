import Controller from "./adapter";

class TestValues extends Controller {
  value1 = 1;
  value2 = 2;
  value3 = 3;

  get value4(){
    return this.value3 + 1;
  }
}

it('will watch values selected via function', async () => {
  const instance = TestValues.create();
  const mock = jest.fn();

  instance.effect( 
    mock,
    x => x
    .value1
    .value2
    .value3
    .value4
  );

  const update = instance.once("value1");

  instance.value1 = 2;
  instance.value2 = 3;
  instance.value3 = 4;

  await update;
  
  expect(mock).toBeCalledTimes(4)
})