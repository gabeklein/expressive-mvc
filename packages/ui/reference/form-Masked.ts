import { ref } from '@expressive/react';
import IMask, { FactoryArg, InputMask } from 'imask';

import { Input } from './Input';

const MASKS = new WeakMap<Masked, InputMask<any>>();

export class Masked extends Input {
  mask: FactoryArg | MaskType | undefined = undefined;

  ref = ref(this.bind);

  bind(input: HTMLInputElement) {
    let { mask } = this;

    if (mask) {
      const opts = typeof mask == 'string' ? fromString(mask) : mask;
      const i = IMask(input, opts);
      i.on('accept', () => {
        this.value = i.value;
      });
      this.get(({ value }) => {
        if (i.value !== value) {
          i.value = value == null ? '' : String(value);
        }
      });
      MASKS.set(this, i);
      return () => {
        i.destroy();
        MASKS.delete(this);
      };
    }

    const event = () => (this.value = input.value);

    this.get(({ value }) => {
      input.value = value == null ? '' : String(value);
    });

    input.addEventListener('input', event);

    return () => {
      input.removeEventListener('input', event);
    };
  }

  valid(self: this): Async<boolean | void> {
    const { value, optional } = this;

    if ((value === undefined || value === '') && !optional)
      throw new Error(`Required`);

    // TODO: fix bug; can't call super
    // await super.valid();

    const i = MASKS.get(this);

    if (this.value && i && i.masked) {
      i.value = this.value;

      if (!i.masked.isComplete) throw new Error('Input is not complete.');
    }
  }
}

type MaskType = 'number' | 'phone' | 'time' | string;

function fromString(mask: MaskType): FactoryArg {
  if (mask === 'number')
    return {
      mask: Number
    };

  if (mask === 'phone')
    return {
      mask: '000-000-0000',
      placeholderChar: '_'
    };

  if (mask === 'time')
    return {
      overwrite: true,
      autofix: true,
      mask: 'h{:}mmA',
      lazy: false,
      blocks: {
        h: {
          mask(value: any) {
            if (isNaN(value)) return false;
            const int_value = parseInt(value);
            return value.length < 3 && 0 <= int_value && int_value <= 12;
          },
          maxLength: 2
        },
        mm: {
          mask: IMask.MaskedRange,
          placeholderChar: '0',
          from: 0,
          to: 59,
          maxLength: 2
        },
        A: {
          mask: IMask.MaskedEnum,
          enum: ['am', 'pm'],
          ignoreCase: true
        }
      }
    };

  return {
    mask,
    lazy: true
  };
}
