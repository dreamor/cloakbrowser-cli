import { getClient, type RpcCallOptions } from '../client.js';
import { ok, fail, type GlobalFlags } from '../output.js';
import { resolveSid, saveLastSession } from '../utils/session-resolver.js';

/**
 * Resolve a session identifier (@name / - / s-xxx) to a real session ID,
 * save it as "last session", then make an RPC call and emit the response.
 *
 * Use this wrapper in all command handlers that accept a session_id argument.
 */
export function callDaemon(
  method: string,
  params: Record<string, unknown>,
  rawSid: string,
  flags: GlobalFlags,
  rpcOpts?: RpcCallOptions,
): Promise<void> {
  const resolved = resolveSid(rawSid);
  saveLastSession(resolved);
  return getClient()
    .call(method, { ...params, session_id: resolved }, rpcOpts)
    .then((data) => ok(data, flags, { session_id: resolved }), (err) => fail(err, flags));
}