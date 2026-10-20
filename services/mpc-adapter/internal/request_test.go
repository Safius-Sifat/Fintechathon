package internal

import (
	"context"
	"encoding/hex"
	"errors"
	secp "github.com/decred/dcrd/dcrec/secp256k1/v4"
	"github.com/decred/dcrd/dcrec/secp256k1/v4/ecdsa"
	"github.com/fystack/mpcium/pkg/client"
	"github.com/fystack/mpcium/pkg/event"
	"github.com/fystack/mpcium/pkg/types"
	boundary "mandate.local/mpc-boundary"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"
)

type store struct {
	mu    sync.Mutex
	a     Attempt
	begun bool
}

func (s *store) Begin(_ context.Context, _ string) (Attempt, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	fresh := !s.begun
	s.begun = true
	return s.a, fresh, nil
}
func (s *store) Save(_ context.Context, a Attempt) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.a = a
	return nil
}

type auth struct{ deny bool }

func (a auth) Authorize(context.Context, string, string, *types.SignTxMessage) (types.AuthorizerSignature, error) {
	if a.deny {
		return types.AuthorizerSignature{}, errors.New("unavailable")
	}
	return types.AuthorizerSignature{AuthorizerID: boundary.AuthorizerID}, nil
}

type mpc struct {
	callback   func(event.SigningResultEvent)
	published  chan *types.SignTxMessage
	registered bool
}

func (c *mpc) OnSignResult(cb func(event.SigningResultEvent)) error {
	c.callback = cb
	c.registered = true
	return nil
}
func (c *mpc) SignTransaction(m *types.SignTxMessage) error {
	if !c.registered {
		return errors.New("published before subscribe")
	}
	c.published <- m
	return nil
}
func (c *mpc) CreateWallet(string) error { panic("keygen forbidden") }
func (c *mpc) CreateWalletWithAuthorizers(string, []types.AuthorizerSignature) error {
	panic("keygen forbidden")
}
func (c *mpc) OnWalletCreationResult(func(event.KeygenResultEvent)) error { return nil }
func (c *mpc) Resharing(*types.ResharingMessage) error                    { panic("reshare forbidden") }
func (c *mpc) OnResharingResult(func(event.ResharingResultEvent)) error   { return nil }
func fixture(t *testing.T) (*store, *mpc, client.Signer, *secp.PrivateKey) {
	t.Helper()
	key := secp.PrivKeyFromBytes([]byte{3})
	s := &store{a: Attempt{Record: boundary.Record{ActionID: "action", AttemptID: "00000000-0000-4000-8000-000000000001", WalletID: "00000000-0000-4000-8000-000000000002", KeyVersion: "v1", Executor: boundary.Address(key.PubKey()), Digest: [32]byte{0, 3, 4}}, State: "PREPARED"}}
	p := filepath.Join(t.TempDir(), "key")
	if e := os.WriteFile(p, []byte(hex.EncodeToString(make([]byte, 32))), 0600); e != nil {
		t.Fatal(e)
	}
	signer, e := client.NewLocalSigner(types.EventInitiatorKeyTypeEd25519, client.LocalSignerOptions{KeyPath: p})
	if e != nil {
		t.Fatal(e)
	}
	return s, &mpc{published: make(chan *types.SignTxMessage, 2)}, signer, key
}
func TestResultBindingAndDuplicateAction(t *testing.T) {
	s, c, signer, key := fixture(t)
	a, e := New(s, auth{}, signer, c)
	if e != nil {
		t.Fatal(e)
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	done := make(chan Attempt, 1)
	go func() {
		out, e := a.SignAction(ctx, "action")
		if e != nil {
			t.Error(e)
		}
		done <- out
	}()
	<-c.published
	second, e := a.SignAction(ctx, "action")
	if e != nil || second.Record.AttemptID != "00000000-0000-4000-8000-000000000001" {
		t.Fatal("duplicate action not returned", e)
	}
	if len(c.published) != 0 {
		t.Fatal("second publish")
	}
	r := s.a.Record
	compact := ecdsa.SignCompact(key, r.Digest[:], false)
	valid := event.SigningResultEvent{ResultType: event.ResultTypeSuccess, WalletID: r.WalletID, TxID: r.AttemptID, NetworkInternalCode: boundary.Network, R: compact[1:33], S: compact[33:65], SignatureRecovery: []byte{compact[0] - 27}}
	for _, mutation := range []string{"wallet", "attempt", "network", "digest", "keyVersion", "nonrecovering"} {
		wrong := valid
		switch mutation {
		case "wallet":
			wrong.WalletID = "other"
		case "attempt":
			wrong.TxID = "other"
		case "network":
			wrong.NetworkInternalCode = "other"
		case "digest":
			d := r.Digest
			d[1] ^= 1
			sig := ecdsa.SignCompact(key, d[:], false)
			wrong.R = sig[1:33]
			wrong.S = sig[33:65]
			wrong.SignatureRecovery = []byte{sig[0] - 27}
		case "keyVersion":
			other := secp.PrivKeyFromBytes([]byte{4})
			sig := ecdsa.SignCompact(other, r.Digest[:], false)
			wrong.R = sig[1:33]
			wrong.S = sig[33:65]
			wrong.SignatureRecovery = []byte{sig[0] - 27}
		case "nonrecovering":
			wrong.R = []byte{0}
		}
		c.callback(wrong)
		select {
		case <-done:
			t.Fatalf("wrong %s completed action", mutation)
		default:
		}
	}
	c.callback(valid)
	out := <-done
	if out.State != "SIGNED" || len(out.Signature) != 65 {
		t.Fatal("valid signature not persisted")
	}
	c.callback(valid)
	if len(c.published) != 0 {
		t.Fatal("late result triggered publish")
	}
}
func TestTimeoutUnknownAndUnavailable(t *testing.T) {
	for _, deny := range []bool{false, true} {
		s, c, signer, _ := fixture(t)
		a, e := New(s, auth{deny}, signer, c)
		if e != nil {
			t.Fatal(e)
		}
		ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
		out, e := a.SignAction(ctx, "action")
		cancel()
		if e == nil {
			t.Fatal("uncertain signing succeeded")
		}
		if !deny && out.State != "SIGNING_UNKNOWN" {
			t.Fatal("timeout not unknown")
		}
		if deny && len(c.published) != 0 {
			t.Fatal("published with unavailable policy")
		}
		again, e := a.SignAction(context.Background(), "action")
		if e == nil || again.State != "" {
			t.Fatal("unbounded context permitted")
		}
	}
}
func TestRequiresDependencies(t *testing.T) {
	if _, e := New(nil, nil, nil, nil); e == nil {
		t.Fatal("missing dependencies accepted")
	}
}
