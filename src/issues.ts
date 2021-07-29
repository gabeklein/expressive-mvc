type MessageVar = string | number | boolean | null;
type ExpectVars<T> = T extends (...args: infer T) => any ? T : never;

type Messages = {
  [named: string]: (...args: MessageVar[]) => string;
}

type Issues<M extends Messages> = {
  readonly [P in keyof M]: (...args: ExpectVars<M[P]>) => Issue;
}

class Issue extends Error {
  // drop first line (error factory) in stack trace.
  stack = this.stack.replace(/\n.+/, "") as string;

  warn(){
    console.warn(this.message);
  }
}

export function issues<M extends Messages>(register: M){
  const Library = {} as any;
  
  for(const name in register)
    Library[name] = (...args: MessageVar[]) => 
      new Issue(register[name].apply(null, args));

  return Library as Issues<M>;
}