package internal

import (
	"context"
	"crypto/sha256"
	"errors"
	"github.com/fystack/mpcium/pkg/client"
	"github.com/fystack/mpcium/pkg/types"
	boundary "mandate.local/mpc-boundary"
	"sync"
)

type Authorizer interface {
	Authorize(context.Context, string, string, *types.SignTxMessage) (types.AuthorizerSignature, error)
}
type Adapter struct {
	mu         sync.Mutex
	store      Store
	authorizer Authorizer
	signer     client.Signer
	client     client.MPCClient
	pending    *pending
}
type pending struct {
	record boundary.Record
	result chan []byte
}

func New(store Store, authorizer Authorizer, signer client.Signer, mpc client.MPCClient) (*Adapter, error) {
	if store == nil || authorizer == nil || signer == nil || mpc == nil {
		return nil, errors.New("durable action store, policy authorizer and MPC client required")
	}
	a := &Adapter{store: store, authorizer: authorizer, signer: signer, client: mpc}
	// Subscription always precedes any call that can publish.
	if err := mpc.OnSignResult(a.result); err != nil {
		return nil, err
	}
	return a, nil
}
func (a *Adapter) SignAction(ctx context.Context, actionID string) (Attempt, error) {
	if _, ok := ctx.Deadline(); !ok {
		return Attempt{}, errors.New("bounded signing context required")
	}
	attempt, fresh, err := a.store.Begin(ctx, actionID)
	if err != nil || !fresh {
		return attempt, err
	}
	if attempt.Record.ActionID != actionID {
		return attempt, errors.New("store returned another action")
	}
	a.mu.Lock()
	if a.pending != nil {
		a.mu.Unlock()
		return attempt, errors.New("executor busy")
	}
	p := &pending{attempt.Record, make(chan []byte, 1)}
	a.pending = p
	a.mu.Unlock()
	defer func() { a.mu.Lock(); a.pending = nil; a.mu.Unlock() }()
	m, err := boundary.Message(attempt.Record, a.signer)
	if err != nil {
		return attempt, err
	}
	auth, err := a.authorizer.Authorize(ctx, actionID, attempt.Record.AttemptID, m)
	if err != nil {
		return attempt, err
	}
	m.AuthorizerSignatures = []types.AuthorizerSignature{auth}
	// SIGNING_UNKNOWN is persisted before publish, including a publish uncertainty.
	raw, err := m.Raw()
	if err != nil {
		return attempt, err
	}
	attempt.Fingerprint = sha256.Sum256(raw)
	attempt.State = "SIGNING_UNKNOWN"
	if err = a.store.Save(ctx, attempt); err != nil {
		return attempt, err
	}
	if err = ctx.Err(); err != nil {
		return attempt, err
	}
	if err = a.client.SignTransaction(m); err != nil {
		return attempt, err
	}
	select {
	case sig := <-p.result:
		attempt.State = "SIGNED"
		attempt.Signature = sig
		err = a.store.Save(ctx, attempt)
		return attempt, err
	case <-ctx.Done():
		return attempt, ctx.Err()
	}
}
