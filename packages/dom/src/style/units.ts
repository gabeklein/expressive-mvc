function unit(suffix: string) {
  return (...values: number[]) => values.map((value) => value + suffix).join(' ');
}

const rem = unit('rem');
const em = unit('em');
const px = unit('px');

export { em, px, rem };
