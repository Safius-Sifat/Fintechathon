package internal

import (
	"context"
	"encoding/hex"
	"errors"
	"sync"
	"time"

	"github.com/fystack/mpcium/pkg/client"
	"github.com/fystack/mpcium/pkg/event"
	"github.com/fystack/mpcium/pkg/types"
)

type KeygenStore interface {
	BeginKeygen(context.Context, string) (KeygenStatus, bool, error)
	Keygen(context.Context, string) (KeygenStatus, bool, error)
	FinishKeygen(context.Context, string, KeygenStatus) error
}
type KeygenAuthorizer interface {
	AuthorizeKeygen(context.Context, *types.GenerateKeyMessage) (types.AuthorizerSignature, error)
}

// Keygen runs the per-wallet DKG ceremony for wallets provisioning put in KEYGEN.
type Keygen struct {
	mu         sync.Mutex
	store      KeygenStore
	authorizer KeygenAuthorizer
	signer     client.Signer
	client     client.MPCClient
	busy       bool
	timeout    time.Duration
}

func NewKeygen(store KeygenStore, authorizer KeygenAuthorizer, signer client.Signer, mpc client.MPCClient, timeout time.Duration) (*Keygen, error) {
	k := &Keygen{store: store, authorizer: authorizer, signer: signer, client: mpc, timeout: timeout}
	// Results are handled before any request is published; a late result still
	// completes its PENDING ceremony.
	if err := mpc.OnWalletCreationResult(k.result); err != nil {
		return nil, err
	}
	return k, nil
}

func (k *Keygen) result(e event.KeygenResultEvent) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if status, ok, err := k.store.Keygen(ctx, e.WalletID); err != nil || !ok || status.State != "PENDING" {
		return
	}
	if e.ResultType != event.ResultTypeSuccess {
		_ = k.store.FinishKeygen(ctx, e.WalletID, KeygenStatus{State: "FAILED", Reason: truncate(e.ErrorReason, 500)})
		return
	}
	if len(e.ECDSAPubKey) != 64 {
		_ = k.store.FinishKeygen(ctx, e.WalletID, KeygenStatus{State: "FAILED", Reason: "upstream ECDSA key is not X||Y"})
		return
	}
	_ = k.store.FinishKeygen(ctx, e.WalletID, KeygenStatus{State: "DONE", PublicKey: "0x04" + hex.EncodeToString(e.ECDSAPubKey)})
}

func truncate(s string, n int) string {
	if len(s) > n {
		return s[:n]
	}
	return s
}

// Start begins the ceremony once; repeated calls return its journaled status.
func (k *Keygen) Start(ctx context.Context, walletID string) (KeygenStatus, error) {
	k.mu.Lock()
	if k.busy {
		k.mu.Unlock()
		if status, ok, err := k.store.Keygen(ctx, walletID); err != nil || ok {
			return status, err
		}
		return KeygenStatus{}, ErrBusy
	}
	k.busy = true
	k.mu.Unlock()
	status, fresh, err := k.store.BeginKeygen(ctx, walletID)
	if err != nil || !fresh {
		k.release()
		return status, err
	}
	go func() {
		defer k.release()
		bounded, cancel := context.WithTimeout(context.Background(), k.timeout)
		defer cancel()
		if err := k.publish(bounded, walletID); err != nil {
			// Authorization or publish failed before any node could start DKG.
			_ = k.store.FinishKeygen(context.Background(), walletID, KeygenStatus{State: "FAILED", Reason: truncate(err.Error(), 500)})
			return
		}
		// Hold the ceremony slot until the result lands or the bound expires;
		// an expired wait leaves the row PENDING for a late result.
		for bounded.Err() == nil {
			if status, ok, _ := k.store.Keygen(bounded, walletID); ok && status.State != "PENDING" {
				return
			}
			select {
			case <-bounded.Done():
			case <-time.After(250 * time.Millisecond):
			}
		}
	}()
	return status, nil
}

func (k *Keygen) release() {
	k.mu.Lock()
	k.busy = false
	k.mu.Unlock()
}

func (k *Keygen) publish(ctx context.Context, walletID string) error {
	m := &types.GenerateKeyMessage{WalletID: walletID}
	raw, err := m.Raw()
	if err != nil {
		return err
	}
	if m.Signature, err = k.signer.Sign(raw); err != nil {
		return err
	}
	auth, err := k.authorizer.AuthorizeKeygen(ctx, m)
	if err != nil {
		return err
	}
	if auth.AuthorizerID == "" || len(auth.Signature) == 0 {
		return errors.New("keygen authorization missing")
	}
	return k.client.CreateWalletWithAuthorizers(walletID, []types.AuthorizerSignature{auth})
}
