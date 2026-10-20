package internal

import (
	"context"
	"crypto/ed25519"
	"encoding/hex"
	"errors"
	"github.com/fystack/mpcium/pkg/client"
	"github.com/fystack/mpcium/pkg/types"
	boundary "mandate.local/mpc-boundary"
	"os"
	"path/filepath"
	"testing"
)

type records struct {
	record boundary.Record
	deny   bool
}

func (r records) Load(_ context.Context, action, attempt string) (boundary.Record, error) {
	if action != r.record.ActionID || attempt != r.record.AttemptID {
		return boundary.Record{}, errors.New("missing immutable record")
	}
	return r.record, nil
}
func (r records) Check(context.Context, boundary.Record) error {
	if r.deny {
		return errors.New("independent policy denied")
	}
	return nil
}
func identity(t *testing.T, n byte) client.Signer {
	t.Helper()
	seed := make([]byte, 32)
	seed[0] = n
	p := filepath.Join(t.TempDir(), "identity")
	if e := os.WriteFile(p, []byte(hex.EncodeToString(seed)), 0600); e != nil {
		t.Fatal(e)
	}
	s, e := client.NewLocalSigner(types.EventInitiatorKeyTypeEd25519, client.LocalSignerOptions{KeyPath: p})
	if e != nil {
		t.Fatal(e)
	}
	return s
}
func TestMissingPolicyCannotStart(t *testing.T) {
	if _, err := New(nil, nil, nil, nil); err == nil {
		t.Fatal("production authorizer accepted missing dependencies")
	}
}
func TestIndependentRecordAndInitiator(t *testing.T) {
	for _, mode := range []string{"valid", "caller-digest", "missing-record", "wrong-initiator", "denied-policy"} {
		t.Run(mode, func(t *testing.T) {
			init, author := identity(t, 1), identity(t, 2)
			pub, _ := init.PublicKey()
			pk, _ := hex.DecodeString(pub)
			r := boundary.Record{ActionID: "committed", AttemptID: "00000000-0000-4000-8000-000000000001", WalletID: "00000000-0000-4000-8000-000000000002", KeyVersion: "v1", Digest: [32]byte{0, 2}}
			db := records{record: r, deny: mode == "denied-policy"}
			a, e := New(db, db, ed25519.PublicKey(pk), author)
			if e != nil {
				t.Fatal(e)
			}
			m, e := boundary.Message(r, init)
			if e != nil {
				t.Fatal(e)
			}
			action := r.ActionID
			switch mode {
			case "caller-digest":
				m.Tx[0] = 1
				raw, _ := m.Raw()
				m.Signature, _ = init.Sign(raw)
			case "missing-record":
				action = "caller-claims-allowed"
			case "wrong-initiator":
				other := identity(t, 3)
				raw, _ := m.Raw()
				m.Signature, _ = other.Sign(raw)
			}
			sig, e := a.Authorize(context.Background(), action, r.AttemptID, m)
			if mode != "valid" {
				if e == nil {
					t.Fatal("unauthorized caller received signature")
				}
				return
			}
			if e != nil {
				t.Fatal(e)
			}
			raw, _ := types.ComposeAuthorizerRaw(m)
			pub, _ = author.PublicKey()
			pk, _ = hex.DecodeString(pub)
			if sig.AuthorizerID != boundary.AuthorizerID || !ed25519.Verify(pk, raw, sig.Signature) {
				t.Fatal("wrong authorization bytes")
			}
		})
	}
}
