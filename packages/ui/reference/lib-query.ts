import { Model, Observable, use } from '@expressive/react';

interface Results<T> extends Array<T> {
  more?: () => Promise<void>;
  loading?: boolean;
  [Observable]?: (cb: Observable.Callback) => void;
}

interface HasQueryMethod<T> extends Model {
  query(offset?: number): Promise<T[]>;
}

export function results<T>(source: HasQueryMethod<T>): Results<T> {
  return use((key, target: Model) => {
    const method = source.get('query');

    source.get((self) => {
      const results = [] as Results<T>;
      const callbacks = new Set<Observable.Callback>();

      results.more = async () => {
        if (results.loading || results.more === undefined) return;

        results.loading = true;

        const next = await method.call(self, results.length);

        results.loading = false;

        if (next && next.length > 0) {
          results.push(...next);
        } else {
          results.more = undefined;
        }

        callbacks.forEach((cb) => {
          cb();
          callbacks.delete(cb);
        });
      };

      results[Observable] = (cb) => {
        callbacks.add(cb);
        return results;
      };

      target.set(key, results);
    });

    return {
      get: true
    };
  });
}
