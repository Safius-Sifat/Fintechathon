package boundary

import (
	"context"
	"crypto/ed25519"
	"encoding/hex"
	"encoding/json"
	"errors"
	"github.com/fystack/mpcium/pkg/client"
	"github.com/fystack/mpcium/pkg/types"
	"os"
	"path/filepath"
	"testing"
)

type source struct {
	r      Record
	denied bool
	used   bool
}

func (s *source) Load(_ context.Context, a, b string) (Record, error) {
	if a != s.r.ActionID || b != s.r.AttemptID {
		return Record{}, errors.New("missing record")
	}
	return s.r, nil
}
func (s *source) Check(_ context.Context, r Record) error {
	if s.denied || s.used {
		return errors.New("denied/replayed")
	}
	s.used = true
	return nil
}
func testSigner(t *testing.T, n byte) client.Signer {
	t.Helper()
	seed := make([]byte, 32)
	seed[0] = n
	path := filepath.Join(t.TempDir(), "key")
	if err := os.WriteFile(path, []byte(hex.EncodeToString(seed)), 0600); err != nil {
		t.Fatal(err)
	}
	s, e := client.NewLocalSigner(types.EventInitiatorKeyTypeEd25519, client.LocalSignerOptions{KeyPath: path})
	if e != nil {
		t.Fatal(e)
	}
	return s
}
func testRecord() Record {
	return Record{ActionID: "action-1", AttemptID: "00000000-0000-4000-8000-000000000001", WalletID: "00000000-0000-4000-8000-000000000002", KeyVersion: "v1", Digest: [32]byte{0, 1, 2, 3}}
}
func TestAuthorizationMutations(t *testing.T) {
	for _, name := range []string{"keytype", "wallet", "network", "attempt", "digest", "path", "empty-path", "initiator", "missing-record", "policy", "replay"} {
		t.Run(name, func(t *testing.T) {
			init, author := testSigner(t, 1), testSigner(t, 2)
			r := testRecord()
			s := &source{r: r}
			pub, _ := init.PublicKey()
			p, _ := hex.DecodeString(pub)
			a, e := NewAuthorizer(s, s, ed25519.PublicKey(p), author)
			if e != nil {
				t.Fatal(e)
			}
			m, e := Message(r, init)
			if e != nil {
				t.Fatal(e)
			}
			switch name {
			case "keytype":
				m.KeyType = types.KeyTypeEd25519
			case "wallet":
				m.WalletID = "other"
			case "network":
				m.NetworkInternalCode = "eip155:1"
			case "attempt":
				m.TxID = "other"
			case "digest":
				m.Tx[0] ^= 1
			case "path":
				m.DerivationPath = []uint32{1}
			case "empty-path":
				m.DerivationPath = []uint32{}
			case "initiator":
				m.Signature[0] ^= 1
			case "missing-record":
				s.r.ActionID = "other"
			case "policy":
				s.denied = true
			case "replay":
				if _, e = a.Authorize(context.Background(), r.ActionID, r.AttemptID, m); e != nil {
					t.Fatal(e)
				}
			}
			if _, e = a.Authorize(context.Background(), r.ActionID, r.AttemptID, m); e == nil {
				t.Fatal("unauthorized request accepted")
			}
		})
	}
}
func TestUpstreamBytesAndDeterministicInitiator(t *testing.T) {
	init, author := testSigner(t, 1), testSigner(t, 2)
	r := testRecord()
	m, e := Message(r, init)
	if e != nil {
		t.Fatal(e)
	}
	raw, _ := m.Raw()
	authRaw, _ := types.ComposeAuthorizerRaw(m)
	fixture := struct {
		Raw           string `json:"raw"`
		AuthorizerRaw string `json:"authorizerRaw"`
	}{string(raw), string(authRaw)}
	if os.Getenv("UPDATE_BYTE_FIXTURE") == "1" {
		b, _ := json.MarshalIndent(fixture, "", "  ")
		if e = os.WriteFile("testdata/upstream-bytes.json", b, 0644); e != nil {
			t.Fatal(e)
		}
	}
	b, e := os.ReadFile("testdata/upstream-bytes.json")
	if e != nil {
		t.Fatal(e)
	}
	var golden struct {
		Raw           string `json:"raw"`
		AuthorizerRaw string `json:"authorizerRaw"`
	}
	if e = json.Unmarshal(b, &golden); e != nil {
		t.Fatal(e)
	}
	if fixture != golden {
		t.Fatalf("upstream serialization changed: %s", raw)
	}
	s := &source{r: r}
	pubHex, _ := init.PublicKey()
	pub, _ := hex.DecodeString(pubHex)
	a, _ := NewAuthorizer(s, s, pub, author)
	sig, e := a.Authorize(context.Background(), r.ActionID, r.AttemptID, m)
	if e != nil {
		t.Fatal(e)
	}
	pk, _ := author.PublicKey()
	pkb, _ := hex.DecodeString(pk)
	if !ed25519.Verify(pkb, authRaw, sig.Signature) {
		t.Fatal("wrong authorizer bytes")
	}
	m.AuthorizerSignatures = []types.AuthorizerSignature{sig}
	again, _ := m.Raw()
	signature, _ := init.Sign(again)
	if hex.EncodeToString(signature) != hex.EncodeToString(m.Signature) {
		t.Fatal("initiator signature changed after authorizing")
	}
}
func TestMandatoryAuthorizer(t *testing.T) {
	p := make([]byte, 32)
	p[0] = 1
	for _, c := range []struct {
		enabled bool
		ids     []string
		key     []byte
	}{{false, []string{AuthorizerID}, p}, {true, nil, p}, {true, []string{}, p}, {true, []string{"wrong"}, p}, {true, []string{AuthorizerID}, make([]byte, 32)}} {
		if ValidateAuthorization(c.enabled, c.ids, c.key, p) == nil {
			t.Fatal("unsafe configuration ready")
		}
	}
	if e := ValidateAuthorization(true, []string{AuthorizerID}, p, p); e != nil {
		t.Fatal(e)
	}
}
func TestMissingProductionDependencies(t *testing.T) {
	if _, e := NewAuthorizer(nil, nil, nil, nil); e == nil {
		t.Fatal("missing dependencies accepted")
	}
}

func TestRejectNonCanonicalIDs(t *testing.T) {
	for _, id := range []string{"../path", "%2e%2e%2fsecrets", "uuid/../path", "wallet:evil", " 00000000-0000-4000-8000-000000000001", "00000000000040008000000000000001"} {
		r := testRecord()
		r.WalletID = id
		if _, e := Message(r, testSigner(t, 1)); e == nil {
			t.Fatalf("unsafe wallet ID accepted: %q", id)
		}
		r = testRecord()
		r.AttemptID = id
		if _, e := Message(r, testSigner(t, 1)); e == nil {
			t.Fatalf("unsafe attempt ID accepted: %q", id)
		}
	}
}
