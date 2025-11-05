// @ts-nocheck

import * as mongo from "mongodb";

import * as T from "./chat-types.js";
import { Errors as E } from "cs444-js-utils";

export async function makeChatDao(dbUrl: string) {
  return await ChatDao.make(dbUrl);
}

//options for new MongoClient()
const MONGO_OPTIONS = {
  //ignoreUndefined: true,  //ignore undefined fields in queries
};

//always store external id fields as mongo _id fields
type DbType<IdX, T extends { id: IdX }> = Omit<T, "id"> & { _id: IdX };

type DbUser = DbType<T.UserIdX, T.User>;
type DbChatRoom = DbType<T.RoomIdX, T.ChatRoom>;
type ChatMsg1 = Omit<T.ChatMsg, "chatName" | "roomName"> & {
  userId: T.UserIdX;
  roomId: T.RoomIdX;
};
type RawChatMsg1 = Omit<ChatMsg1, "id" | "creationTime">;
type DbChatMsg = DbType<T.MsgIdX, ChatMsg1>;

export type FindParams1 = Omit<T.FindParams, "chatName" | "roomName"> & {
  userId?: T.UserIdX;
  roomId: T.RoomIdX;
};

type DbQuery = {
  _id?: T.MsgIdX;
  userId?: T.UserIdX;
  roomId: T.RoomIdX;
  $text?: { $search: string };
  creationTime?: { $lte?: T.Iso8601X; $gte?: T.Iso8601X };
};

const ID_GEN_KEY = "NextId" as const;
type IdGen = {
  _id: typeof ID_GEN_KEY;
  [ID_GEN_KEY]: number;
};

export class ChatDao {
  //called by below static make() factory function with
  //parameters to be cached in this instance.
  constructor(
    private readonly client: mongo.MongoClient,
    private readonly users: mongo.Collection<DbUser>,
    private readonly rooms: mongo.Collection<DbChatRoom>,
    private readonly msgs: mongo.Collection<DbChatMsg>,
    private readonly idGen: mongo.Collection<IdGen>
  ) {}

  //static factory function; should do all async operations like
  //getting a connection and creating indexes.  Finally, it
  //should use the constructor to return an instance of this class.
  //returns error code DB on database errors.
  static async make(dbUrl: string): Promise<E.Result<ChatDao, E.Errs>> {
    try {
      const client = await new mongo.MongoClient(
        dbUrl,
        MONGO_OPTIONS
      ).connect();
      const db = client.db();

      const users = db.collection<DbUser>("users");
      await users.createIndex({ email: 1 }, { unique: true });
      await users.createIndex({ chatName: 1 }, { unique: true });

      const rooms = db.collection<DbChatRoom>("rooms");
      await rooms.createIndex({ roomName: 1 }, { unique: true });

      const msgs = db.collection<DbChatMsg>("msgs");
      await msgs.createIndex({ roomId: 1 });
      await msgs.createIndex({ userId: 1 });
      await msgs.createIndex({ creationTime: -1 });
      await msgs.createIndex({ msg: "text" });

      const idGen = db.collection<IdGen>("idGen");

      const dao = new ChatDao(client, users, rooms, msgs, idGen);
      return E.okResult(dao);
    } catch (error) {
      return E.errResult(E.errs((error as Error).message, "E_DB"));
    }
  }

  /** close off this DAO; implementing object is invalid after
   *  call to close()
   *
   *  Error Codes:
   *    E_DB: a database error was encountered.
   */
  async close(): Promise<E.Result<void, E.Errs>> {
    try {
      await this.client.close();
      return E.okResult(undefined);
    } catch (e) {
      return E.errResult(E.errs((e as Error).message, "E_DB"));
    }
  }

  /** clear all data in this DAO.
   *
   *  Error Codes:
   *    E_DB: a database error was encountered.
   */
  async clear(): Promise<E.Result<void, E.Errs>> {
    try {
      await this.users.deleteMany({});
      await this.rooms.deleteMany({});
      await this.msgs.deleteMany({});
      await this.idGen.deleteMany({});
      return E.okResult(undefined);
    } catch (e) {
      return E.errResult(E.errs((e as Error).message, "E_DB"));
    }
  }

  /** create a new user and return its newly generated ID
   *
   *  Errors:
   *    E_EXISTS:  chatName or email already exists.
   */
  async makeUser(user: T.RawUser): Promise<E.Result<T.UserIdX, E.Errs>> {
    try {
      const id = T.brand<T.UserIdX>(await this.nextId());
      const now = T.brand<T.Iso8601X>(new Date().toISOString());
      const dbUser: DbUser = {
        ...user,
        _id: id,
        creationTime: now,
        lastUpdateTime: now,
      };
      await this.users.insertOne(dbUser);
      return E.okResult(T.brand<T.UserIdX>(id));
    } catch (e) {
      if (e instanceof mongo.MongoError && (e.code ?? 0) === MONGO_UNIQUE_ERR) {
        return E.errResult(
          E.errs(`user email or chatName already exists`, "E_EXISTS")
        );
      } else {
        return E.errResult(E.errs((e as Error).message, "E_DB"));
      }
    }
  }

