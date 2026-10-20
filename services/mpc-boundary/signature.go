package boundary

import (
	"encoding/hex"
	"errors"
	secp "github.com/decred/dcrd/dcrec/secp256k1/v4"
	"github.com/decred/dcrd/dcrec/secp256k1/v4/ecdsa"
	"golang.org/x/crypto/sha3"
	"strings"
)

func Address(pub *secp.PublicKey) string {
	h := sha3.NewLegacyKeccak256()
	h.Write(pub.SerializeUncompressed()[1:])
	return "0x" + hex.EncodeToString(h.Sum(nil)[12:])
}
func Normalize(digest [32]byte, r, s, recovery []byte, expected string) ([]byte, error) {
	if len(r) == 0 || len(r) > 32 || len(s) == 0 || len(s) > 32 || len(recovery) != 1 || recovery[0] > 1 {
		return nil, errors.New("invalid signature dimensions")
	}
	var rr, ss secp.ModNScalar
	if rr.SetByteSlice(r) || ss.SetByteSlice(s) || rr.IsZero() || ss.IsZero() {
		return nil, errors.New("invalid signature scalars")
	}
	parity := recovery[0]
	if ss.IsOverHalfOrder() {
		ss.Negate()
		parity ^= 1
	}
	rb, sb := rr.Bytes(), ss.Bytes()
	sig := make([]byte, 65)
	copy(sig[:32], rb[:])
	copy(sig[32:64], sb[:])
	sig[64] = parity
	compact := append([]byte{27 + parity}, sig[:64]...)
	pub, _, err := ecdsa.RecoverCompact(compact, digest[:])
	if err != nil {
		return nil, err
	}
	if !strings.EqualFold(Address(pub), expected) {
		return nil, errors.New("signature does not recover registered executor")
	}
	return sig, nil
}
