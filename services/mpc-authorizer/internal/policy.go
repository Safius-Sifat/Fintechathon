package internal

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/fystack/mpcium/pkg/client"
	"github.com/fystack/mpcium/pkg/types"
	boundary "mandate.local/mpc-boundary"
)

// Decision is the policy service's reconstruction from stored records.
type Decision struct {
	Allowed                bool     `json:"allowed"`
	RuleIDs                []string `json:"ruleIds"`
	ExpectedDigest         *string  `json:"expectedDigest"`
	ExpectedMpcWalletID    *string  `json:"expectedMpcWalletId"`
	ExpectedNetwork        string   `json:"expectedNetwork"`
	ExpectedTxID           string   `json:"expectedTxId"`
	ExpectedDerivationPath []uint32 `json:"expectedDerivationPath"`
	ExpectedKeyVersion     *int     `json:"expectedKeyVersion"`
	ExpectedExecutor       *string  `json:"expectedExecutor"`
	ChainBlock             *string  `json:"chainBlock"`
}

type PolicyClient struct {
	URL   string
	Token string
	HTTP  *http.Client
}

func (p PolicyClient) post(ctx context.Context, path string, body, out any) error {
	b, err := json.Marshal(body)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, p.URL+path, bytes.NewReader(b))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+p.Token)
	req.Header.Set("Content-Type", "application/json")
	res, err := p.HTTP.Do(req)
	if err != nil {
		return fmt.Errorf("policy service unavailable: %w", err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("policy service returned %d", res.StatusCode)
	}
	return json.NewDecoder(io.LimitReader(res.Body, 1<<16)).Decode(out)
}

func (p PolicyClient) Check(ctx context.Context, actionID, attemptID string, m *types.SignTxMessage) (Decision, error) {
	var d Decision
	err := p.post(ctx, "/internal/policy/check", map[string]any{"actionId": actionID, "attemptId": attemptID, "message": m}, &d)
	return d, err
}

func (p PolicyClient) KeygenCheck(ctx context.Context, walletID string) (bool, []string, error) {
	var d struct {
		Allowed bool     `json:"allowed"`
		RuleIDs []string `json:"ruleIds"`
	}
	err := p.post(ctx, "/internal/policy/keygen-check", map[string]string{"mpcWalletId": walletID}, &d)
	return d.Allowed, d.RuleIDs, err
}

// decided serves exactly one record the policy reconstructed for this request.
type decided struct{ record boundary.Record }

func (d decided) Load(_ context.Context, actionID, attemptID string) (boundary.Record, error) {
	if actionID != d.record.ActionID || attemptID != d.record.AttemptID {
		return boundary.Record{}, errors.New("record identity mismatch")
	}
	return d.record, nil
}
func (decided) Check(context.Context, boundary.Record) error { return nil }

type Denied struct{ RuleIDs []string }

func (d Denied) Error() string { return "policy denied: " + strings.Join(d.RuleIDs, ",") }

type Service struct {
	Policy    PolicyClient
	Initiator ed25519.PublicKey
	Signer    client.Signer
}

// Authorize trusts only the policy's reconstruction; the upstream request must
// match it field for field before the authorizer signs ComposeAuthorizerRaw.
func (s Service) Authorize(ctx context.Context, actionID, attemptID string, m *types.SignTxMessage) (types.AuthorizerSignature, error) {
	var empty types.AuthorizerSignature
	d, err := s.Policy.Check(ctx, actionID, attemptID, m)
	if err != nil {
		return empty, err
	}
	if !d.Allowed {
		return empty, Denied{d.RuleIDs}
	}
	if d.ExpectedDigest == nil || d.ExpectedMpcWalletID == nil || d.ExpectedKeyVersion == nil || d.ExpectedExecutor == nil ||
		d.ExpectedNetwork != boundary.Network || d.ExpectedTxID != attemptID || d.ExpectedDerivationPath != nil {
		return empty, errors.New("policy decision is incomplete")
	}
	raw, err := hex.DecodeString(strings.TrimPrefix(*d.ExpectedDigest, "0x"))
	if err != nil || len(raw) != 32 {
		return empty, errors.New("policy digest is not 32 bytes")
	}
	record := boundary.Record{
		ActionID:   actionID,
		AttemptID:  attemptID,
		WalletID:   *d.ExpectedMpcWalletID,
		KeyVersion: strconv.Itoa(*d.ExpectedKeyVersion),
		Executor:   *d.ExpectedExecutor,
		Digest:     [32]byte(raw),
	}
	a, err := boundary.NewAuthorizer(decided{record}, decided{record}, s.Initiator, s.Signer)
	if err != nil {
		return empty, err
	}
	return a.Authorize(ctx, actionID, attemptID, m)
}

