import assert from "node:assert/strict";
import { test } from "node:test";
import { AGENT_SCOPES } from "@mandate/schema";
import {
  CONTACT_FACTS,
  CONTACT_FIELDS,
  CONTACTS_STATE,
  SAMPLE_CONTACTS,
} from "../src/config/contacts";
import { HELP_TOPICS } from "../src/config/help";
import { NETWORK_STATUS } from "../src/config/networkStatus";
import {
  ACTIONS_SCOPE_NOTE,
  AGENT_SCOPE_INFO,
  AGENT_TOKEN_CANNOT,
  LOCAL_SECURITY,
  SECURITY_ACTIONS,
  SECURITY_INTRO,
  TOKEN_REVOKE_NOTE,
} from "../src/config/securityAccess";
import {
  SAMPLE_AGENT_TOKENS,
  SAMPLE_SESSIONS,
} from "../src/config/securitySamples";

const action = (id: string) => {
  const found = SECURITY_ACTIONS.find((a) => a.id === id);
  assert.ok(found, `missing action ${id}`);
  return found;
};

test("UI-10 security: of the actions listed on this screen, only the on-chain ones end permissions", () => {
  assert.deepEqual(
    SECURITY_ACTIONS.map((a) => a.id),
    [
      "lock",
      "logout",
      "revokeSessions",
      "revokeAgentToken",
      "removeWallet",
      "pause",
      "revoke",
    ],
  );
  for (const a of SECURITY_ACTIONS) {
    assert.equal(a.endsOnChainPermissions, a.actsOn === "chain", a.id);
    assert.equal(a.available, false, a.id);
    assert.ok(a.effect.trim(), a.id);
  }
  assert.equal(action("lock").actsOn, "phone");
  assert.equal(action("removeWallet").actsOn, "phone");
  assert.equal(action("logout").actsOn, "service");
  assert.equal(action("revokeSessions").actsOn, "service");
  assert.equal(action("revokeAgentToken").actsOn, "service");
  for (const id of ["pause", "revoke"])
    assert.match(action(id).effect, /confirmed/i, id);
});

test("UI-10 security: the action list is scoped; recovery and owner transfers also end permissions", () => {
  assert.match(ACTIONS_SCOPE_NOTE, /this screen/i);
  assert.match(ACTIONS_SCOPE_NOTE, /recover,/i);
  assert.match(ACTIONS_SCOPE_NOTE, /recover liquid/i);
  assert.match(ACTIONS_SCOPE_NOTE, /owner transfer/i);
  assert.match(ACTIONS_SCOPE_NOTE, /confirmed/i);
  for (const text of [SECURITY_INTRO, TOKEN_REVOKE_NOTE, ACTIONS_SCOPE_NOTE])
    assert.doesNotMatch(text, /only (a )?(confirmed )?pause or revoke/i, text);
  assert.match(TOKEN_REVOKE_NOTE, /stay in force/i);
});

test("UI-10 agent access: revoking an agent token leaves on-chain permissions in force", () => {
  const revoke = action("revokeAgentToken").effect;
  assert.match(revoke, /on chain/i);
  assert.match(revoke, /stay/i);
  for (const id of ["lock", "logout", "revokeSessions", "removeWallet"])
    assert.match(action(id).effect, /agents keep|keep working|stay/i, id);
});

test("UI-10 agent access: scopes match the shared schema and none carries owner authority", () => {
  assert.deepEqual(
    AGENT_SCOPE_INFO.map((s) => s.id),
    [...AGENT_SCOPES],
  );
  for (const scope of AGENT_SCOPE_INFO)
    assert.ok(scope.detail.trim(), scope.id);
  const cannot = AGENT_TOKEN_CANNOT.join(" ");
  assert.match(cannot, /owner transfer/i);
  assert.match(cannot, /session/i);
  assert.match(cannot, /sign/i);
});

test("UI-10 security: no local protection is marked as working", () => {
  assert.deepEqual(
    LOCAL_SECURITY.map((s) => s.id),
    ["appLock", "backup", "removeWallet"],
  );
  for (const item of LOCAL_SECURITY)
    assert.notEqual(item.state, "configured", item.id);
});

