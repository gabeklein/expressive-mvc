declare namespace Issue {
  export type Variable = {} | string | number | boolean | null;
  export type Variables<T> = T extends (...args: infer T) => any ? T : never;

  export type Messages = {
    [named: string]: (...args: Variable[]) => string;
  }

  export type Output<M extends Messages> = {
    readonly [P in keyof M]: (...args: Variables<M[P]>) => Issue;
  }
}

export class Issue extends Error {
  // drop first line (error factory) in stack trace.
  stack = this.stack.replace(/\n.+/, "") as string;

  warn(){
    console.warn(this.message);
  }
}

export function issues<M extends Issue.Messages>(register: M){
  const Library = {} as any;

  for(const name in register)
    Library[name] = (...args: Issue.Variable[]) => 
      new Issue(register[name].apply(null, args));

  return Library as Issue.Output<M>;
}