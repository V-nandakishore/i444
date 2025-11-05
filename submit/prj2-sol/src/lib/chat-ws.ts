import cors from "cors";
import Express from "express";
import assert from "assert";
import STATUS from "http-status";

import { Errors as E } from "cs444-js-utils";

import { Chat, makeChat } from "./chat.js";
import * as T from "./chat-types.js";

import * as Envelope from "./response-envelopes.js";

const [DEFAULT_OFFSET, DEFAULT_LIMIT] = [0, T.PAGE_SIZE];

//Based on
//<https://plainenglish.io/blog/typed-express-request-and-response-with-typescript>
//Instead of depending on express.js types, specify query-string types
type RequestWithQuery = Express.Request & {
  query: { [_: string]: string | string[] | number };
};

export type App = Express.Application;

type ServeRet = {
  app: App;
  close: () => void;
};

type SERVER_OPTIONS = {
  base?: string;
};

export function serve(model: T.Chat, options: SERVER_OPTIONS = {}): ServeRet {
  const app = Express();
  app.locals.model = model;
  const { base = "/api" } = options;
  app.locals.base = base;
  setupRoutes(app);
  const close = () => app.locals.sessions.close();
  return { app, close };
}

function setupRoutes(app: Express.Application) {
  const base = app.locals.base;

  //allow cross-origin resource sharing
  app.use(cors(CORS_OPTIONS));

  //assume that all request bodies are parsed as JSON
  app.use(Express.json());

  //if uncommented, all requests are traced on the console
  //app.use(doTrace(app));

  // Clear all data
  app.delete(`${base}/`, doClear(app));

  // User routes
  app.post(`${base}/users`, doMakeUser(app));
  app.get(`${base}/users`, doGetUser(app));
  app.get(`${base}/users/:id`, doGetUserById(app));
  app.patch(`${base}/users/:id`, doUpdateUser(app));

  // Chat room routes
  app.post(`${base}/chat-rooms`, doMakeChatRoom(app));
  app.get(`${base}/chat-rooms`, doGetChatRoom(app));
  app.get(`${base}/chat-rooms/:id`, doGetChatRoomById(app));

  // Chat message routes
  app.post(`${base}/chat-msgs`, doMakeChatMsg(app));
  app.get(`${base}/chat-msgs/:roomName`, doFindChatMsgs(app));
  //must be last
  app.use(do404(app)); //custom handler for page not found
  app.use(doErrors(app)); //custom handler for internal errors
}

function doTrace(app: Express.Application) {
  return async function (
    req: Express.Request,
    res: Express.Response,
    next: Express.NextFunction
  ) {
    console.log(req.method, req.originalUrl);
    next();
  };
}

/*************************** Route Handlers ****************************/

// User handlers
function doMakeUser(app: Express.Application) {
  return async function (req: Express.Request, res: Express.Response) {
    try {
      const result = await app.locals.model.makeUser(req.body);
      if (!result.isOk) throw result;

      const id = result.val;
      const location = selfHref(req, id);
      res.location(location);

      const response = Envelope.unlinkedEnvelope<string>(
        id,
        STATUS.CREATED,
        "userId"
      );
      res.status(response.status).json(response);
    } catch (err) {
      const mapped = mapResultErrors(err);
      res.status(mapped.status).json(mapped);
    }
  };
}

function doGetUser(app: Express.Application) {
  return async function (req: Express.Request, res: Express.Response) {
    try {
      const result = await app.locals.model.getUser(req.query);
      if (!result.isOk) throw result;

      const user = result.val;
      const selfLink = selfHref(req, user.id);
      const response = Envelope.selfLinkedEnvelope<T.User>(
        user,
        STATUS.OK,
        "user",
        selfLink,
        "id"
      );
      res.status(response.status).json(response);
    } catch (err) {
      const mapped = mapResultErrors(err);
      res.status(mapped.status).json(mapped);
    }
  };
}

function doGetUserById(app: Express.Application) {
  return async function (req: Express.Request, res: Express.Response) {
    try {
      const result = await app.locals.model.getUser({
        id: req.params.id as T.UserIdX,
      });
      if (!result.isOk) throw result;

      const user = result.val;
      const selfLink = selfHref(req);
      const response = Envelope.selfLinkedEnvelope<T.User>(
        user,
        STATUS.OK,
        "user",
        selfLink,
        "id"
      );
      res.status(response.status).json(response);
    } catch (err) {
      const mapped = mapResultErrors(err);
      res.status(mapped.status).json(mapped);
    }
  };
}

