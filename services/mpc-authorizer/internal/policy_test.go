package internal

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/fystack/mpcium/pkg/types"
	boundary "mandate.local/mpc-boundary"
)

const (
	actionID  = "00000000-0000-4000-8000-0000000000a1"
	attemptID = "00000000-0000-4000-8000-0000000000a2"
	walletID  = "00000000-0000-4000-8000-0000000000a3"
	token     = "policy-token-policy-token-policy-token"
)

func allowed(digest [32]byte) Decision {
	d := "0x" + hex.EncodeToString(digest[:])
	w, ex, v := walletID, "0x443ff3ca757f8d774acee949dab6661676ee1ef8", 1
	return Decision{Allowed: true, ExpectedDigest: &d, ExpectedMpcWalletID: &w, ExpectedNetwork: boundary.Network, ExpectedTxID: attemptID, ExpectedKeyVersion: &v, ExpectedExecutor: &ex}
}

// policyStub records what the authorizer forwarded and answers with a fixed decision.
func policyStub(t *testing.T, decision any, status int) (*httptest.Server, *[]map[string]any) {
	t.Helper()
	var seen []map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer "+token {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		var body map[string]any
		_ = json.NewDecoder(r.Body).Decode(&body)
		seen = append(seen, body)
		w.WriteHeader(status)
		_ = json.NewEncoder(w).Encode(decision)
	}))
	t.Cleanup(srv.Close)
	return srv, &seen
}

func service(t *testing.T, url string) (Service, func(boundary.Record) *types.SignTxMessage, ed25519.PublicKey) {
	init, author := identity(t, 1), identity(t, 2)
	pub, _ := init.PublicKey()
	pk, _ := hex.DecodeString(pub)
	apub, _ := author.PublicKey()
	apk, _ := hex.DecodeString(apub)
	s := Service{Policy: PolicyClient{URL: url, Token: token, HTTP: http.DefaultClient}, Initiator: pk, Signer: author}
	message := func(r boundary.Record) *types.SignTxMessage {
		m, err := boundary.Message(r, init)
		if err != nil {
			t.Fatal(err)
		}
		return m
	}
	return s, message, apk
}

var record = boundary.Record{ActionID: actionID, AttemptID: attemptID, WalletID: walletID, KeyVersion: "1", Executor: "0x443ff3ca757f8d774acee949dab6661676ee1ef8", Digest: [32]byte{0, 9, 9}}

func TestPolicyReconstructionAuthorizesExactBytes(t *testing.T) {
	srv, seen := policyStub(t, allowed(record.Digest), http.StatusOK)
	s, message, authorizer := service(t, srv.URL)
	m := message(record)
	sig, err := s.Authorize(context.Background(), actionID, attemptID, m)
	if err != nil {
		t.Fatal(err)
	}
	raw, _ := types.ComposeAuthorizerRaw(m)
	if sig.AuthorizerID != boundary.AuthorizerID || !ed25519.Verify(authorizer, raw, sig.Signature) {
		t.Fatal("authorizer signature does not cover ComposeAuthorizerRaw")
	}
	if len(*seen) != 1 || (*seen)[0]["actionId"] != actionID || (*seen)[0]["attemptId"] != attemptID {
		t.Fatal("policy was not consulted with the stored identifiers")
	}
}

func TestMessageDifferingFromReconstructionIsRefused(t *testing.T) {
	mutations := map[string]func(*boundary.Record){
		"digest":  func(r *boundary.Record) { r.Digest[31] ^= 1 },
		"wallet":  func(r *boundary.Record) { r.WalletID = "00000000-0000-4000-8000-0000000000ff" },
		"attempt": func(r *boundary.Record) { r.AttemptID = "00000000-0000-4000-8000-0000000000fe" },
	}
	for name, mutate := range mutations {
		t.Run(name, func(t *testing.T) {
			srv, _ := policyStub(t, allowed(record.Digest), http.StatusOK)
			s, message, _ := service(t, srv.URL)
			r := record
			mutate(&r)
			if _, err := s.Authorize(context.Background(), actionID, attemptID, message(r)); err == nil {
				t.Fatal("authorized a request the policy did not reconstruct")
			}
		})
	}
}

