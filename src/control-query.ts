import { Controller } from './controller';

export type numeric = string | number;
export type TypeOfArray<T> = T extends (infer U)[] ? U : never;
export type Result = { id: numeric }
export type QueryResponse<R = any> = { results: R[], offset?: numeric }
export type DataSource<X extends QueryResponse, Q = undefined> = (query: Q) => Promise<X>

export function QueryControl
  <X extends QueryResponse<Result>, Q = undefined>
  (resource: DataSource<X, Q>) {

  return class QueryController
    extends BaseQueryController<X, TypeOfArray<X["results"]>, Q> {

    constructor(){
      super(resource)
    }
  }
}

export class BaseQueryController
  <X extends QueryResponse, R extends Result, Q = undefined> 
  extends Controller {

  static global = true;
  
  static select<T extends new () => any>(
    this: T, id: numeric): InstanceType<T> {
      
    const control = (this as any).tap().on('#' + id);
    const item = control.results.get(id);

    const x = Object.create(control);
    x.result = item;

    return x as typeof control;
  }

  constructor(
    public resource: DataSource<X, Q>){
    super();
  }

  state = "ready" as "ready" | "waiting" | "loading";
  query = {} as Q;
  offset?: string | number;

  result!: R;
  results = new Map<numeric, R>();

  isReady(){
    this.observe("query", this.runQuery)
  }
  
  componentWillMount(opts?: Q){
    if(opts){
      Object.assign(this.query, opts)
      this.refresh("query");
    }
  }
  
  async runQuery(opts: Q){
    this.state = "waiting";

    const { results, offset } = await this.resource(this.query);
    
    this.results.clear();
    this.append(results, offset);
    this.state = "ready";
  }

  append = (results: R[], offset?: numeric) => {
    for(const x of results)
      this.results.set(x.id, x);

    this.refresh("results")
  }

  update = (id: number) => {
    this.refresh('#' + id)
  }

  insert = (id: string | number, item: R) => {
    this.results.set(id, item);
    this.refresh("results")
  }
}