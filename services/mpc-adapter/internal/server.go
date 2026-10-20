package internal

import (
	"bytes"
	"context"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/fystack/mpcium/pkg/types"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// AuthorizerClient calls the private mandate-policy-v1 authorizer service.
type AuthorizerClient struct {
	URL   string
	Token string
	HTTP  *http.Client
}

func (c AuthorizerClient) post(ctx context.Context, path string, body any) (types.AuthorizerSignature, error) {
	var sig types.AuthorizerSignature
	b, err := json.Marshal(body)
	if err != nil {
		return sig, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.URL+path, bytes.NewReader(b))
	if err != nil {
		return sig, err
	}
	req.Header.Set("Authorization", "Bearer "+c.Token)
	req.Header.Set("Content-Type", "application/json")
	res, err := c.HTTP.Do(req)
	if err != nil {
		return sig, fmt.Errorf("authorizer unavailable: %w", err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		detail, _ := io.ReadAll(io.LimitReader(res.Body, 2048))
		return sig, fmt.Errorf("authorizer refused (%d): %s", res.StatusCode, detail)
	}
	return sig, json.NewDecoder(io.LimitReader(res.Body, 1<<14)).Decode(&sig)
}

func (c AuthorizerClient) Authorize(ctx context.Context, actionID, attemptID string, m *types.SignTxMessage) (types.AuthorizerSignature, error) {
	return c.post(ctx, "/internal/authorizations", map[string]any{"actionId": actionID, "attemptId": attemptID, "message": m})
}

func (c AuthorizerClient) AuthorizeKeygen(ctx context.Context, m *types.GenerateKeyMessage) (types.AuthorizerSignature, error) {
	return c.post(ctx, "/internal/keygen-authorizations", m)
}

type attemptView struct {
	ActionID        string  `json:"actionId"`
	AttemptID       string  `json:"attemptId"`
	KeyVersion      string  `json:"keyVersion"`
	ExecutorAddress string  `json:"executorAddress"`
	Signature       *string `json:"signature"`
	State           string  `json:"state"`
}

func view(a Attempt) attemptView {
	v := attemptView{ActionID: a.Record.ActionID, AttemptID: a.Record.AttemptID, KeyVersion: a.Record.KeyVersion, ExecutorAddress: a.Record.Executor, State: a.State}
	if a.State == "SIGNED" {
		s := "0x" + hex.EncodeToString(a.Signature)
		v.Signature = &s
	}
	return v
}

// Handler is the worker-only loopback API. Requests carry identifiers only;
// there is no route that accepts a digest, keygen-by-caller-key or reshare.
func Handler(adapter *Adapter, keygen *Keygen, store PgStore, token string, session time.Duration) http.Handler {
	expected := []byte("Bearer " + token)
	mux := http.NewServeMux()
	write := func(w http.ResponseWriter, status int, v any) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_ = json.NewEncoder(w).Encode(v)
	}
	id := func(w http.ResponseWriter, value string) (string, bool) {
		parsed, err := uuid.Parse(value)
		if err != nil || parsed.String() != value {
			write(w, http.StatusUnprocessableEntity, map[string]string{"code": "INTENT_INVALID"})
			return "", false
		}
		return value, true
	}
	body := func(w http.ResponseWriter, r *http.Request, field string) (string, bool) {
		var b map[string]string
		if json.NewDecoder(io.LimitReader(r.Body, 1024)).Decode(&b) != nil || len(b) != 1 {
			write(w, http.StatusUnprocessableEntity, map[string]string{"code": "INTENT_INVALID"})
			return "", false
		}
		return id(w, b[field])
	}
	fail := func(w http.ResponseWriter, err error) {
		switch {
		case errors.Is(err, ErrBusy):
			write(w, http.StatusConflict, map[string]string{"code": "MPC_UNAVAILABLE", "reason": "executor busy"})
		case errors.Is(err, ErrNotSigning), errors.Is(err, pgx.ErrNoRows):
			write(w, http.StatusConflict, map[string]string{"code": "RESERVATION_CONFLICT"})
		default:
			write(w, http.StatusServiceUnavailable, map[string]string{"code": "MPC_UNAVAILABLE"})
		}
	}
	mux.HandleFunc("POST /internal/sign-actions", func(w http.ResponseWriter, r *http.Request) {
		actionID, ok := body(w, r, "actionId")
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		defer cancel()
		attempt, err := adapter.Start(ctx, actionID, func() (context.Context, context.CancelFunc) {
			return context.WithTimeout(context.Background(), session)
		})
		if err != nil {
			fail(w, err)
			return
		}
		write(w, http.StatusAccepted, view(attempt))
	})
	mux.HandleFunc("GET /internal/sign-actions/{actionId}", func(w http.ResponseWriter, r *http.Request) {
		actionID, ok := id(w, r.PathValue("actionId"))
		if !ok {
			return
		}
		attempt, found, err := store.Latest(r.Context(), actionID)
		if err != nil {
			fail(w, err)
			return
		}
		if !found {
			write(w, http.StatusNotFound, map[string]string{"code": "SIGNING_UNKNOWN"})
			return
		}
		write(w, http.StatusOK, view(attempt))
	})
	mux.HandleFunc("POST /internal/keygen", func(w http.ResponseWriter, r *http.Request) {
		walletID, ok := body(w, r, "mpcWalletId")
		if !ok {
			return
		}
		status, err := keygen.Start(r.Context(), walletID)
		if err != nil {
			fail(w, err)
			return
		}
		write(w, http.StatusAccepted, status)
	})
	mux.HandleFunc("GET /internal/keygen/{mpcWalletId}", func(w http.ResponseWriter, r *http.Request) {
		walletID, ok := id(w, r.PathValue("mpcWalletId"))
		if !ok {
			return
		}
		status, found, err := store.Keygen(r.Context(), walletID)
		if err != nil {
			fail(w, err)
			return
		}
		if !found {
			write(w, http.StatusNotFound, map[string]string{"code": "MPC_UNAVAILABLE"})
			return
		}
		write(w, http.StatusOK, status)
	})
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if subtle.ConstantTimeCompare([]byte(r.Header.Get("Authorization")), expected) != 1 {
			write(w, http.StatusUnauthorized, map[string]string{"code": "AUTH_SCOPE"})
			return
		}
		mux.ServeHTTP(w, r)
	})
}