func TestDeniedUnavailableOrIncompletePolicyNeverSigns(t *testing.T) {
	incomplete := allowed(record.Digest)
	incomplete.ExpectedDerivationPath = []uint32{0}
	staleTx := allowed(record.Digest)
	staleTx.ExpectedTxID = "00000000-0000-4000-8000-0000000000fd"
	cases := map[string]struct {
		decision any
		status   int
	}{
		"denied":          {Decision{Allowed: false, RuleIDs: []string{"PERMIT_EPOCH"}}, http.StatusOK},
		"unavailable":     {map[string]string{}, http.StatusServiceUnavailable},
		"derivation-path": {incomplete, http.StatusOK},
		"attempt":         {staleTx, http.StatusOK},
	}
	for name, c := range cases {
		t.Run(name, func(t *testing.T) {
			srv, _ := policyStub(t, c.decision, c.status)
			s, message, _ := service(t, srv.URL)
			_, err := s.Authorize(context.Background(), actionID, attemptID, message(record))
			if err == nil {
				t.Fatal("signed without a complete allowed decision")
			}
			var denied Denied
			if name == "denied" && (!errors.As(err, &denied) || denied.RuleIDs[0] != "PERMIT_EPOCH") {
				t.Fatal("denial rule IDs were not surfaced")
			}
		})
	}
	s, message, _ := service(t, "http://127.0.0.1:1")
	if _, err := s.Authorize(context.Background(), actionID, attemptID, message(record)); err == nil {
		t.Fatal("signed with the policy service unreachable")
	}
}

func TestHandlerRequiresInternalTokenAndHasNoOtherRoutes(t *testing.T) {
	srv, _ := policyStub(t, allowed(record.Digest), http.StatusOK)
	s, message, _ := service(t, srv.URL)
	h := httptest.NewServer(s.Handler("authorizer-token-authorizer-token-xx"))
	defer h.Close()
	body, _ := json.Marshal(map[string]any{"actionId": actionID, "attemptId": attemptID, "message": message(record)})
	post := func(path, auth string) int {
		req, _ := http.NewRequest(http.MethodPost, h.URL+path, bytes.NewReader(body))
		req.Header.Set("Authorization", auth)
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		res.Body.Close()
		return res.StatusCode
	}
	if post("/internal/authorizations", "Bearer wrong") != http.StatusUnauthorized {
		t.Fatal("wrong internal token accepted")
	}
	if post("/internal/authorizations", "Bearer authorizer-token-authorizer-token-xx") != http.StatusOK {
		t.Fatal("authenticated request failed")
	}
	if post("/internal/reshare", "Bearer authorizer-token-authorizer-token-xx") != http.StatusNotFound {
		t.Fatal("reshare route exists")
	}
}

func TestKeygenRequiresPolicyAndInitiator(t *testing.T) {
	for _, allow := range []bool{false, true} {
		srv, _ := policyStub(t, map[string]any{"allowed": allow, "ruleIds": []string{}}, http.StatusOK)
		s, _, authorizer := service(t, srv.URL)
		init := identity(t, 1)
		m := &types.GenerateKeyMessage{WalletID: walletID}
		raw, _ := m.Raw()
		m.Signature, _ = init.Sign(raw)
		sig, err := s.AuthorizeKeygen(context.Background(), m)
		if !allow {
			if err == nil {
				t.Fatal("keygen authorized without policy approval")
			}
			continue
		}
		if err != nil {
			t.Fatal(err)
		}
		composed, _ := types.ComposeAuthorizerRaw(m)
		if !ed25519.Verify(authorizer, composed, sig.Signature) {
			t.Fatal("keygen authorization does not cover ComposeAuthorizerRaw")
		}
		m.Signature[0] ^= 1
		if _, err := s.AuthorizeKeygen(context.Background(), m); err == nil {
			t.Fatal("keygen authorized a forged initiator signature")
		}
	}
}
