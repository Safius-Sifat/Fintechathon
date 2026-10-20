package boundary

import (
	"encoding/hex"
	"encoding/json"
	secp "github.com/decred/dcrd/dcrec/secp256k1/v4"
	"github.com/decred/dcrd/dcrec/secp256k1/v4/ecdsa"
	"os"
	"testing"
)

func TestGoldenActionSignatures(t *testing.T) {
	b, e := os.ReadFile("../../packages/schema/fixtures/action-v7.json")
	if e != nil {
		t.Fatal(e)
	}
	var fixture struct {
		Valid []struct{ Digest, Signature, Signer string }
	}
	if e = json.Unmarshal(b, &fixture); e != nil {
		t.Fatal(e)
	}
	for _, v := range fixture.Valid {
		db, _ := hex.DecodeString(v.Digest[2:])
		sb, _ := hex.DecodeString(v.Signature[2:])
		var d [32]byte
		copy(d[:], db)
		if _, e = Normalize(d, sb[:32], sb[32:64], []byte{sb[64] - 27}, v.Signer); e != nil {
			t.Fatal(e)
		}
		d[0] ^= 1
		if _, e = Normalize(d, sb[:32], sb[32:64], []byte{sb[64] - 27}, v.Signer); e == nil {
			t.Fatal("signature recovers on mutated digest")
		}
	}
}
func TestLeadingZeroHighSAndPadding(t *testing.T) {
	key := secp.PrivKeyFromBytes([]byte{1})
	d := [32]byte{0, 0, 3}
	compact := ecdsa.SignCompact(key, d[:], false)
	r, s := compact[1:33], compact[33:65]
	parity := compact[0] - 27
	address := Address(key.PubKey())
	sig, e := Normalize(d, r, s, []byte{parity}, address)
	if e != nil || len(sig) != 65 {
		t.Fatal(e)
	}
	var scalar secp.ModNScalar
	scalar.SetByteSlice(s)
	scalar.Negate()
	high := scalar.Bytes()
	normalized, e := Normalize(d, r, high[:], []byte{parity ^ 1}, address)
	if e != nil || hex.EncodeToString(sig) != hex.EncodeToString(normalized) {
		t.Fatal("high S parity normalization failed", e)
	}
	for _, bad := range []struct{ r, s, v []byte }{{nil, s, []byte{0}}, {make([]byte, 33), s, []byte{0}}, {r, make([]byte, 32), []byte{0}}, {r, s, []byte{2}}, {r, s, nil}} {
		if _, e = Normalize(d, bad.r, bad.s, bad.v, address); e == nil {
			t.Fatal("malformed signature accepted")
		}
	}
	// Find a genuine scalar with a leading zero, then remove that byte.
	for i := 0; i < 4096; i++ {
		d[30] = byte(i >> 8)
		d[31] = byte(i)
		sig := ecdsa.SignCompact(key, d[:], false)
		if sig[1] == 0 || sig[33] == 0 {
			r, s = sig[1:33], sig[33:65]
			if r[0] == 0 {
				r = r[1:]
			}
			if s[0] == 0 {
				s = s[1:]
			}
			if out, e := Normalize(d, r, s, []byte{sig[0] - 27}, address); e != nil || len(out) != 65 {
				t.Fatal("scalar padding failed", e)
			}
			return
		}
	}
	t.Fatal("no padding vector found")
}
