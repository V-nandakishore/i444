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

type DbChatMsg = Omit<T.ChatMsg, "id" | "chatName" | "roomName"> & {
  _id: T.MsgIdX;
  userId: T.UserIdX;
  roomId: T.RoomIdX;
};

export class ChatDao {
  //called by below static make() factory function with
  //parameters to be cached in this instance.
  constructor(
    private readonly client: mongo.MongoClient,
    private readonly usersCollection: mongo.Collection<DbUser>,
    private readonly roomsCollection: mongo.Collection<DbChatRoom>,
    private readonly msgsCollection: mongo.Collection<DbChatMsg>
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

      const usersCollection = db.collection<DbUser>("users");
      const roomsCollection = db.collection<DbChatRoom>("rooms");
      const msgsCollection = db.collection<DbChatMsg>("messages");

      await usersCollection.createIndex({ email: 1 }, { unique: true });
      await usersCollection.createIndex({ chatName: 1 }, { unique: true });
      await roomsCollection.createIndex({ roomName: 1 }, { unique: true });
      await msgsCollection.createIndex({ msg: "text" });
      await msgsCollection.createIndex({ creationTime: -1, msg: 1, _id: 1 });

      const dao = new ChatDao(
        client,
        usersCollection,
        roomsCollection,
        msgsCollection
      );
      return E.okResult(dao);
    } catch (error) {
      return E.errResult(E.errs((error as Error).message, "E_DB"));
    }
  }

  //TODO: add DAO methods

  private generateId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2);
    return `${timestamp}_${random}`;
  }

  async close(): Promise<E.Result<void, E.Errs>> {
    try {
      await this.client.close();
      return E.okResult(undefined);
    } catch (error) {
      return E.errResult(E.errs((error as Error).message, "E_DB"));
    }
  }

  async clear(): Promise<E.Result<void, E.Errs>> {
    try {
      await this.usersCollection.deleteMany({});
      await this.roomsCollection.deleteMany({});
      await this.msgsCollection.deleteMany({});
      return E.okResult(undefined);
    } catch (error) {
      return E.errResult(E.errs((error as Error).message, "E_DB"));
    }
  }

  async makeUser(user: T.RawUser): Promise<E.Result<T.UserIdX, E.Errs>> {
    try {
      const now = T.brand<T.Iso8601X>(new Date().toISOString());
      const userId = T.brand<T.UserIdX>(this.generateId());

      const dbUser: DbUser = {
        _id: userId,
        chatName: user.chatName,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        creationTime: now,
        lastUpdateTime: now,
      };

      await this.usersCollection.insertOne(dbUser);
      return E.okResult(userId);
    } catch (e) {
      if (e instanceof mongo.MongoError && (e.code ?? 0) === MONGO_UNIQUE_ERR) {
        return E.errResult(
          E.errs(
            `user with email ${user.email} or chatName ${user.chatName} already exists`,
            "E_EXISTS"
          )
        );
      } else {
        return E.errResult(E.errs((e as Error).message, "E_DB"));
      }
    }
  }

  async getUser(userKey: T.UserKey): Promise<E.Result<T.User, E.Errs>> {
    try {
      let query: Partial<DbUser>;
      if ("id" in userKey) {
        query = { _id: userKey.id };
      } else if ("email" in userKey) {
        query = { email: userKey.email };
      } else if ("chatName" in userKey) {
        query = { chatName: userKey.chatName };
      } else {
        return E.errResult(E.errs("invalid user key", "E_BAD_VAL"));
      }

      const dbUser = await this.usersCollection.findOne(query);
      if (!dbUser) {
        return E.errResult(
          E.errs(`no user found for ${JSON.stringify(userKey)}`, "E_NOT_FOUND")
        );
      }

      const user: T.User = {
        id: dbUser._id,
        chatName: dbUser.chatName,
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
        email: dbUser.email,
        creationTime: dbUser.creationTime,
        lastUpdateTime: dbUser.lastUpdateTime,
      };

      return E.okResult(user);
    } catch (error) {
      return E.errResult(E.errs((error as Error).message, "E_DB"));
    }
  }

  async updateUser(
    id: T.UserIdX,
    updates: Partial<T.RawUser>
  ): Promise<E.Result<T.User, E.Errs>> {
    try {
      const now = T.brand<T.Iso8601X>(new Date().toISOString());
      const updateDoc = {
        ...updates,
        lastUpdateTime: now,
      };

      const result = await this.usersCollection.findOneAndUpdate(
        { _id: id },
        { $set: updateDoc },
        { returnDocument: mongo.ReturnDocument.AFTER }
      );

      if (!result) {
        return E.errResult(
          E.errs(`no user found with id ${id}`, "E_NOT_FOUND")
        );
      }

      const user: T.User = {
        id: result._id,
        chatName: result.chatName,
        firstName: result.firstName,
        lastName: result.lastName,
        email: result.email,
        creationTime: result.creationTime,
        lastUpdateTime: result.lastUpdateTime,
      };

      return E.okResult(user);
    } catch (e) {
      if (e instanceof mongo.MongoError && (e.code ?? 0) === MONGO_UNIQUE_ERR) {
        return E.errResult(
          E.errs(`duplicate email or chatName in update`, "E_EXISTS")
        );
      } else {
        return E.errResult(E.errs((e as Error).message, "E_DB"));
      }
    }
  }

  async makeChatRoom(
    room: T.RawChatRoom
  ): Promise<E.Result<T.RoomIdX, E.Errs>> {
    try {
      const now = T.brand<T.Iso8601X>(new Date().toISOString());
      const roomId = T.brand<T.RoomIdX>(this.generateId());

      const dbRoom: DbChatRoom = {
        _id: roomId,
        roomName: room.roomName,
        descr: room.descr,
        creationTime: now,
        lastUpdateTime: now,
      };

      await this.roomsCollection.insertOne(dbRoom);
      return E.okResult(roomId);
    } catch (e) {
      if (e instanceof mongo.MongoError && (e.code ?? 0) === MONGO_UNIQUE_ERR) {
        return E.errResult(
          E.errs(
            `room with roomName ${room.roomName} already exists`,
            "E_EXISTS"
          )
        );
      } else {
        return E.errResult(E.errs((e as Error).message, "E_DB"));
      }
    }
  }

  async getChatRoom(roomKey: T.RoomKey): Promise<E.Result<T.ChatRoom, E.Errs>> {
    try {
      let query: Partial<DbChatRoom>;
      if ("id" in roomKey) {
        query = { _id: roomKey.id };
      } else if ("roomName" in roomKey) {
        query = { roomName: roomKey.roomName };
      } else {
        return E.errResult(E.errs("invalid room key", "E_BAD_VAL"));
      }

      const dbRoom = await this.roomsCollection.findOne(query);
      if (!dbRoom) {
        return E.errResult(
          E.errs(`no room found for ${JSON.stringify(roomKey)}`, "E_NOT_FOUND")
        );
      }

      const room: T.ChatRoom = {
        id: dbRoom._id,
        roomName: dbRoom.roomName,
        descr: dbRoom.descr,
        creationTime: dbRoom.creationTime,
        lastUpdateTime: dbRoom.lastUpdateTime,
      };

      return E.okResult(room);
    } catch (error) {
      return E.errResult(E.errs((error as Error).message, "E_DB"));
    }
  }

  private async insertChatMsgWithIds(
    msgId: T.MsgIdX,
    userId: T.UserIdX,
    roomId: T.RoomIdX,
    msg: string,
    creationTime: T.Iso8601X
  ): Promise<E.Result<void, E.Errs>> {
    try {
      const dbMsg: DbChatMsg = {
        _id: msgId,
        userId: userId,
        roomId: roomId,
        msg: msg,
        creationTime: creationTime,
      };

      await this.msgsCollection.insertOne(dbMsg);
      return E.okResult(undefined);
    } catch (error) {
      return E.errResult(E.errs((error as Error).message, "E_DB"));
    }
  }

  async makeChatMsg(
    chatMsg: T.RawChatMsg
  ): Promise<E.Result<T.MsgIdX, E.Errs>> {
    try {
      const userResult = await this.getUser({ chatName: chatMsg.chatName });
      if (!userResult.isOk) return userResult.into<T.MsgIdX>();

      const roomResult = await this.getChatRoom({ roomName: chatMsg.roomName });
      if (!roomResult.isOk) return roomResult.into<T.MsgIdX>();

      const msgId = T.brand<T.MsgIdX>(this.generateId());
      const now = T.brand<T.Iso8601X>(new Date().toISOString());

      const insertResult = await this.insertChatMsgWithIds(
        msgId,
        userResult.val.id,
        roomResult.val.id,
        chatMsg.msg,
        now
      );

      if (!insertResult.isOk) return insertResult.into<T.MsgIdX>();

      return E.okResult(msgId);
    } catch (error) {
      return E.errResult(E.errs((error as Error).message, "E_DB"));
    }
  }

  async findChatMsgs(
    findParams: T.FindParams
  ): Promise<E.Result<T.ChatMsg[], E.Errs>> {
    try {
      const roomResult = await this.getChatRoom({
        roomName: findParams.roomName,
      });
      if (!roomResult.isOk) return roomResult.into<T.ChatMsg[]>();

      let userId: T.UserIdX | undefined;
      if (findParams.chatName) {
        const userResult = await this.getUser({
          chatName: findParams.chatName,
        });
        if (!userResult.isOk) return userResult.into<T.ChatMsg[]>();
        userId = userResult.val.id;
      }

      const dbFindParams: any = {
        roomId: roomResult.val.id,
      };
      if (userId) dbFindParams.userId = userId;
      if (findParams.id) dbFindParams.id = findParams.id;
      if (findParams.words) dbFindParams.words = findParams.words;
      if (findParams.earliest) dbFindParams.earliest = findParams.earliest;
      if (findParams.latest) dbFindParams.latest = findParams.latest;
      if (findParams.offset !== undefined)
        dbFindParams.offset = findParams.offset;
      if (findParams.limit !== undefined) dbFindParams.limit = findParams.limit;

      const dbMsgsResult = await this.findChatMsgsWithIds(dbFindParams);
      if (!dbMsgsResult.isOk) return dbMsgsResult.into<T.ChatMsg[]>();

      const chatMsgs: T.ChatMsg[] = [];
      for (const dbMsg of dbMsgsResult.val) {
        const userResult = await this.getUser({ id: dbMsg.userId });
        if (!userResult.isOk) return userResult.into<T.ChatMsg[]>();

        const roomResult = await this.getChatRoom({ id: dbMsg.roomId });
        if (!roomResult.isOk) return roomResult.into<T.ChatMsg[]>();

        const chatMsg: T.ChatMsg = {
          id: dbMsg._id,
          chatName: userResult.val.chatName,
          roomName: roomResult.val.roomName,
          msg: dbMsg.msg,
          creationTime: dbMsg.creationTime,
        };
        chatMsgs.push(chatMsg);
      }

      return E.okResult(chatMsgs);
    } catch (error) {
      return E.errResult(E.errs((error as Error).message, "E_DB"));
    }
  }

  private async findChatMsgsWithIds(
    search: any
  ): Promise<E.Result<DbChatMsg[], E.Errs>> {
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

      let query: any = { ...query1 };

      if (words !== undefined) {
        query.$text = { $search: words };
      }

      if (earliest !== undefined || latest !== undefined) {
        query.creationTime = {};
        if (earliest !== undefined) query.creationTime.$gte = earliest;
        if (latest !== undefined) query.creationTime.$lte = latest;
      }

      if (id !== undefined) {
        query._id = id;
      }

      const cursor = this.msgsCollection
        .find(query)
        .sort({ creationTime: -1, msg: 1, _id: 1 })
        .skip(offset)
        .limit(limit);

      const results = await cursor.toArray();
      return E.okResult(results);
    } catch (error) {
      return E.errResult(E.errs((error as Error).message, "E_DB"));
    }
  }
}

//error code within mongo exception indicating a violation of a
//uniqueness constraint.
const MONGO_UNIQUE_ERR = 11000;
