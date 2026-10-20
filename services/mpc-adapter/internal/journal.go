package internal

import (
	"context"
	boundary "mandate.local/mpc-boundary"
)

type Attempt struct {
	Record      boundary.Record
	State       string
	Signature   []byte
	Fingerprint [32]byte
}

// Store must durably reserve an action, uniquely assign its attempt and enforce
// executor exclusion across processes before returning newlyCreated=true.
type Store interface {
	Begin(context.Context, string) (attempt Attempt, newlyCreated bool, err error)
	Save(context.Context, Attempt) error
	// Unresolved returns an attempt still UNKNOWN after its session ended.
	Unresolved(context.Context, string) (Attempt, bool, error)
}
