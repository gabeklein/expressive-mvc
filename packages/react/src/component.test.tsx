import { it, act, render } from '../vitest';
import { Component } from './component';

it('will render MockComponent', async () => {
  class MockComponent extends Component {
    something = 'World';

    render() {
      return <p>Hello {this.something}</p>;
    }
  }

  let test!: MockComponent;

  const element = render(<MockComponent is={(x) => (test = x)} />);

  element.getByText('Hello World');

  element.rerender(<MockComponent something="Tester" />);
  element.getByText('Hello Tester');

  await act(async () => {
    test.something = 'Everyone';
    await test.set();
  });

  element.getByText('Hello Everyone');
});

it('will pass children by default', () => {
  class MockComponent extends Component {}

  const element = render(
    <MockComponent>
      <p>Child Content</p>
    </MockComponent>
  );

  element.getByText('Child Content');
});

it('will render children function', async () => {
  class MockComponent extends Component {
    name = 'Tester';
  }

  let test!: MockComponent;
  const element = render(
    <MockComponent is={(x) => (test = x)}>
      {({ name }) => <p>Hello {name}</p>}
    </MockComponent>
  );

  element.getByText('Hello Tester');

  await act(async () => {
    test.name = 'Everyone';
    await test.set();
  });

  element.getByText('Hello Everyone');
});

it('will provide context to descendants', () => {
  class ParentComponent extends Component {
    value = 'from parent';
  }

  const ChildComponent = () => {
    const parent = ParentComponent.get();

    return <p>Value is {parent.value}</p>;
  };

  const element = render(
    <ParentComponent>
      <ChildComponent />
    </ParentComponent>
  );

  element.getByText('Value is from parent');
});
