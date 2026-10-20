package internal

import (
	"context"
	"crypto/sha256"
	"errors"
	"sync"

	"github.com/fystack/mpcium/pkg/client"
	"github.com/fystack/mpcium/pkg/types"
	boundary "mandate.local/mpc-boundary"
)

var ErrBusy = errors.New("executor busy")

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
	// lateWork tracks late-result resolution so shutdown and tests can wait for it.
	lateWork sync.WaitGroup
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

// SignAction runs one signing session to completion within ctx.
func (a *Adapter) SignAction(ctx context.Context, actionID string) (Attempt, error) {
	attempt, fresh, err := a.begin(ctx, actionID)
	if err != nil || !fresh {
		return attempt, err
	}
	defer a.release()
	return a.run(ctx, attempt)
}

// Start journals the attempt and returns it, running the session in the
// background under its own bounded context.
func (a *Adapter) Start(ctx context.Context, actionID string, session func() (context.Context, context.CancelFunc)) (Attempt, error) {
	attempt, fresh, err := a.begin(ctx, actionID)
	if err != nil || !fresh {
		return attempt, err
	}
	go func() {
		defer a.release()
		bounded, cancel := session()
		defer cancel()
		_, _ = a.run(bounded, attempt)
	}()
	return attempt, nil
}

// WaitLate blocks until in-flight late-result resolutions finish.
func (a *Adapter) WaitLate() { a.lateWork.Wait() }

func (a *Adapter) begin(ctx context.Context, actionID string) (Attempt, bool, error) {
	if _, ok := ctx.Deadline(); !ok {
		return Attempt{}, false, errors.New("bounded signing context required")
	}
	attempt, fresh, err := a.store.Begin(ctx, actionID)
	if err != nil || !fresh {
		return attempt, false, err
	}
	if attempt.Record.ActionID != actionID {
		return attempt, false, errors.New("store returned another action")
	}
	a.mu.Lock()
	if a.pending != nil {
		a.mu.Unlock()
		// Nothing was published, so the attempt closes without uncertainty.
		attempt.State = "ABORTED"
		if err := a.store.Save(ctx, attempt); err != nil {
			return attempt, false, err
		}
		return attempt, false, ErrBusy
	}
	a.pending = &pending{attempt.Record, make(chan []byte, 1)}
	a.mu.Unlock()
	return attempt, true, nil
}

func (a *Adapter) release() {
	a.mu.Lock()
	a.pending = nil
	a.mu.Unlock()
}

func (a *Adapter) run(ctx context.Context, attempt Attempt) (Attempt, error) {
	a.mu.Lock()
	p := a.pending
	a.mu.Unlock()
	m, err := boundary.Message(attempt.Record, a.signer)
	if err != nil {
		return a.deny(ctx, attempt, err)
	}
	auth, err := a.authorizer.Authorize(ctx, attempt.Record.ActionID, attempt.Record.AttemptID, m)
	if err != nil {
		return a.deny(ctx, attempt, err)
	}
	m.AuthorizerSignatures = []types.AuthorizerSignature{auth}
	// SIGNING_UNKNOWN is persisted before publish, including a publish uncertainty.
	raw, err := m.Raw()
	if err != nil {
		return a.deny(ctx, attempt, err)
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
		err = a.store.Save(context.WithoutCancel(ctx), attempt)
		return attempt, err
	case <-ctx.Done():
		return attempt, ctx.Err()
	}
}

// deny closes an attempt that never reached publication.
func (a *Adapter) deny(ctx context.Context, attempt Attempt, cause error) (Attempt, error) {
	attempt.State = "DENIED"
	if err := a.store.Save(context.WithoutCancel(ctx), attempt); err != nil {
		return attempt, errors.Join(cause, err)
	}
	return attempt, cause
}
