import { install } from '../render/host';
import './types';
import { dom } from './host';

install(dom);

export { css } from './css';
export { dom };
