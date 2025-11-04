import { Errors as E } from 'cs444-js-utils';

/****************************** Links **********************************/

/** a link contains a rel relation, a href URL and optional HTTP method */
export type Link = {
  rel: string,
  href: string,
  method?: string,  //default GET
};

/** a self link using rel self */
export type SelfLink =  Link & { rel: 'self' };

/** enhance T with a `_links` containing a self-link. */
type SelfLinkedResult<T> = T & { _links: { self: SelfLink } };

/** navigation links contain optional next and prev links in addition to
 *  a self link.
 */
export type NavLinks = {
  self: SelfLink,
  next?: Link & { rel: 'next' },
  prev?: Link & { rel: 'prev' },
};


/*************************** Envelopes *********************************/

// "as const" is a constant assertion, telling TS to narrow type only
// to specific value.

// kinds for success envelopes

// success envelope for result without any links
export const UNLINKED = 'unlinkedResult' as const;

//success envelope with result containing a single self-link
export const SELF_LINKED = 'selfLinkedResult' as const;

//success envelope for a paged result with NavLinks
//and a page represented as an array of self-linked results.
export const PAGED = 'pagedResult' as const;

//error envelope: array of error messages and options
export const ERROR = 'errorResult' as const;

export type EnvelopeKind =
  typeof UNLINKED |      //no links
  typeof SELF_LINKED |   //self link in result
  typeof PAGED  |        //nav links + array of self-linked results
  typeof ERROR;          //array of error messages and options

/** a response envelope always has a kind and HTTP status */
type BaseEnvelope = {
  kind: EnvelopeKind,
  status: number,     //same as status returned in HTTP response
};


/** an envelope for a non-paged unlinked successful response */
export type UnlinkedEnvelope<T> = BaseEnvelope & {
  kind: typeof UNLINKED,
  baseType: string,       //description of T
  result: T,
};


/** an envelope for a non-paged linked successful response */
export type SelfLinkedEnvelope<T> = BaseEnvelope & {
  kind: typeof SELF_LINKED,
  baseType: string,       //description of T
  result:  SelfLinkedResult<T>,
};


/** an envelope for a paged successful response */
export type PagedEnvelope<T> = BaseEnvelope & {
  kind: typeof PAGED,
  baseType: string,       //description of T
  _links: NavLinks,
  result: SelfLinkedResult<T>[],
};

/** an envelope for a failed response */
export type ErrorEnvelope = BaseEnvelope & {
  kind: typeof ERROR,
  errors: { message: string, options?: Record<string, string> }[],
};


export type Envelope<T> =
  UnlinkedEnvelope<T> |
  SelfLinkedEnvelope<T> |
  PagedEnvelope<T> |
  ErrorEnvelope;


/********************** Envelope Factory Functions *********************/

/** wrap result in an unlinked envelope */
export function unlinkedEnvelope<T>(result: T, status: number, baseType: string)
  : UnlinkedEnvelope<T>
{
  return { kind: UNLINKED, status, baseType, result, };
}

/** Return result witn an added _links property giving a self-link.
 *  The self link is formed by replacing "{id}" in selfHrefFmt with
 *  result[idKey].  If selfHrefFmt does not contain "{id}", then
 *  simply use it unchanged as the self-link.
 */
function addSelfLink<T>(result: T, selfHrefFmt: string, idKey: keyof T)
  : SelfLinkedResult<T> 
{
  const id = (result[idKey] ?? '').toString();
  const href = selfHrefFmt.replace('{id}', id);
  return { _links: { self: { rel: 'self', href } }, ...result };
}

/** wrap result in a self-linked envelope */
export function selfLinkedEnvelope<T>(result: T,
				      status: number, baseType: string,
				      selfHrefFmt: string, idKey: keyof T)
  : SelfLinkedEnvelope<T>
{
  return {
    kind: SELF_LINKED,
    status,
    baseType,
    result: addSelfLink(result, selfHrefFmt, idKey),
  };
}

/** Wrap results in a paged-envelope with specified NavLinks.
 * Each element of results is returned as a self-linked result.
 */
export function pagedEnvelope<T>(results: T[],
				 status: number, baseType: string,
				 links: NavLinks,
				 selfHrefFmt: string, idKey: keyof T)
  : PagedEnvelope<T>
{
  return {
    kind: PAGED,
    status,
    baseType,
    _links: links,
    result: results.map(r => addSelfLink(r, selfHrefFmt, idKey)),
  };
}

const [ BAD_REQ_ERROR, INTERNAL_SERVER_ERROR ] = [ 400, 500 ];

//would like to use `error instanceof E.ErrResult`, etc, but that
//fails if error was produced in one module import path and
//E.ErrResult was produced in another module import path.  Hence the
//clumsy `in` checks below.

/** return an error-envelope for error.  Tries hard to ensure that
 *  errors are as speficic as possible.
 */
export function errorEnvelope(error: any,
			      codeStatuses: Record<string, number>)
  : ErrorEnvelope 
{
  let errors: E.Err[];
  let status: number = INTERNAL_SERVER_ERROR;  //must get a value
  if ('isOk' in error) {
    //assume error has type E.Result.
    console.assert(error.isOk === false);
    const error1 = error as E.ErrResult<void, E.Err|E.Errs>;;
    if ('errors' in error1.err) { 
      //assume error.err has type E.Errs
      errors = error1.err.errors as E.Err[];
    }
    else {
      //assume error.err has type E.Err
      errors = [ error1.err as E.Err ];
    }
    for (const e of errors) {
      const code = e.options.code;
      if (code) {
	status = codeStatuses[code] ?? codeStatuses[''] ?? BAD_REQ_ERROR;
	break;
      }
    }
  }
  else {
    // something real nasty occurred
    // assume error is either a JS Error or some arbitrary JS object
    const msg = (error instanceof Error) ? error.message : error.toString();
    errors = [{ message: msg, options: {} } ];
    status = INTERNAL_SERVER_ERROR;
    console.error(error);
  }
  return { kind: ERROR, status, errors };
}

