import './component';
import './useLocal';
import './useRemote';

export {
  Model, Model as default,
  get, use, ref, set, has
} from '@expressive/mvc';

export { Consumer } from "./consumer";
export { Provider } from "./provider";

declare module "./useContext" {
  namespace Pragma {
    
  }
}