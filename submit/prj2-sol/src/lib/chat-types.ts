import { zodToResult } from "./zod-utils.js";

import { Errors as E } from "cs444-js-utils";

import { z } from "zod";

// # of results per page, when paging through results
export const PAGE_SIZE = 5;

/** A branded type ensures that strings used for distinct purposes
 *  have distinct types.  This is purely a TS concept and there is no
 *  runtime overhead.
 *
 *  We choose to create branded types for IDs and strings which
 *  require non-trivial syntactic validation.
 */
const zUserIdX = z.string().brand<"userId">();
const zRoomIdX = z.string().brand<"roomId">();
const zMsgIdX = z.string().brand<"msgId">();
const zEmailX = z.string().email().brand<"email">();
const zIso8601X = z.string().datetime().brand<"iso8601">();

const zNameX = z
  .string()
  .regex(/^[\w'-]+(?:\s[\w'-]+)*$/)
  .brand<"name">();

export type UserIdX = z.infer<typeof zUserIdX>;

export type RoomIdX = z.infer<typeof zRoomIdX>;
export type MsgIdX = z.infer<typeof zMsgIdX>;
export type EmailX = z.infer<typeof zEmailX>;
export type Iso8601X = z.infer<typeof zIso8601X>;
export type NameX = z.infer<typeof zNameX>;

/** can be used to brand literal or automatically generated strings */
export function brand<T>(raw: string) {
  return raw as T;
}

const zUser = z.object({
  id: zUserIdX,
  chatName: zNameX, //must be unique across all users
  firstName: zNameX,
  lastName: zNameX,
  email: zEmailX, //must be unique across all users
  creationTime: zIso8601X,
  lastUpdateTime: zIso8601X,
});

export type User = z.infer<typeof zUser>;

//A User without the auto-created fields.
const zRawUser = z
  .object({
    _id: z.never({ message: "_id field forbidden" }).optional(),
    id: z.never({ message: "id field forbidden" }).optional(),
    creationTime: z
      .never({ message: "creationTime field forbidden" })
      .optional(),
    lastUpdateTime: z
      .never({ message: "lastUpdateTime field forbidden" })
      .optional(),
    ...zUser.omit({ id: true, creationTime: true, lastUpdateTime: true }).shape,
  })
  .passthrough();
export type RawUser = z.infer<typeof zRawUser>;

/** a user can be looked up by id, chatName or email */
const zUserKey = z.union([
  z.strictObject({ id: zUserIdX }),
  z.strictObject({ chatName: zNameX }),
  z.strictObject({ email: zEmailX }),
]);
export type UserKey = z.infer<typeof zUserKey>;

const zChatRoom = z.object({
  id: zRoomIdX,
  roomName: zNameX, //must be unique across all chat-rooms
  descr: z.string(),
  creationTime: zIso8601X,
  lastUpdateTime: zIso8601X, //for future updates
});
export type ChatRoom = z.infer<typeof zChatRoom>;

//A ChatRoom without the auto-created fields.
const zRawChatRoom = z
  .object({
    _id: z.never({ message: "_id field forbidden" }).optional(),
    id: z.never({ message: "id field forbidden" }).optional(),
    creationTime: z
      .never({ message: "creationTime field forbidden" })
      .optional(),
    lastUpdateTime: z
      .never({ message: "lastUpdateTime field forbidden" })
      .optional(),
    ...zChatRoom.omit({ id: true, creationTime: true, lastUpdateTime: true })
      .shape,
  })
  .passthrough();

export type RawChatRoom = z.infer<typeof zRawChatRoom>;

/** a chat-room can be looked up by id or roomName */
const zRoomKey = z.union([
  z.strictObject({ id: zRoomIdX }),
  z.strictObject({ roomName: zNameX }),
]);

export type RoomKey = z.infer<typeof zRoomKey>;

const zChatMsg = z.object({
  id: zMsgIdX,
  roomName: zNameX,
  chatName: zNameX,
  msg: z.string(),
  creationTime: zIso8601X,
});

export type ChatMsg = z.infer<typeof zChatMsg>;
//A ChatMsg without the auto-created fields.
const zRawChatMsg = z
  .object({
    _id: z.never({ message: "_id field forbidden" }).optional(),
    id: z.never({ message: "id field forbidden" }).optional(),
    creationTime: z
      .never({ message: "creationTime field forbidden" })
      .optional(),
    ...zChatMsg.omit({ id: true, creationTime: true }).shape,
  })
  .passthrough();

export type RawChatMsg = z.infer<typeof zRawChatMsg>;
/** used for paging from multiple search results */
const zPage = z.object({
  offset: z.preprocess((v) => Number(v), z.int().gte(0)).optional(), //offset in search results; default 0
  limit: z.preprocess((v) => Number(v), z.int().gt(0)).optional(), //max # of results in one page; default PAGE_SIZE
});
export type Page = z.infer<typeof zPage>;

/** used for searching for chat messages; note that all params except
 * roomName are optional.
 */
const zFindParams = z
  .object({
    id: zMsgIdX.optional(), //at most 1 result if specified
    roomName: zNameX, //room name of chat room
    chatName: zNameX.optional(), //chat name of user who posted chat-msg
    words: z.string().optional(), //match requires case-insensitive match one word in words
    earliest: zIso8601X.optional(), //inclusive lower bound on creationTime
    latest: zIso8601X.optional(), //inclusive upper bound on creationTime
    ...zPage.shape,
  })
  .passthrough();

export type FindParams = z.infer<typeof zFindParams>;

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

const VALIDATORS: Record<string, z.ZodSchema> = {
  makeUser: zRawUser,
  updateUser: zRawUser.partial(),
  getUser: zUserKey,
  makeChatRoom: zRawChatRoom,
  getChatRoom: zRoomKey,
  makeChatMsg: zRawChatMsg,
  findChatMsgs: zFindParams,
};

export function validate<T>(
  command: keyof typeof VALIDATORS,
  req: Record<string, any>
): E.Result<T, E.Errs> {
  const validator = VALIDATORS[command] as z.Schema<T>;
  return validator
    ? zodToResult(validator.safeParse(req, { reportInput: true }))
    : E.errResult(E.errs(`no validator for command ${command}`, "INTERNAL"));
}
