package internal

import (
	"context"
	"time"

	"github.com/fystack/mpcium/pkg/event"
	boundary "mandate.local/mpc-boundary"
)

func (a *Adapter) result(e event.SigningResultEvent) {
	if e.ResultType != event.ResultTypeSuccess || e.NetworkInternalCode != boundary.Network {
		return
	}
	a.mu.Lock()
	p := a.pending
	if p != nil && e.WalletID == p.record.WalletID && e.TxID == p.record.AttemptID {
		defer a.mu.Unlock()
		sig, err := boundary.Normalize(p.record.Digest, e.R, e.S, e.SignatureRecovery, p.record.Executor)
		if err != nil {
			return
		}
		select {
		case p.result <- sig:
		default:
		}
		return
	}
	a.mu.Unlock()
	// A result can arrive after its session timed out (queued behind denied
	// requests). It resolves only that UNKNOWN attempt, against its stored record.
	a.lateWork.Add(1)
	go func() {
		defer a.lateWork.Done()
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		attempt, ok, err := a.store.Unresolved(ctx, e.TxID)
		if err != nil || !ok || attempt.Record.WalletID != e.WalletID {
			return
		}
		sig, err := boundary.Normalize(attempt.Record.Digest, e.R, e.S, e.SignatureRecovery, attempt.Record.Executor)
		if err != nil {
			return
		}
		attempt.State = "SIGNED"
		attempt.Signature = sig
		_ = a.store.Save(ctx, attempt)
	}()
}
