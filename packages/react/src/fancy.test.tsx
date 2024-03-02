import Model from "@expressive/mvc";

it("will do some stuff", () => {
  class FooBar extends Model {
    foo?: string = undefined;
    bar?: string = undefined;
  }

  const Component = () => (
    <FooBar />
  )
})