test("UI-10 security: development samples hold no secrets and treat device names as untrusted", () => {
  assert.ok(SAMPLE_SESSIONS.length > 0);
  for (const s of SAMPLE_SESSIONS) assert.equal(s.labelTrusted, false, s.label);
  assert.ok(SAMPLE_AGENT_TOKENS.length > 0);
  for (const t of SAMPLE_AGENT_TOKENS) {
    assert.ok(t.scopes.length > 0, t.name);
    for (const scope of t.scopes)
      assert.ok((AGENT_SCOPES as readonly string[]).includes(scope), scope);
  }
  for (const sample of [...SAMPLE_SESSIONS, ...SAMPLE_AGENT_TOKENS])
    for (const key of Object.keys(sample))
      assert.doesNotMatch(key, /secret|token$|refresh|jwt|key/i, key);
});

test("UI-10 contacts: unavailable storage is not shown as an empty list", () => {
  assert.equal(CONTACTS_STATE.state, "unavailable");
  assert.doesNotMatch(CONTACTS_STATE.title, /no contacts/i);
  assert.match(CONTACT_FACTS.join(" "), /not proof|does not prove/i);
  assert.match(CONTACT_FACTS.join(" "), /this phone/i);
});

test("UI-10 contacts: development samples hold no address-like value", () => {
  assert.ok(SAMPLE_CONTACTS.length > 0);
  for (const sample of SAMPLE_CONTACTS) {
    assert.match(sample.label, /^Sample/, sample.label);
    assert.match(sample.addressNote, /sample/i, sample.label);
    assert.match(sample.addressNote, /not an address/i, sample.label);
    assert.equal(sample.chainId, 84532, sample.label);
    for (const value of Object.values(sample))
      assert.doesNotMatch(String(value), /0x|[0-9a-f]{8,}/i, sample.label);
  }
  const address = CONTACT_FIELDS.find((f) => f.label === "Address");
  assert.ok(address);
  assert.match(address.detail, /in full/i);
});

test("UI-10 network: only the configured chain is marked configured", () => {
  const chain = NETWORK_STATUS.find((s) => s.id === "chain");
  assert.ok(chain);
  assert.equal(chain.state, "configured");
  assert.match(chain.value, /Base Sepolia/);
  assert.match(chain.value, /84532/);
  for (const id of ["rpc", "connection", "block", "manifest", "explorer"]) {
    const item = NETWORK_STATUS.find((s) => s.id === id);
    assert.ok(item, id);
    assert.notEqual(item.state, "configured", id);
    assert.match(item.value, /^(Not |Unavailable)/, id);
  }
});

test("UI-10 help: recovery words are the owner's responsibility", () => {
  const recovery = HELP_TOPICS.find((t) => t.id === "recoveryWords");
  assert.ok(recovery);
  const text = recovery.points.join(" ");
  assert.match(text, /cannot recover/i);
  assert.match(text, /never ask/i);
  for (const topic of HELP_TOPICS)
    assert.doesNotMatch(
      topic.points.join(" "),
      /(Mandate|we) can recover your words/i,
      topic.id,
    );
});

test("UI-10 help: personal account, agent wallet and agent signer stay separate", () => {
  const wallets = HELP_TOPICS.find((t) => t.id === "wallets");
  assert.ok(wallets);
  const text = wallets.points.join(" ");
  assert.match(text, /personal account/i);
  assert.match(text, /agent wallet/i);
  assert.match(text, /agent signer/i);
  assert.match(text, /never send funds to/i);
  const stop = HELP_TOPICS.find((t) => t.id === "stopping");
  assert.ok(stop);
  assert.match(stop.points.join(" "), /log(ging)? ?out/i);
  assert.match(stop.points.join(" "), /do not stop agents/i);
  assert.match(stop.points.join(" "), /recover liquid/i);
  assert.match(stop.points.join(" "), /owner transfer/i);
  assert.doesNotMatch(stop.points.join(" "), /pause and revoke count only/i);
});