  /** return user-info for previously created user
   *
   *  Errors:
   *    E_NOT_FOUND:  no user for id
   */
  async getUser(query: T.UserKey): Promise<E.Result<T.User, E.Errs>> {
    try {
      const query1 = "id" in query ? { _id: query.id } : query;
      const user = await this.users.findOne(query1);
      if (user) {
        const { _id: id, ...user1 } = user;
        return E.okResult({ ...user1, id });
      } else {
        const [[k, v]] = Object.entries(query);
        const msg = `no user with ${k} '${v}'`;
        return E.errResult(E.errs(msg, "E_NOT_FOUND", k));
      }
    } catch (e) {
      return E.errResult(E.errs((e as Error).message, "E_DB"));
    }
  }

  /** update previously created user specified by id|email|chatName
   *  with specified updates.
   *
   *  Errors:
   *    E_EXISTS:  chatName or email already exists.
   */
  async updateUser(
    query: { id: T.UserIdX } | { email: T.EmailX } | { chatName: T.NameX },
    updates: Partial<T.RawUser>
  ): Promise<E.Result<T.User, E.Errs>> {
    try {
      const now = T.brand<T.Iso8601X>(new Date().toISOString());
      const query1 = "id" in query ? { _id: query.id } : query;
      const options = { returnDocument: mongo.ReturnDocument.AFTER };
      const updates1 = { ...updates, lastUpdateTime: now };
      const result = await this.users.findOneAndUpdate(
        query1,
        { $set: updates1 },
        options
      );
      if (result !== null) {
        const { _id: id, ...user } = result;
        return E.okResult({ ...user, id });
      } else {
        const [[k, v]] = Object.entries(query);
        const msg = `no user having ${k}'${v}'`;
        return E.errResult(E.errs(msg, "E_NOT_FOUND", k));
      }
    } catch (e) {
      if (e instanceof mongo.MongoError && (e.code ?? 0) === 11000) {
        return E.errResult(
          E.errs(`user email or chatName already exists`, "E_EXISTS")
        );
      } else {
        return E.errResult(E.errs((e as Error).message, "E_DB"));
      }
    }
  }

  /** create a new chat room and return its newly generated ID
   *
   *  Errors:
   *    E_EXISTS:  name already exists.
   */
  async makeChatRoom(
    room: T.RawChatRoom
  ): Promise<E.Result<T.RoomIdX, E.Errs>> {
    try {
      const now = T.brand<T.Iso8601X>(new Date().toISOString());
      const id = T.brand<T.RoomIdX>(await this.nextId());
      const dbRoom: DbChatRoom = {
        ...room,
        _id: id,
        creationTime: now,
        lastUpdateTime: now,
      };
      await this.rooms.insertOne(dbRoom);
      return E.okResult(T.brand<T.RoomIdX>(id));
    } catch (e) {
      if (e instanceof mongo.MongoError && (e.code ?? 0) === 11000) {
        const msg = `chat room ${room.roomName} already exists`;
        return E.errResult(E.errs(msg, "E_EXISTS"));
      } else {
        return E.errResult(E.errs((e as Error).message, "E_DB"));
      }
    }
  }

  /** return info for previously created chat room
   *
   *  Errors:
   *    E_NOT_FOUND:  no room for id
   */
  async getChatRoom(query: T.RoomKey): Promise<E.Result<T.ChatRoom, E.Errs>> {
    try {
      const query1 = "id" in query ? { _id: query.id } : query;
      const room = await this.rooms.findOne(query1);
      if (room) {
        const { _id: id, ...room1 } = room;
        return E.okResult({ ...room1, id });
      } else {
        const [[k, v]] = Object.entries(query);
        const msg = `no room having ${k} '${v}'`;
        return E.errResult(E.errs(msg, "E_NOT_FOUND", k));
      }
    } catch (e) {
      return E.errResult(E.errs((e as Error).message, "E_DB"));
    }
  }

  /** create a new chat msg and return its newly generated ID */
  async makeChatMsg(
    chatMsg: T.RawChatMsg
  ): Promise<E.Result<T.MsgIdX, E.Errs>> {
    //could put into a transaction
    const { chatName, roomName, ...rest } = chatMsg;
    const userResult = await this.getUser({ chatName });
    if (!userResult.isOk) return userResult.into<T.MsgIdX>();
    const user = userResult.val;
    const roomResult = await this.getChatRoom({ roomName });
    if (!roomResult.isOk) return roomResult.into<T.MsgIdX>();
    const room = roomResult.val;
    const chatMsg1 = { ...rest, userId: user.id, roomId: room.id };
    return await this.makeChatMsgLo(chatMsg1);
  }