// AuthorizeKeygen signs DKG only for a wallet provisioning moved to KEYGEN.
func (s Service) AuthorizeKeygen(ctx context.Context, m *types.GenerateKeyMessage) (types.AuthorizerSignature, error) {
	var empty types.AuthorizerSignature
	allowed, rules, err := s.Policy.KeygenCheck(ctx, m.WalletID)
	if err != nil {
		return empty, err
	}
	if !allowed {
		return empty, Denied{rules}
	}
	raw, err := m.Raw()
	if err != nil {
		return empty, err
	}
	if !ed25519.Verify(s.Initiator, raw, m.Signature) {
		return empty, errors.New("invalid initiator")
	}
	raw, err = types.ComposeAuthorizerRaw(m)
	if err != nil {
		return empty, err
	}
	sig, err := s.Signer.Sign(raw)
	return types.AuthorizerSignature{AuthorizerID: boundary.AuthorizerID, Signature: sig}, err
}

// Handler exposes only the two authorization routes; there is no reshare or raw
// signing route.
func (s Service) Handler(token string) http.Handler {
	expected := []byte("Bearer " + token)
	mux := http.NewServeMux()
	write := func(w http.ResponseWriter, status int, v any) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_ = json.NewEncoder(w).Encode(v)
	}
	fail := func(w http.ResponseWriter, err error) {
		var denied Denied
		if errors.As(err, &denied) {
			write(w, http.StatusForbidden, map[string]any{"code": "POLICY_VIOLATION", "ruleIds": denied.RuleIDs})
			return
		}
		write(w, http.StatusServiceUnavailable, map[string]string{"code": "MPC_UNAVAILABLE"})
	}
	mux.HandleFunc("POST /internal/authorizations", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			ActionID  string               `json:"actionId"`
			AttemptID string               `json:"attemptId"`
			Message   *types.SignTxMessage `json:"message"`
		}
		if json.NewDecoder(io.LimitReader(r.Body, 1<<16)).Decode(&body) != nil || body.Message == nil {
			write(w, http.StatusUnprocessableEntity, map[string]string{"code": "INTENT_INVALID"})
			return
		}
		sig, err := s.Authorize(r.Context(), body.ActionID, body.AttemptID, body.Message)
		if err != nil {
			fail(w, err)
			return
		}
		write(w, http.StatusOK, sig)
	})
	mux.HandleFunc("POST /internal/keygen-authorizations", func(w http.ResponseWriter, r *http.Request) {
		var m types.GenerateKeyMessage
		if json.NewDecoder(io.LimitReader(r.Body, 1<<14)).Decode(&m) != nil {
			write(w, http.StatusUnprocessableEntity, map[string]string{"code": "INTENT_INVALID"})
			return
		}
		sig, err := s.AuthorizeKeygen(r.Context(), &m)
		if err != nil {
			fail(w, err)
			return
		}
		write(w, http.StatusOK, sig)
	})
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if subtle.ConstantTimeCompare([]byte(r.Header.Get("Authorization")), expected) != 1 {
			write(w, http.StatusUnauthorized, map[string]string{"code": "AUTH_SCOPE"})
			return
		}
		mux.ServeHTTP(w, r)
	})
}
