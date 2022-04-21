export const UPDATE = new WeakMap<{}, readonly string[]>();

export function applyUpdate(
  subject: {}, keys: readonly string[]){

  UPDATE.set(subject, keys);

  return () => {
    setTimeout(() => {
      UPDATE.delete(subject);
    }, 0);
  }
}