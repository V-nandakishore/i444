import { Errors as E } from "cs444-js-utils";

/** A branded type ensures that strings used for distinct purposes
 *  have distinct types.  This is purely a TS concept and there is no
 *  runtime overhead.
 *
 *  We choose to create branded types for IDs and strings which
 *  require non-trivial syntactic validation.
 */
export type UserIdX = string & { readonly __brand: "userId" };
export type RoomIdX = string & { readonly __brand: "roomId" };
export type MsgIdX = string & { readonly __brand: "msgId" };
export type EmailX = string & { readonly __brand: "email" };
export type Iso8601X = string & { readonly __brand: "iso8601" };
export type NameX = string & { readonly __brand: "name" };

/** can be used to brand literal or automatically generated strings */
export function brand<T>(raw: string) {
  return raw as T;
}

export type User = {
  id: UserIdX;
  chatName: NameX; //must be unique across all users
  firstName: NameX;
  lastName: NameX;
  email: EmailX; //must be unique across all users
  creationTime: Iso8601X;
  lastUpdateTime: Iso8601X;
};

//A User without the auto-created fields.
export type RawUser = Omit<User, "id" | "creationTime" | "lastUpdateTime">;

export type ChatRoom = {
  id: RoomIdX;
  roomName: NameX; //must be unique across all chat-rooms
  descr: string;
  creationTime: Iso8601X;
  lastUpdateTime: Iso8601X; //for future updates
};

//A ChatRoom without the auto-created fields.
export type RawChatRoom = Omit<
  ChatRoom,
  "id" | "creationTime" | "lastUpdateTime"
>;

export type ChatMsg = {
  id: MsgIdX;
  roomName: NameX;
  chatName: NameX;
  msg: string;
  creationTime: Iso8601X;
};

//A ChatMsg without the auto-created fields.
export type RawChatMsg = Omit<ChatMsg, "id" | "creationTime">;

/** used for paging from multiple search results */
export type Page = {
  offset?: number; //offset in search results; default 0
  limit?: number; //max # of results in one page; default PAGE_SIZE
};

/** used for searching for chat messages; note that all params except
 * roomName are optional.
 */
export type FindParams = {
  id?: MsgIdX; //at most 1 result if specified
  roomName: NameX; //room name of chat room
  chatName?: NameX; //chat name of user who posted chat-msg
  words?: string; //match requires case-insensitive match one word in words
  earliest?: Iso8601X; //inclusive lower bound on creationTime
  latest?: Iso8601X; //inclusive upper bound on creationTime
} & Page;

/** a user can be looked up by id, chatName or email */
export type UserKey = { id: UserIdX } | { chatName: NameX } | { email: EmailX };

/** a chat-room can be looked up by id or roomName */
export type RoomKey = { id: RoomIdX } | { roomName: NameX };

/** All methods return a E.Result<T, E.Errs> for success type T.
 *  The error code which can be returned are:
 *
 *    `E_BAD_VAL`: a parameter has a bad value.
 *    `E_DB`: a database error occurred.
 *    `E_EXISTS`: a entity already exists for a unique field.
 *    `E_NOT_FOUND`: an expected entity does not exist.
 *
 *  The message should provide a human-readable description of
 *  the error (being as specific as possible).
 */
export interface Chat {
  /** create a new user and return its newly generated ID */
  makeUser(user: RawUser): Promise<E.Result<UserIdX, E.Errs>>;

  /** return user-info for previously created user */
  getUser(userKey: UserKey): Promise<E.Result<User, E.Errs>>;

  /** update previously created user specified by id with updates.
   *  (will simply update lastUpdateTime if updates are empty).
   
   */
  updateUser(
    id: UserIdX,
    updates: Partial<RawUser>
  ): Promise<E.Result<User, E.Errs>>;

  /** create a new chat room and return its newly generated ID */
  makeChatRoom(room: RawChatRoom): Promise<E.Result<RoomIdX, E.Errs>>;

  /** return info for previously created chat room */
  getChatRoom(roomKey: RoomKey): Promise<E.Result<ChatRoom, E.Errs>>;

  /** create a new chat msg and return its newly generated ID */
  makeChatMsg(chatMsg: RawChatMsg): Promise<E.Result<MsgIdX, E.Errs>>;

  /** return info for previously created chat msgs which satisfy
   *  findParams (including Page params if any), sorted in
   *  non-ascending order by creationTime, then in non-descending
   *  order by msg and finally in ascending order by id.
   *  Returns [] if there are no matching messages.
   */
  findChatMsgs(findParams: FindParams): Promise<E.Result<ChatMsg[], E.Errs>>;

  /** close this chat structure */
  close(): Promise<E.Result<void, E.Errs>>;

  /** clear out all data */
  clear(): Promise<E.Result<void, E.Errs>>;
}

// # of results per page, when paging through results
export const PAGE_SIZE = 5;
