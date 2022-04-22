import { child } from '../instruction/child';
import { Peer, PeerCallback, pendingAccess } from './peer';

export function tap<T extends Peer>(
  type: T, argument?: boolean | PeerCallback<T>){

  return child(
    function tap(key){
      return {
        get: pendingAccess(this.subject, type, key, argument)
      }
    }
  )
};