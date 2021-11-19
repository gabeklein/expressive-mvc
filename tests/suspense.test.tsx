import React, { Suspense } from 'react';

import { Model, render, suspend } from './adapter';

describe("suspense", () => {
  class Test extends Model {
    endSuspense!: () => void;

    willRender = suspend(() => (
      new Promise<void>(res => {
        this.endSuspense = res;
      })
    ))
  }

  it('will fallback if willRender is a suspend instruction', async () => {
    const test = Test.create();
  
    let waiting = false;
    let rendered = false;
  
    const Waiting = () => {
      waiting = true;

      return <div>Waiting...</div>;
    }
  
    const Component = () => {
      void test.tap();
      rendered = true;
  
      return <div>Content!</div>;
    }

    expect(waiting).toBe(false);
  
    render(
      <Suspense fallback={<Waiting/>}>
        <Component />
      </Suspense>
    )
  
    expect(waiting).toBe(true);
    expect(rendered).toBe(false);

    test.endSuspense();

    await test.update();

    expect(rendered).toBe(true);
  })
})