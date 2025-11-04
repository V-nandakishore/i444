import { makeChatDao, ChatDao, FindParams1 } from './chat-dao.js';

import * as T from './chat-types.js';
import { Errors as E } from 'cs444-js-utils';

export async function makeChat(dbUrl: string)
  : Promise<E.Result<Chat, E.Errs>> 
{
  const result = await makeChatDao(dbUrl);
  return (result.isOk === false)
    ? result.into<Chat>()
    : E.okResult(new Chat(result.val));
}

export class Chat implements T.Chat {

  constructor(private readonly dao: ChatDao) { }

  async close() : Promise<E.Result<void, E.Errs>> {
    return await this.dao.close();
  }
  
  async clear() : Promise<E.Result<void, E.Errs>> {
    return await this.dao.clear();
  }
  
  /** create a new user and return its newly generated ID */
  async makeUser(user: Record<string, any>)
    : Promise<E.Result<T.UserIdX, E.Errs>>
  {
    const chk = T.validate<T.RawUser>('makeUser', user);
    if (!chk.isOk) return chk;
    return await this.dao.makeUser(chk.val);
  }

  /** return user-info for previously created user */
  async getUser(userKey: Record<string, any>)
    : Promise<E.Result<T.User, E.Errs>>
  {
    const chk = T.validate<T.UserKey>('getUser', userKey);
    if (!chk.isOk) return chk;
    return await this.dao.getUser(chk.val);
  }

  /** update previously created user specified by id with updates.
   *  (will simply update lastUpdateTime if updates are empty).
   */
  async updateUser(id: T.UserIdX, updates: Record<string, any>)
    : Promise<E.Result<T.User, E.Errs>>
  {
    const chk = T.validate<Partial<T.RawUser>>('updateUser', updates);
    if (!chk.isOk) return chk;    
    return await this.dao.updateUser({id}, chk.val);
  }

  
  /** create a new chat room and return its newly generated ID */
  async makeChatRoom(room: Record<string, any>)
    : Promise<E.Result<T.RoomIdX, E.Errs>>
  {
    const chk = T.validate<T.RawChatRoom>('makeChatRoom', room);
    if (!chk.isOk) return chk;    
    return await this.dao.makeChatRoom(chk.val);
  }

  /** return info for previously created chat room */
  async getChatRoom(roomKey: Record<string, any>)
    : Promise<E.Result<T.ChatRoom, E.Errs>>
  {
    const chk = T.validate<T.RoomKey>('getChatRoom', roomKey);
    if (!chk.isOk) return chk;    
    return await this.dao.getChatRoom(chk.val);
  }

  
  /** create a new chat msg and return its newly generated ID */
  async makeChatMsg(chatMsg: Record<string, any>)
    : Promise<E.Result<T.MsgIdX, E.Errs>>
  {
    const chk = T.validate<T.RawChatMsg>('makeChatMsg', chatMsg);
    if (!chk.isOk) return chk;    
    return this.dao.makeChatMsg(chk.val);
  }

  /** return info for previously created chat msgs which satisfy
   *  findParams (including Page params if any), sorted in
   *  non-ascending order by creationTime and then in non-descending
   *  order by msg.  Returns [] if there are no matching messages.
   */
  async findChatMsgs(findParams: Record<string, any>)
    : Promise<E.Result<T.ChatMsg[], E.Errs>>
  {
    const chk = T.validate<T.FindParams>('findChatMsgs', findParams);
    if (!chk.isOk) return chk;    
    return await this.dao.findChatMsgs(chk.val);
  }

}
