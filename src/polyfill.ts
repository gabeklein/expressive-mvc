export class Set<T> extends Array<T> {
  add = (item: T) => {
    if(this.indexOf(item) < 0)
      this.push(item);
  };

  clear = () => {
    this.splice(0, this.length);
  };

  delete = (item: T) => {
    const i = this.indexOf(item);
    if(i >= 0)
      this.splice(i, 1);
  }
}