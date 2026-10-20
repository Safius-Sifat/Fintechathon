package boundary

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"errors"
	"fmt"
	"github.com/fystack/mpcium/pkg/client"
	"github.com/fystack/mpcium/pkg/types"
	"github.com/google/uuid"
)

const AuthorizerID = "mandate-policy-v1"
const Network = "eip155:84532"
const ClientID = "mandate-adapter-a"

// Record must come from independently loaded committed data, never request metadata.
type Record struct {
	ActionID, AttemptID, WalletID, KeyVersion, Executor string
	Digest                                              [32]byte
}
type Records interface {
	Load(context.Context, string, string) (Record, error)
}
type Policy interface {
	Check(context.Context, Record) error
}

func Message(r Record, signer client.Signer) (*types.SignTxMessage, error) {
	if err := ValidateRecord(r); err != nil {
		return nil, err
	}
	m := &types.SignTxMessage{KeyType: types.KeyTypeSecp256k1, WalletID: r.WalletID, NetworkInternalCode: Network, TxID: r.AttemptID, Tx: append([]byte(nil), r.Digest[:]...)}
	raw, err := m.Raw()
	if err != nil {
		return nil, err
	}
	m.Signature, err = signer.Sign(raw)
	return m, err
}

func ValidateRecord(r Record) error {
	if r.ActionID == "" || r.KeyVersion == "" {
		return errors.New("incomplete committed record")
	}
	for _, id := range []string{r.AttemptID, r.WalletID} {
		parsed, err := uuid.Parse(id)
		if err != nil || parsed.String() != id {
			return errors.New("canonical UUID required")
		}
	}
	return nil
}

func Match(m *types.SignTxMessage, r Record) error {
	if err := ValidateRecord(r); err != nil {
		return err
	}
	if m == nil || m.KeyType != types.KeyTypeSecp256k1 || m.WalletID != r.WalletID || m.NetworkInternalCode != Network || m.TxID != r.AttemptID || m.DerivationPath != nil || !bytes.Equal(m.Tx, r.Digest[:]) {
		return errors.New("request differs from committed action")
	}
	return nil
}

type Authorizer struct {
	records   Records
	policy    Policy
	initiator ed25519.PublicKey
	signer    client.Signer
}

func NewAuthorizer(records Records, policy Policy, initiator ed25519.PublicKey, signer client.Signer) (*Authorizer, error) {
	if records == nil || policy == nil || len(initiator) != ed25519.PublicKeySize || signer == nil {
		return nil, errors.New("trusted records, independent policy and identities required")
	}
	return &Authorizer{records, policy, append(ed25519.PublicKey(nil), initiator...), signer}, nil
}
func (a *Authorizer) Authorize(ctx context.Context, actionID, attemptID string, m *types.SignTxMessage) (types.AuthorizerSignature, error) {
	var empty types.AuthorizerSignature
	r, err := a.records.Load(ctx, actionID, attemptID)
	if err != nil {
		return empty, err
	}
	if r.ActionID != actionID || r.AttemptID != attemptID {
		return empty, errors.New("record identity mismatch")
	}
	if err = Match(m, r); err != nil {
		return empty, err
	}
	raw, err := m.Raw()
	if err != nil {
		return empty, err
	}
	if !ed25519.Verify(a.initiator, raw, m.Signature) {
		return empty, errors.New("invalid initiator")
	}
	if err = a.policy.Check(ctx, r); err != nil {
		return empty, fmt.Errorf("policy denied: %w", err)
	}
	raw, err = types.ComposeAuthorizerRaw(m)
	if err != nil {
		return empty, err
	}
	sig, err := a.signer.Sign(raw)
	return types.AuthorizerSignature{AuthorizerID: AuthorizerID, Signature: sig}, err
}

func ValidateAuthorization(enabled bool, required []string, publicKey []byte, expected []byte) error {
	if !enabled || len(required) != 1 || required[0] != AuthorizerID || len(publicKey) != ed25519.PublicKeySize || !bytes.Equal(publicKey, expected) {
		return errors.New("mandatory authorizer configuration missing or mismatched")
	}
	return nil
}