function doUpdateUser(app: Express.Application) {
  return async function (req: Express.Request, res: Express.Response) {
    try {
      const result = await app.locals.model.updateUser(
        req.params.id as T.UserIdX,
        req.body
      );
      if (!result.isOk) throw result;

      const user = result.val;
      const selfLink = selfHref(req);
      const response = Envelope.selfLinkedEnvelope<T.User>(
        user,
        STATUS.OK,
        "user",
        selfLink,
        "id"
      );
      res.status(response.status).json(response);
    } catch (err) {
      const mapped = mapResultErrors(err);
      res.status(mapped.status).json(mapped);
    }
  };
}

// Chat room handlers
function doMakeChatRoom(app: Express.Application) {
  return async function (req: Express.Request, res: Express.Response) {
    try {
      const result = await app.locals.model.makeChatRoom(req.body);
      if (!result.isOk) throw result;

      const id = result.val;
      const location = selfHref(req, id);
      res.location(location);

      const response = Envelope.unlinkedEnvelope<string>(
        id,
        STATUS.CREATED,
        "chatRoomId"
      );
      res.status(response.status).json(response);
    } catch (err) {
      const mapped = mapResultErrors(err);
      res.status(mapped.status).json(mapped);
    }
  };
}

function doGetChatRoom(app: Express.Application) {
  return async function (req: Express.Request, res: Express.Response) {
    try {
      const result = await app.locals.model.getChatRoom(req.query);
      if (!result.isOk) throw result;

      const room = result.val;
      const selfLink = selfHref(req, room.id);
      const response = Envelope.selfLinkedEnvelope<T.ChatRoom>(
        room,
        STATUS.OK,
        "chatRoom",
        selfLink,
        "id"
      );
      res.status(response.status).json(response);
    } catch (err) {
      const mapped = mapResultErrors(err);
      res.status(mapped.status).json(mapped);
    }
  };
}

function doGetChatRoomById(app: Express.Application) {
  return async function (req: Express.Request, res: Express.Response) {
    try {
      const result = await app.locals.model.getChatRoom({
        id: req.params.id as T.RoomIdX,
      });
      if (!result.isOk) throw result;

      const room = result.val;
      const selfLink = selfHref(req);
      const response = Envelope.selfLinkedEnvelope<T.ChatRoom>(
        room,
        STATUS.OK,
        "chatRoom",
        selfLink,
        "id"
      );
      res.status(response.status).json(response);
    } catch (err) {
      const mapped = mapResultErrors(err);
      res.status(mapped.status).json(mapped);
    }
  };
}

// Chat message handlers
function doMakeChatMsg(app: Express.Application) {
  return async function (req: Express.Request, res: Express.Response) {
    try {
      const result = await app.locals.model.makeChatMsg(req.body);
      if (!result.isOk) throw result;

      const id = result.val;
      const location = selfHref(req, id);
      res.location(location);

      const response = Envelope.unlinkedEnvelope<string>(
        id,
        STATUS.CREATED,
        "chatMsgId"
      );
      res.status(response.status).json(response);
    } catch (err) {
      const mapped = mapResultErrors(err);
      res.status(mapped.status).json(mapped);
    }
  };
}

function doFindChatMsgs(app: Express.Application) {
  return async function (req: Express.Request, res: Express.Response) {
    try {
      const findParams = {
        roomName: req.params.roomName as T.NameX,
        ...req.query,
      };

      const limit = Number(req.query.limit || DEFAULT_LIMIT);
      const result = await app.locals.model.findChatMsgs({
        ...findParams,
        limit: limit + 1,
      });
      if (!result.isOk) throw result;

      const response = pagedResult<T.ChatMsg>(req, "chatMsg", "id", result.val);
      res.status(response.status).json(response);
    } catch (err) {
      const mapped = mapResultErrors(err);
      res.status(mapped.status).json(mapped);
    }
  };
}

// Clear handler
function doClear(app: Express.Application) {
  return async function (req: Express.Request, res: Express.Response) {
    try {
      const result = await app.locals.model.clear();
      if (!result.isOk) throw result;

      const response = Envelope.unlinkedEnvelope<undefined>(
        undefined,
        STATUS.OK,
        "undefined"
      );
      res.status(response.status).json(response);
    } catch (err) {
      const mapped = mapResultErrors(err);
      res.status(mapped.status).json(mapped);
    }
  };
}
/** Default handler for when there is no route for a particular method
 *  and path.
 */
function do404(app: Express.Application) {
  return async function (req: Express.Request, res: Express.Response) {
    const msg = `${req.method} not supported for ${req.originalUrl}`;
    const error = E.errResult(E.err(msg, "E_NOT_FOUND"));
    const response = mapResultErrors(error);
    res.status(response.status).json(response);
  };
}

/** Ensures a server error results in nice JSON sent back to client
 *  with details logged on console.
 */
