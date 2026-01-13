import { render, act } from '@testing-library/react';
import { ReactNode } from 'react';
import { Component } from './component';

it('will render MockComponent', async () => {
  class MockComponent extends Component {
    something = 'World';

    render(): ReactNode {
      return <p>Hello {this.something}</p>;
    }
  }

  let test!: MockComponent;

  const element = render(<MockComponent is={(x) => (test = x)} />);

  expect(element.getByText('Hello World')).toBeInTheDocument();

  element.rerender(<MockComponent something="Tester" />);
  expect(element.getByText('Hello Tester')).toBeInTheDocument();

  await act(async () => {
    test.something = 'Everyone';
    await test.set();
  });

  expect(element.getByText('Hello Everyone')).toBeInTheDocument();
});

it('will render children by default', () => {
  class MockComponent extends Component {}

  const element = render(
    <MockComponent>
      <p>Child Content</p>
    </MockComponent>
  );

  expect(element.getByText('Child Content')).toBeInTheDocument();
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

  expect(element.getByText('Value is from parent')).toBeInTheDocument();
});
