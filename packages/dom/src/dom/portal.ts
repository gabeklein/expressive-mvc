import { Portal as Hosted } from '../node/vnode';
import type { Node } from '../node/vnode';

const Portal = Hosted as (props: { into: Element | DocumentFragment | string; children?: Node }) => Node;

export { Portal };