function doErrors(app: Express.Application) {
  return async function (
    err: Error,
    req: Express.Request,
    res: Express.Response,
    next: Express.NextFunction
  ) {
    const msg = err.message ?? err.toString();
    const code = err instanceof SyntaxError ? "E_SYNTAX" : "E_INTERNAL";
    const error = E.errResult(E.err(msg, code));
    const response = mapResultErrors(error);
    if (response.status === STATUS.INTERNAL_SERVER_ERROR) {
      console.dir(err, { depth: null });
    }
    res.status(response.status).json(response);
  };
}

/************************* HATEOAS Utilities ***************************/

/** Return original URL for req */
function requestUrl(req: Express.Request) {
  return `${req.protocol}://${req.get("host")}${req.originalUrl}`;
}

/** Return path for req.  If id specified extend with /id, otherwise add in
 *  any query params.
 */
function selfHref(req: Express.Request, id: string = "") {
  const url = new URL(requestUrl(req));
  return url.pathname + (id ? `/${id}` : url.search);
}

/** Produce paging link for next (dir === 1), prev (dir === -1)
 *  for req having nResults results.  Return undefined if there
 *  is no such link.
 */
function pageLink(req: Express.Request, nResults: number, dir: 1 | -1) {
  const url = new URL(requestUrl(req));
  const limit = Number(req.query?.limit ?? DEFAULT_LIMIT);
  const offset0 = Number(url.searchParams.get("offset") ?? 0);
  if (dir > 0 ? nResults <= limit : offset0 <= 0) return undefined;
  const offset =
    dir > 0 ? offset0 + limit : limit > offset0 ? 0 : offset0 - limit;
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("limit", String(limit));
  return url.pathname + url.search;
}

/** Return a paged envelope for multiple results for type T. */
function pagedResult<T>(
  req: Express.Request,
  baseType: string,
  idKey: keyof T,
  results: T[]
): Envelope.PagedEnvelope<T> {
  const nResults = results.length;
  const links: Envelope.NavLinks = {
    self: { rel: "self", href: selfHref(req) },
  };
  const next = pageLink(req, nResults, +1);
  if (next) links.next = { rel: "next", href: next };
  const prev = pageLink(req, nResults, -1);
  if (prev) links.prev = { rel: "prev", href: prev };
  const limit = req.query.limit ? Number(req.query.limit) : DEFAULT_LIMIT;
  const url = new URL(requestUrl(req));
  return Envelope.pagedEnvelope<T>(
    results.slice(0, limit),
    STATUS.OK,
    baseType,
    links,
    `${url.pathname}/{id}`,
    idKey
  );
}

/*************************** Mapping Errors ****************************/

//map from domain errors to HTTP status codes.  If not mentioned in
//this map, an unknown error will have HTTP status BAD_REQUEST.
const ERROR_MAP: { [code: string]: number } = {
  E_EXISTS: STATUS.CONFLICT,
  E_NOT_FOUND: STATUS.NOT_FOUND,
  E_BAD_REQ: STATUS.BAD_REQUEST,
  E_AUTH: STATUS.UNAUTHORIZED,
  E_DB: STATUS.INTERNAL_SERVER_ERROR,
  E_INTERNAL: STATUS.INTERNAL_SERVER_ERROR,
};

/** Return first status corresponding to first options.code in
 *  errors, but INTERNAL_SERVER_ERROR dominates other statuses.  Returns
 *  BAD_REQUEST if no code found.
 */
function getHttpStatus(errors: E.Err[]): number {
  let status: number = 0;
  for (const err of errors) {
    const code = err.options.code;
    const errStatus = code !== undefined ? ERROR_MAP[code] : -1;
    if (errStatus > 0 && status === 0) status = errStatus;
    if (errStatus === STATUS.INTERNAL_SERVER_ERROR) status = errStatus;
  }
  return status !== 0 ? status : STATUS.BAD_REQUEST;
}

/** Map domain/internal errors into suitable HTTP errors.  Return'd
 *  object will have a "status" property corresponding to HTTP status
 *  code.
 */
function mapResultErrors(err: any): Envelope.ErrorEnvelope {
  return Envelope.errorEnvelope(err, ERROR_MAP);
}

/**************************** CORS Options *****************************/

/** options which affect whether cross-origin (different scheme, domain or port)
 *  requests are allowed
 */
const CORS_OPTIONS = {
  //if localhost origin, reflect back in Access-Control-Allow-Origin res hdr
  // origin: /localhost:\d{4}/,

  // simple reflect req origin hdr back to Access-Control-Allow-Origin res hdr
  origin: true,

  //methods allowed for cross-origin requests
  methods: ["GET", "PUT", "POST", "DELETE", "PATCH"],

  //request headers allowed on cross-origin requests
  //used to allow JSON content
  allowedHeaders: ["Content-Type"],

  //response headers exposed to cross-origin requests
  exposedHeaders: ["Location", "Content-Type"],
};
