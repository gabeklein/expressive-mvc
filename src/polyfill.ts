const { defineProperty: define } = Object;

interface Set<T> extends Array<T> {
  new<T>(): Set<T>;
  add(item: T): void;
  delete(item: T): void;
  clear(): void;
}

function Set<T>(){
  const content = [] as T[];

  define(content, "add", {
    value(x: T){
      if(content.indexOf(x) < 0)
        content.push(x);
    }
  })

  define(content, "delete", {
    value(x: T){
      const i = content.indexOf(x);
      if(i >= 0)
        content.splice(i, 1);
    }
  })

  define(content, "clear", {
    value(){
      content.splice(0, content.length);
    }
  })

  return content as Set<T>;
}

export { Set }