  /** create a new chat msg and return its newly generated ID
   *
   *  Errors:
   *    E_EXISTS:  name already exists.
   */
  async makeChatMsgLo(msg: RawChatMsg1): Promise<E.Result<T.MsgIdX, E.Errs>> {
    try {
      const id = T.brand<T.MsgIdX>(await this.nextId());
      const dbMsg: DbChatMsg = {
        ...msg,
        _id: id,
        creationTime: T.brand<T.Iso8601X>(new Date().toISOString()),
      };
      await this.msgs.insertOne(dbMsg);
      return E.okResult(T.brand<T.MsgIdX>(id));
    } catch (e) {
      return E.errResult(E.errs((e as Error).message, "E_DB"));
    }
  }

  /** return info for previously created chat msgs which satisfy
   *  findParams (including Page params if any), sorted in
   *  non-ascending order by creationTime and then in non-descending
   *  order by msg.  Returns [] if there are no matching messages.
   */
  async findChatMsgs(
    findParams: T.FindParams
  ): Promise<E.Result<T.ChatMsg[], E.Errs>> {
    //could put into transaction
    const { chatName, roomName, ...rest } = findParams;
    const roomResult = await this.getChatRoom({ roomName });
    if (!roomResult.isOk) return roomResult.into<T.ChatMsg[]>();
    const room = roomResult.val;
    const findParams1: FindParams1 = { roomId: room.id, ...rest };
    let user: T.User | undefined = undefined;
    if (chatName !== undefined) {
      const result = await this.getUser({ chatName });
      if (!result.isOk) return result.into<T.ChatMsg[]>();
      user = result.val;
      findParams1.userId = user.id;
    }
    const result = await this.findChatMsgsLo(findParams1);
    if (!result.isOk) return result;
    const chatMsgs: T.ChatMsg[] = [];
    for (const msgResult of result.val) {
      const { userId, roomId, ...rest } = msgResult;
      console.assert(room.id === roomId);
      let user1: T.User;
      if (user !== undefined && user.id === userId) {
        user1 = user;
      } else {
        const result = await this.getUser({ id: userId });
        if (!result.isOk) return result.into<T.ChatMsg[]>();
        user1 = result.val;
      }
      chatMsgs.push({ ...rest, roomName, chatName: user1.chatName });
    }
    return E.okResult(chatMsgs);
  }

  /** return info for previously created chat msgs satisfied by
   *  search-params search, sorted in descending order by
   *  creationTime, selected by Page parameters included in search (if
   *  any).
   */
  private async findChatMsgsLo(
    search: FindParams1
  ): Promise<E.Result<ChatMsg1[], E.Errs>> {
    try {
      const {
        offset = 0,
        limit = T.PAGE_SIZE,
        id,
        words,
        earliest,
        latest,
        ...query1
      } = search;
      const query: DbQuery = query1;
      if (id !== undefined) query._id = id;
      if (words !== undefined) query.$text = { $search: words };
      if (earliest !== undefined && latest !== undefined) {
        query.creationTime = {
          $gte: earliest,
          $lte: latest,
        };
      } else if (earliest !== undefined) {
        query.creationTime = { $gte: earliest };
      } else if (latest !== undefined) {
        query.creationTime = { $lte: latest };
      }
      const msgsCursor = await this.msgs
        .find(query)
        .sort({ creationTime: -1, msg: 1, _id: 1 })
        .skip(offset)
        .limit(limit);
      const dbMsgs = await msgsCursor.toArray();
      const msgs = dbMsgs.map((m: DbChatMsg) => {
        const { _id, ...m1 } = m;
        return { ...m1, id: T.brand<T.MsgIdX>(_id) };
      });
      return E.okResult(msgs);
    } catch (e) {
      return E.errResult(E.errs((e as Error).message, "E_DB"));
    }
  }

  // Returns a unique, difficult to guess id.
  // db exceptions caught by callers
  // See discussion in
  // <https://www.mongodb.com/resources/products/fundamentals/generating-globally-unique-identifiers-for-use-with-mongodb>
  private async nextId() {
    const query = { _id: ID_GEN_KEY };
    const update = { $inc: { [ID_GEN_KEY]: 1 } };
    const options = {
      upsert: true,
      returnDocument: mongo.ReturnDocument.AFTER,
    };
    const ret = (await this.idGen.findOneAndUpdate(query, update, options))!;
    const seq = ret[ID_GEN_KEY];
    return String(seq) + Math.random().toFixed(RAND_LEN).replace(/^0\./, "_");
  }
}

//error code within mongo exception indicating a violation of a
//uniqueness constraint.
const MONGO_UNIQUE_ERR = 11000;

const RAND_LEN = 2; //for devel
