import { Component } from '@expressive/mvc';

/**
 * A Component which may transform the rendered text of its subtree.
 * The renderer applies `format` to composed child output at paint time;
 * it must be pure - same input and state, same output.
 */
class Block extends Component {
  format(text: string): string {
    return text;
  }
}

export { Block };
