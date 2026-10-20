package internal

import (
	"crypto/ed25519"
	"github.com/fystack/mpcium/pkg/client"
	boundary "mandate.local/mpc-boundary"
)

// New refuses startup without both financial dependencies. The qualification CLI
// supplies an isolated fixture implementation; there is no production default.
func New(records boundary.Records, policy boundary.Policy, initiator ed25519.PublicKey, signer client.Signer) (*boundary.Authorizer, error) {
	return boundary.NewAuthorizer(records, policy, initiator, signer)
}
