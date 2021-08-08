import { Model, renderHook } from './adapter';

describe("built-in", () => {
  it('calls `didCreate` when initialized', () => {
    class Subject extends Model {
      didCreate(){
        mock(this);
      }
    }

    const mock = jest.fn();
    const test = Subject.create();

    expect(mock).toHaveBeenCalledWith(test);
  })

  it('calls `willDestroy` will when killed', () => {
    class Subject extends Model {
      willDestroy(){
        mock(this);
      }
    }

    const mock = jest.fn();
    const test = Subject.create();

    test.destroy();

    expect(mock).toHaveBeenCalledWith(test);
  })
})

describe("lifecycle", () => {
  class Test extends Model {
    didMount = jest.fn();
    willRender = jest.fn();
    willMount = jest.fn();
    willUnmount = jest.fn();
    willUpdate = jest.fn();

    elementDidMount = jest.fn();
    elementWillRender = jest.fn();
    elementWillMount = jest.fn();
    elementWillUnmount = jest.fn();
    elementWillUpdate = jest.fn();

    componentDidMount = jest.fn();
    componentWillRender = jest.fn();
    componentWillMount = jest.fn();
    componentWillUnmount = jest.fn();
    componentWillUpdate = jest.fn();
  }

  describe("event methods", () => {
    function expectToBeCalled(
      as: string | symbol | false | number | undefined,
      methods: jest.Mock<any, any>[]){
  
      for(const mock of methods)
        if(as === false)
          expect(mock).not.toBeCalled();
        else
          expect(mock).toBeCalledWith(as);
    }

    describe("use", () => {
      it("will call component methods", async () => {
        const element = renderHook(() => Test.use());
        const x = element.result.current;
    
        expectToBeCalled(undefined, [
          x.willRender, x.componentWillRender,
          x.willMount, x.componentWillMount,
          x.didMount, x.componentDidMount
        ]);
    
        expectToBeCalled(false, [
          x.willUpdate, x.componentWillUpdate,
          x.willUnmount, x.componentWillUnmount,
        ]);
        
        element.rerender();
    
        expectToBeCalled(undefined, [
          x.willUpdate, x.componentWillUpdate
        ]);
    
        element.unmount();
    
        expectToBeCalled(undefined, [
          x.willUnmount, x.componentWillUnmount
        ]);
      })
  
      it("will not call element methods", async () => {
        const element = renderHook(() => Test.use());
        const test = element.result.current;
    
        expectToBeCalled(false, [
          test.elementWillRender,
          test.elementWillMount,
          test.elementDidMount
        ]);
      })
    })

    describe("tag", () => {
      it("will call element methods", async () => {
        const x = Test.create();
        const identifier = "foobar";
    
        const element = renderHook(() => x.tag(identifier));
    
        expectToBeCalled(identifier, [
          x.willRender, x.elementWillRender,
          x.willMount, x.elementWillMount,
          x.didMount, x.elementDidMount
        ]);
    
        expectToBeCalled(false, [
          x.willUpdate, x.elementWillUpdate,
          x.willUnmount, x.elementWillUnmount,
        ]);
        
        element.rerender();
    
        expectToBeCalled(identifier, [
          x.willUpdate, x.elementWillUpdate
        ]);
    
        element.unmount();
    
        expectToBeCalled(identifier, [
          x.willUnmount, x.elementWillUnmount
        ]);
      })
  
      it("will not call component methods", async () => {
        const test = Test.create();
    
        renderHook(() => test.tag("foobar"));
    
        expectToBeCalled(false, [
          test.componentWillRender,
          test.componentWillMount,
          test.componentDidMount
        ]);
      })

      it("will pass a value to method", async () => {
        const test = Test.create();
        const identifier = Symbol("foobar");
    
        renderHook(() => test.tag(identifier));
    
        expectToBeCalled(identifier, [ test.willRender ]);
      })
  
      it("will pass a value from factory", async () => {
        const test = Test.create();
        const identifier = Symbol("foobar");
        const factory = (on: Test) => {
          expect(on).toBe(test);
          return identifier;
        }
    
        renderHook(() => test.tag(factory));
    
        expectToBeCalled(identifier, [ test.willRender ]);
      })
  
      it("will pass 0 if no value provided", () => {
        const test = Test.create();
        renderHook(() => test.tag());
  
        expectToBeCalled(0, [ test.willRender ]);
      })
    })
  })

  describe("event listeners", () => {
    function eventChecker(
      source: any,
      keys: string[]){
    
      const capture = jest.fn();
  
      source.on(keys as any[], capture);
  
      return (names: string[], expected = true) => {
        for(const name of names){
          let check = expect(capture);
  
          if(expected == false)
            check = check.not as jest.JestMatchers<any>;
  
          check.toBeCalledWith(undefined, name)
        }
      }
    }

    it("will emit component events", async () => {
      let expect!: (names: string[], expected?: boolean) => void;

      class LocalTest extends Test {
        constructor(){
          super();

          expect = eventChecker(this, [
            "didMount", "componentDidMount",
            "willRender", "componentWillRender",
            "willMount", "componentWillMount",
            "willUpdate", "componentWillUpdate",
            "willUnmount", "componentWillUnmount"
          ])
        }
      }
      const element = renderHook(() => LocalTest.use());
      const x = element.result.current;

      await x.requestUpdate();
  
      expect([
        "willRender", "componentWillRender",
        "willMount", "componentWillMount",
        "didMount", "componentDidMount"
      ])
  
      expect([
        "willUpdate", "componentWillUpdate",
        "willUnmount", "componentWillUnmount"
      ], false);
      
      element.rerender();
      await x.requestUpdate();
  
      expect([
        "willUpdate", "componentWillUpdate"
      ]);
  
      element.unmount();
      await x.requestUpdate();
  
      expect([
        "willUnmount", "componentWillUnmount"
      ]);
    })
    
    it("will emit element events", async () => {
      const x = Test.create();

      const expect = eventChecker(x, [
        "didMount", "elementDidMount",
        "willRender", "elementWillRender",
        "willMount", "elementWillMount",
        "willUpdate", "elementWillUpdate",
        "willUnmount", "elementWillUnmount"
      ])

      const element = renderHook(() => x.tag("foobar"));
      await x.requestUpdate();
  
      expect([
        "willRender", "elementWillRender",
        "willMount", "elementWillMount",
        "didMount", "elementDidMount"
      ])
  
      expect([
        "willUpdate", "elementWillUpdate",
        "willUnmount", "elementWillUnmount"
      ], false);
      
      element.rerender();
      await x.requestUpdate();
  
      expect([
        "willUpdate", "elementWillUpdate"
      ]);
  
      element.unmount();
      await x.requestUpdate();
  
      expect([
        "willUnmount", "elementWillUnmount"
      ]);
    })
  })
})