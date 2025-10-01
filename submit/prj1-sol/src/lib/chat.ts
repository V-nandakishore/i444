import { makeChatDao, ChatDao } from "./chat-dao.js";

import * as T from "./chat-types.js";
import { Errors as E } from "cs444-js-utils";

export async function makeChat(dbUrl: string): Promise<E.Result<Chat, E.Errs>> {
  const result = await makeChatDao(dbUrl);
  return result.isOk === false
    ? result.into<Chat>()
    : E.okResult(new Chat(result.val));
}

export class Chat implements T.Chat {
  constructor(private readonly dao: ChatDao) {}

  //TODO: fill-in below methods; probably only a simple delegation to
  //the DAO.

  async close(): Promise<E.Result<void, E.Errs>> {
    return await this.dao.close();
  }

  async clear(): Promise<E.Result<void, E.Errs>> {
    return await this.dao.clear();
  }

  /** create a new user and return its newly generated ID */
  async makeUser(user: T.RawUser): Promise<E.Result<T.UserIdX, E.Errs>> {
    return await this.dao.makeUser(user);
  }

  /** return user-info for previously created user */
  async getUser(userKey: T.UserKey): Promise<E.Result<T.User, E.Errs>> {
    return await this.dao.getUser(userKey);
  }

  /** update previously created user specified by id with updates.
   *  (will simply update lastUpdateTime if updates are empty).
   */
  async updateUser(
    id: T.UserIdX,
    updates: Partial<T.RawUser>
  ): Promise<E.Result<T.User, E.Errs>> {
    return await this.dao.updateUser(id, updates);
  }

  /** create a new chat room and return its newly generated ID */
  async makeChatRoom(
    room: T.RawChatRoom
  ): Promise<E.Result<T.RoomIdX, E.Errs>> {
    return await this.dao.makeChatRoom(room);
  }

  /** return info for previously created chat room */
  async getChatRoom(roomKey: T.RoomKey): Promise<E.Result<T.ChatRoom, E.Errs>> {
    return await this.dao.getChatRoom(roomKey);
  }

  /** create a new chat msg and return its newly generated ID */
  async makeChatMsg(
    chatMsg: T.RawChatMsg
  ): Promise<E.Result<T.MsgIdX, E.Errs>> {
    return await this.dao.makeChatMsg(chatMsg);
  }

  /** return info for previously created chat msgs which satisfy
   *  findParams (including Page params if any), sorted in
   *  non-ascending order by creationTime and then in non-descending
   *  order by msg.  Returns [] if there are no matching messages.
   */
  async findChatMsgs(
    findParams: T.FindParams
  ): Promise<E.Result<T.ChatMsg[], E.Errs>> {
    return await this.dao.findChatMsgs(findParams);
  }
}
